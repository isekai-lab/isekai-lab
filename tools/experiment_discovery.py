"""Find experiments with a terminal record written by the iteration tools."""

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath


RESULTS = PurePosixPath("hd-2d/results")
ART_RUNS = PurePosixPath("hd-2d/art-rsi/runs")
SETTLE_TIME = timedelta(hours=1)


def read_record(path):
    try:
        if path.resolve() != path or not path.is_file():
            return {}
        record = json.loads(path.read_text(encoding="utf-8"))
        return record if isinstance(record, dict) else {}
    except (OSError, ValueError, RuntimeError):
        return {}


def completed_date(value, now):
    if not isinstance(value, str):
        return None
    try:
        finished = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if finished.tzinfo is None or now - finished < SETTLE_TIME:
        return None
    return finished.date().isoformat()


def background_runs(repo, now):
    iterations = repo / "hd-2d/iterations"
    current = read_record(iterations / "state.json")
    controller = read_record(repo / ".local/hd2d-continuous/state.json")
    if not current.get("cycleId") or not current.get("status"):
        return
    for file in sorted((iterations / "cycles").glob("*/decision.json")):
        decision = read_record(file)
        cycle = decision.get("cycleId")
        operation = decision.get("operation")
        if cycle != file.parent.name or not isinstance(operation, dict) or operation.get("status") != "completed":
            continue
        if cycle == current.get("cycleId") and current.get("status") != "finished":
            continue
        if cycle == controller.get("currentIntervalId") and controller.get("status") == "active":
            continue
        date = completed_date(decision.get("completedAt"), now)
        evidence = decision.get("evidence")
        if not date or not isinstance(evidence, list):
            continue
        for item in evidence:
            raw = item.get("path") if isinstance(item, dict) else None
            if not isinstance(raw, str):
                continue
            path = PurePosixPath(raw)
            parts = path.parts
            if (
                len(parts) >= 5
                and parts[:2] == RESULTS.parts
                and re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[2])
                and parts[3] == cycle
                and ".." not in parts
                and (repo / path).is_file()
            ):
                yield str(PurePosixPath(*parts[:4])), date


def art_runs(repo, now):
    active = read_record(repo / "hd-2d/art-rsi/iterations/ACTIVE.json")
    for file in sorted((repo / ART_RUNS).glob("*/state.json")):
        state = read_record(file)
        name = file.parent.name
        if (
            state.get("run_id") != name
            or state.get("operational_state") != "complete"
            or active.get("run_id") == name
        ):
            continue
        receipt = read_record(file.with_name("evidence-summary.json"))
        date = completed_date(receipt.get("completed_at"), now)
        if date and receipt.get("immutable_receipts"):
            yield str(ART_RUNS / name), date


def completed_runs(repo, now=None):
    repo = repo.resolve()
    now = now or datetime.now(timezone.utc)
    runs = dict(background_runs(repo, now))
    runs.update(art_runs(repo, now))
    return sorted(runs.items())
