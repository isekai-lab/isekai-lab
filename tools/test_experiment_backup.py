#!/usr/bin/env python3
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
import experiment_backup as backup
from experiment_discovery import completed_runs


class ExperimentBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.volume = self.root / "volume"
        self.volume.mkdir()
        self.mounts = {str(self.volume)}
        self.source_relative = "hd-2d/results/2026-11-01/finished-run"
        self.source = self.repo / self.source_relative
        self.source.mkdir(parents=True)
        content = self.source / "result.txt"
        content.write_text("finished\n")
        content.chmod(0o751)
        (self.source / "same-link").symlink_to("result.txt")
        backup.init_volume(self.volume, self.is_mount)

    def tearDown(self):
        self.temp.cleanup()

    def is_mount(self, value): return value in self.mounts

    def test_absent_volume_defers_and_repeat_is_idempotent(self):
        backup.enqueue(self.repo, self.source_relative, "2026-11-01")
        backup.enqueue(self.repo, self.source_relative, "2026-11-01")
        self.mounts.clear()
        self.assertEqual(0, backup.run(self.repo, self.volume, self.is_mount))
        entries = backup.load_entries(self.repo)
        self.assertEqual(1, len(entries))
        self.assertEqual("pending", entries[0][1]["state"])
        self.mounts.add(str(self.volume))
        self.assertEqual(0, backup.run(self.repo, self.volume, self.is_mount))
        self.assertEqual(0, backup.run(self.repo, self.volume, self.is_mount))
        self.assertEqual("complete", backup.load_entries(self.repo)[0][1]["state"])

    def test_round_trip_preserves_relative_path_mode_and_link(self):
        backup.enqueue(self.repo, self.source_relative, "2026-11-01")
        backup.run(self.repo, self.volume, self.is_mount)
        shutil.rmtree(self.source)
        backup.verify(self.repo, self.source_relative, self.volume, self.is_mount)
        restored = self.root / "restored"
        backup.restore(self.repo, self.source_relative, self.volume, restored, self.is_mount)
        output = restored / self.source_relative
        self.assertEqual("finished\n", (output / "result.txt").read_text())
        self.assertEqual(Path("result.txt"), (output / "same-link").readlink())
        self.assertEqual(0o751, stat.S_IMODE((output / "result.txt").stat().st_mode))

    def test_corruption_is_detected(self):
        backup.enqueue(self.repo, self.source_relative, "2026-11-01")
        backup.run(self.repo, self.volume, self.is_mount)
        payload = backup.archive_dir(self.volume, Path(self.source_relative)) / "payload.tar"
        payload.write_bytes(b"corrupt")
        with self.assertRaises(backup.BackupError):
            backup.verify(self.repo, self.source_relative, self.volume, self.is_mount)

    def test_rejects_unsafe_paths_and_unmounted_init(self):
        for value in ("../x", "hd-2d/results", "/hd-2d/results/x", "docs/x"):
            with self.assertRaises(backup.BackupError): backup.validated_relative(value, self.repo)
        ordinary = self.root / "ordinary"
        ordinary.mkdir()
        with self.assertRaises(backup.BackupError): backup.init_volume(ordinary, self.is_mount)
        self.mounts.clear()
        with self.assertRaises(backup.BackupError):
            backup.verify(self.repo, self.source_relative, self.volume, self.is_mount)

    def test_discovery_ignores_active_runs_and_unrelated_evidence(self):
        iterations = self.repo / "hd-2d/iterations"
        record = iterations / "cycles/finished-run/decision.json"
        record.parent.mkdir(parents=True)
        active = iterations / "state.json"
        active.write_text(json.dumps({"cycleId": "finished-run", "status": "active"}))
        record.write_text(json.dumps({
            "cycleId": "finished-run",
            "completedAt": "2026-11-01T00:00:00Z",
            "operation": {"status": "completed"},
            "evidence": [{"path": self.source_relative + "/result.txt"}],
        }))
        after = datetime(2026, 11, 1, 2, tzinfo=timezone.utc)
        self.assertEqual([], completed_runs(self.repo, after))
        active.write_text(json.dumps({"cycleId": "finished-run", "status": "finished"}))
        before = datetime(2026, 11, 1, 0, 30, tzinfo=timezone.utc)
        self.assertEqual([], completed_runs(self.repo, before))
        self.assertEqual([(self.source_relative, "2026-11-01")], completed_runs(self.repo, after))

    def test_archive_run_lock_does_not_block_registration(self):
        with backup.queue_lock(self.repo, blocking=False, name="run") as locked:
            self.assertTrue(locked)
            backup.enqueue(self.repo, self.source_relative, "2026-11-01")
            self.assertEqual(0, backup.run(self.repo, self.volume, self.is_mount))
        self.assertEqual("pending", backup.load_entries(self.repo)[0][1]["state"])

    def test_rejects_nested_git_and_credentials(self):
        (self.source / ".git").mkdir()
        with self.assertRaises(backup.BackupError):
            backup.source_entries(self.source, Path(self.source_relative))
        shutil.rmtree(self.source / ".git")
        (self.source / ".env").write_text("token=secret\n")
        with self.assertRaises(backup.BackupError):
            backup.source_entries(self.source, Path(self.source_relative))

    def test_existing_different_archive_remains_pending(self):
        backup.enqueue(self.repo, self.source_relative, "2026-11-01")
        backup.run(self.repo, self.volume, self.is_mount)
        (self.source / "result.txt").write_text("changed\n")
        queue_path, entry = backup.load_entries(self.repo)[0]
        entry["state"] = "pending"
        backup.write_json_atomic(queue_path, entry)
        self.assertEqual(1, backup.run(self.repo, self.volume, self.is_mount))
        entry = backup.load_entries(self.repo)[0][1]
        self.assertEqual("pending", entry["state"])
        self.assertIn("differs", entry["lastError"])


if __name__ == "__main__":
    unittest.main()
