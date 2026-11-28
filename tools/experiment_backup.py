#!/usr/bin/env python3
"""Archive completed experiment directories to a removable, initialized volume.

This command never removes a source directory.  Its local queue is deliberately
small and ignored by Git, so work can continue while the removable volume is
away.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import shutil
import sys
import tarfile
import tempfile
import uuid
from typing import Callable, Iterator


ALLOWED_PREFIXES = (
    PurePosixPath("hd-2d/results"),
    PurePosixPath("hd-2d/art-rsi/runs"),
    PurePosixPath("hd-2d/character-lab/work"),
    PurePosixPath("hd-2d/vfx-lab/results"),
    PurePosixPath(".local/artifacts"),
)
VOLUME_MARKER = ".isekai-lab-experiment-backup.json"
FORMAT_VERSION = 1


class BackupError(RuntimeError):
    pass


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def queue_dir(repo: Path) -> Path:
    return repo / ".local" / "experiment-backup"


def queue_path(repo: Path, relative: str) -> Path:
    digest = hashlib.sha256(relative.encode()).hexdigest()
    return queue_dir(repo) / "queue" / f"{digest}.json"


def write_json_atomic(path: Path, value: object, *, create_parent: bool = True) -> None:
    if create_parent:
        path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


@contextlib.contextmanager
def queue_lock(repo: Path, blocking: bool, name: str = "queue") -> Iterator[bool]:
    directory = queue_dir(repo)
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / f"{name}.lock").open("a+") as handle:
        try:
            flags = fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB)
            fcntl.flock(handle.fileno(), flags)
        except BlockingIOError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def validated_relative(value: str, repo: Path, require_source: bool = True) -> PurePosixPath:
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or str(path) == ".":
        raise BackupError("source must be a non-empty repository-relative path")
    if not any(path.is_relative_to(prefix) and len(path.parts) > len(prefix.parts) for prefix in ALLOWED_PREFIXES):
        prefixes = ", ".join(f"{prefix}/" for prefix in ALLOWED_PREFIXES)
        raise BackupError(f"source is outside an experiment root: {prefixes}")
    source = repo.resolve().joinpath(*path.parts)
    if require_source:
        if not source.is_dir() or source.is_symlink():
            raise BackupError("source must be an existing directory, not a symlink")
        if source.resolve() != source:
            raise BackupError("source path contains a symlink")
    return path


def validate_date(value: str) -> str:
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError as error:
        raise BackupError("--completed must use YYYY-MM-DD") from error


def source_entries(source: Path, relative: PurePosixPath) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    base = source.resolve()
    for directory, folders, files in os.walk(source, followlinks=False):
        folder_path = Path(directory)
        for name in sorted(folders + files):
            full = folder_path / name
            local = full.relative_to(source)
            archive_name = str(relative / PurePosixPath(*local.parts))
            if ".git" in local.parts:
                raise BackupError(f"nested Git metadata is not archivable: {archive_name}")
            if name == ".env" or name.startswith(".env.") or name.lower().startswith("credential") or name.endswith((".pem", ".key")):
                raise BackupError(f"possible credential is not archivable: {archive_name}")
            st = full.lstat()
            if full.is_symlink():
                target = os.readlink(full)
                if os.path.isabs(target):
                    raise BackupError(f"absolute symlink is not archivable: {archive_name}")
                try:
                    (full.parent / target).resolve().relative_to(base)
                except ValueError as error:
                    raise BackupError(f"symlink escapes source: {archive_name}") from error
                entries.append({"path": archive_name, "type": "symlink", "mode": st.st_mode & 0o7777, "target": target})
            elif full.is_file():
                entries.append({"path": archive_name, "type": "file", "mode": st.st_mode & 0o7777,
                                "size": st.st_size, "sha256": hash_file(full)})
            elif full.is_dir():
                entries.append({"path": archive_name, "type": "directory", "mode": st.st_mode & 0o7777})
            else:
                raise BackupError(f"unsupported filesystem entry: {archive_name}")
    return sorted(entries, key=lambda item: str(item["path"]))


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def mount_ready(volume: Path, is_mount: Callable[[str], bool] = os.path.ismount) -> bool:
    return (
        volume.is_absolute() and not volume.is_symlink() and volume.is_dir()
        and is_mount(str(volume)) and (volume / VOLUME_MARKER).is_file()
    )


def marker_bytes(volume: Path) -> bytes:
    marker = volume / VOLUME_MARKER
    try:
        if marker.is_symlink():
            raise BackupError("backup volume marker must be a regular file")
        data = marker.read_bytes()
        decoded = json.loads(data)
    except (OSError, json.JSONDecodeError) as error:
        raise BackupError("backup volume marker is unreadable") from error
    if not isinstance(decoded, dict) or decoded.get("formatVersion") != FORMAT_VERSION or not decoded.get("volumeId"):
        raise BackupError("backup volume marker has an unsupported format")
    return data


def archive_dir(volume: Path, relative: PurePosixPath) -> Path:
    destination = volume
    for part in ("isekai-lab", "experiments", *relative.parts):
        destination /= part
        if destination.is_symlink():
            raise BackupError(f"archive destination contains a symlink: {destination}")
    return destination


def archive_manifest(source_relative: str, completed: str, entries: list[dict[str, object]]) -> dict[str, object]:
    return {"formatVersion": FORMAT_VERSION, "source": source_relative, "completed": completed,
            "createdAt": dt.datetime.now(dt.UTC).isoformat(), "entries": entries}


def safe_members(tar: tarfile.TarFile, expected_root: PurePosixPath) -> list[tarfile.TarInfo]:
    members = tar.getmembers()
    files = set()
    for member in members:
        name = PurePosixPath(member.name)
        if name.is_absolute() or ".." in name.parts or not name.is_relative_to(expected_root) or name in files:
            raise BackupError(f"unsafe archive member: {member.name}")
        files.add(name)
        if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
            raise BackupError(f"unsupported archive member: {member.name}")
        if member.issym() or member.islnk():
            target = PurePosixPath(member.linkname)
            if target.is_absolute():
                raise BackupError(f"unsafe archive link: {member.name}")
            link = name.parent / target if member.issym() else target
            combined = PurePosixPath(posixpath.normpath(str(link)))
            if not combined.is_relative_to(expected_root):
                raise BackupError(f"archive link escapes source: {member.name}")
    return members


def verify_archive(directory: Path, expected_root: PurePosixPath) -> dict[str, object]:
    manifest_path, payload, checksums = directory / "manifest.json", directory / "payload.tar", directory / "SHA256SUMS"
    if not all(item.is_file() for item in (manifest_path, payload, checksums)):
        raise BackupError(f"archive is incomplete: {directory}")
    expected = {line.split("  ", 1)[1]: line.split("  ", 1)[0]
                for line in checksums.read_text(encoding="utf-8").splitlines() if "  " in line}
    for name in ("manifest.json", "payload.tar"):
        if expected.get(name) != hash_file(directory / name):
            raise BackupError(f"checksum mismatch: {name}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("source") != str(expected_root) or manifest.get("formatVersion") != FORMAT_VERSION:
        raise BackupError("archive manifest has a different source or format")
    with tarfile.open(payload, "r") as archive:
        members = safe_members(archive, expected_root)
        listed = {member.name: member for member in members}
        root = listed.pop(str(expected_root), None)
        if root is None or not root.isdir():
            raise BackupError("archive root must be a directory")
        for entry in manifest.get("entries", []):
            member = listed.pop(entry["path"], None)
            if member is None:
                raise BackupError(f"manifest entry missing from archive: {entry['path']}")
            if member.mode != entry["mode"]:
                raise BackupError(f"mode mismatch: {member.name}")
            if entry["type"] == "directory" and not member.isdir():
                raise BackupError(f"expected directory: {member.name}")
            if entry["type"] == "symlink" and (not member.issym() or member.linkname != entry["target"]):
                raise BackupError(f"link mismatch: {member.name}")
            if entry["type"] == "file":
                if not (member.isfile() or member.islnk()):
                    raise BackupError(f"expected regular file: {member.name}")
                extracted = archive.extractfile(member)
                if extracted is None:
                    raise BackupError(f"cannot read archive entry: {member.name}")
                with extracted:
                    digest = hashlib.file_digest(extracted, "sha256").hexdigest()
                if digest != entry["sha256"]:
                    raise BackupError(f"content mismatch: {member.name}")
        if listed:
            raise BackupError("archive has entries outside its manifest")
    return manifest


def same_source(manifest: dict[str, object], entries: list[dict[str, object]]) -> bool:
    return manifest.get("entries") == entries


def check_volume(volume, device, marker, is_mount):
    if not mount_ready(volume, is_mount) or volume.stat().st_dev != device or marker != marker_bytes(volume):
        raise BackupError("backup volume changed or was removed during archive")


def create_archive(source: Path, relative: PurePosixPath, completed: str, volume: Path, marker: bytes,
                   before: list[dict[str, object]], is_mount: Callable[[str], bool] = os.path.ismount) -> Path:
    manifest = archive_manifest(str(relative), completed, before)
    destination = archive_dir(volume, relative)
    volume_device = volume.stat().st_dev
    check_volume(volume, volume_device, marker, is_mount)
    parent = volume
    for part in destination.parent.relative_to(volume).parts:
        parent /= part
        if parent.is_symlink():
            raise BackupError(f"archive destination contains a symlink: {parent}")
        parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".isekai-backup-", dir=volume) as temporary:
        staged = Path(temporary) / "archive"
        staged.mkdir()
        payload = staged / "payload.tar"
        with tarfile.open(payload, "w", dereference=False) as archive:
            archive.add(source, arcname=str(relative), recursive=True)
        after = source_entries(source, relative)
        if before != after:
            raise BackupError("source changed while it was being archived")
        write_json_atomic(staged / "manifest.json", manifest, create_parent=False)
        checksum_lines = []
        for name in ("manifest.json", "payload.tar"):
            checksum_lines.append(f"{hash_file(staged / name)}  {name}\n")
        (staged / "SHA256SUMS").write_text("".join(checksum_lines), encoding="utf-8")
        verify_archive(staged, relative)
        check_volume(volume, volume_device, marker, is_mount)
        if destination.exists():
            raise BackupError(f"archive appeared during copy: {destination}")
        os.replace(staged, destination)
    return destination


def load_entries(repo: Path) -> list[tuple[Path, dict[str, object]]]:
    result = []
    for path in sorted((queue_dir(repo) / "queue").glob("*.json")):
        try:
            result.append((path, json.loads(path.read_text(encoding="utf-8"))))
        except json.JSONDecodeError as error:
            raise BackupError(f"invalid queue entry: {path}") from error
    return result


def enqueue_locked(repo: Path, value: str, completed: str | None, quiet: bool = False) -> str:
    relative = validated_relative(value, repo)
    date = validate_date(completed) if completed else dt.date.today().isoformat()
    path = queue_path(repo, str(relative))
    if path.exists():
        if not quiet:
            print(f"already queued: {relative}")
        return str(relative)
    write_json_atomic(path, {"source": str(relative), "completed": date, "state": "pending"})
    print(f"queued: {relative}")
    return str(relative)


def enqueue(repo: Path, value: str, completed: str | None) -> str:
    with queue_lock(repo, blocking=True) as locked:
        assert locked
        return enqueue_locked(repo, value, completed)


def discover_locked(repo: Path) -> int:
    """Register terminal iteration results without requiring a backup volume."""
    try:
        from experiment_discovery import completed_runs
    except ImportError as error:
        raise BackupError("experiment discovery module is unavailable") from error
    for source, completed in completed_runs(repo):
        try:
            enqueue_locked(repo, source, completed, quiet=True)
        except (BackupError, OSError, json.JSONDecodeError) as error:
            print(f"discovery skipped: {source}: {error}", file=sys.stderr)
    return 0


def discover(repo: Path) -> int:
    with queue_lock(repo, blocking=True) as locked:
        assert locked
        return discover_locked(repo)


def run(repo: Path, volume: Path, is_mount: Callable[[str], bool] = os.path.ismount) -> int:
    with queue_lock(repo, blocking=False, name="run") as locked:
        if not locked:
            print("backup already running; queue left unchanged")
            return 0
        discover(repo)
        entries = load_entries(repo)
        if not entries:
            print("no registered experiments")
            return 0
        if not mount_ready(volume, is_mount):
            count = sum(item.get("state") != "complete" for _, item in entries)
            print(f"backup deferred: initialized removable volume unavailable ({volume}); {count} pending")
            return 0
        try:
            marker = marker_bytes(volume)
        except BackupError as error:
            print(f"backup deferred: {error}", file=sys.stderr)
            return 1
        volume_id = json.loads(marker)["volumeId"]
        pending = [(path, item) for path, item in entries
                   if item.get("state") != "complete" or item.get("volumeId") != volume_id]
        if not pending:
            print("no pending experiment backups")
            return 0
        device = volume.stat().st_dev
        failures = 0
        for path, entry in pending:
            try:
                check_volume(volume, device, marker, is_mount)
                relative = validated_relative(str(entry["source"]), repo)
                snapshot = source_entries(repo.joinpath(*relative.parts), relative)
                target = archive_dir(volume, relative)
                if target.exists():
                    existing = verify_archive(target, relative)
                    if not same_source(existing, snapshot):
                        raise BackupError("existing archive differs from current source")
                else:
                    create_archive(repo.joinpath(*relative.parts), relative, str(entry["completed"]),
                                   volume, marker, snapshot, is_mount)
                check_volume(volume, device, marker, is_mount)
                entry.update({"state": "complete", "archive": str(relative), "volumeId": volume_id, "lastError": None})
                write_json_atomic(path, entry)
                print(f"backed up: {relative}")
            except (BackupError, OSError, tarfile.TarError, ValueError, TypeError, KeyError) as error:
                entry.update({"state": "pending", "lastError": str(error)})
                write_json_atomic(path, entry)
                failures += 1
                print(f"backup failed: {entry.get('source')}: {error}", file=sys.stderr)
        return 1 if failures else 0


def status(repo: Path) -> int:
    entries = load_entries(repo)
    counts: dict[str, int] = {}
    for _, entry in entries:
        counts[str(entry.get("state", "pending"))] = counts.get(str(entry.get("state", "pending")), 0) + 1
    print(" ".join(f"{key}={value}" for key, value in sorted(counts.items())) or "no registered experiments")
    for _, entry in entries:
        suffix = f" ({entry['lastError']})" if entry.get("lastError") else ""
        print(f"{entry.get('state', 'pending')}: {entry['source']}{suffix}")
    return 0


def verify(repo: Path, value: str, volume: Path, is_mount: Callable[[str], bool] = os.path.ismount) -> int:
    relative = validated_relative(value, repo, require_source=False)
    if not mount_ready(volume, is_mount):
        raise BackupError(f"initialized removable volume unavailable: {volume}")
    marker_bytes(volume)
    verify_archive(archive_dir(volume, relative), relative)
    print(f"verified: {relative}")
    return 0


def restore(repo: Path, value: str, volume: Path, target: Path, is_mount: Callable[[str], bool] = os.path.ismount) -> int:
    relative = validated_relative(value, repo, require_source=False)
    if not mount_ready(volume, is_mount):
        raise BackupError(f"initialized removable volume unavailable: {volume}")
    marker_bytes(volume)
    directory = archive_dir(volume, relative)
    manifest = verify_archive(directory, relative)
    target.mkdir()
    output = target.joinpath(*relative.parts)
    try:
        with tarfile.open(directory / "payload.tar", "r") as archive:
            members = safe_members(archive, relative)
            archive.extractall(target, members=members, filter="data")
        restored = source_entries(output, relative)
        for entry, expected in zip(restored, manifest["entries"], strict=True):
            if {**entry, "mode": expected["mode"]} != expected:
                raise BackupError(f"restored content differs: {entry['path']}")
    except Exception:
        shutil.rmtree(target)
        raise
    print(f"restored: {output}")
    return 0


def init_volume(volume: Path, is_mount: Callable[[str], bool] = os.path.ismount) -> int:
    if not volume.is_absolute() or volume.is_symlink() or not volume.is_dir() or not is_mount(str(volume)):
        raise BackupError("init-volume requires an existing mounted absolute volume root")
    marker = volume / VOLUME_MARKER
    if marker.exists():
        marker_bytes(volume)
        print(f"backup volume already initialized: {volume}")
        return 0
    write_json_atomic(marker, {"formatVersion": FORMAT_VERSION, "volumeId": uuid.uuid4().hex,
                               "createdAt": dt.datetime.now(dt.UTC).isoformat()}, create_parent=False)
    print(f"backup volume initialized: {volume}")
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--volume", type=Path, default=Path(os.environ.get("ISEKAI_BACKUP_VOLUME", "/Volumes/HOME")))
    commands = result.add_subparsers(dest="command", required=True)
    enqueue_command = commands.add_parser("enqueue")
    enqueue_command.add_argument("directory")
    enqueue_command.add_argument("--completed")
    commands.add_parser("status")
    commands.add_parser("run")
    commands.add_parser("discover")
    verify_command = commands.add_parser("verify")
    verify_command.add_argument("directory")
    restore_command = commands.add_parser("restore")
    restore_command.add_argument("directory")
    restore_command.add_argument("--to", required=True, type=Path)
    commands.add_parser("init-volume")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    repo, volume = project_root(), args.volume
    try:
        if args.command == "enqueue": return enqueue(repo, args.directory, args.completed)
        if args.command == "status": return status(repo)
        if args.command == "run": return run(repo, volume)
        if args.command == "discover": return discover(repo)
        if args.command == "verify": return verify(repo, args.directory, volume)
        if args.command == "restore": return restore(repo, args.directory, volume, args.to)
        if args.command == "init-volume": return init_volume(volume)
    except (BackupError, OSError, tarfile.TarError, ValueError, TypeError, KeyError) as error:
        print(f"experiment backup: {error}", file=sys.stderr)
        return 2
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main())
