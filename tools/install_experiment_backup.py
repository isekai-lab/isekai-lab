"""Install this checkout's periodic backup as a per-user macOS LaunchAgent."""

import argparse
import os
import plistlib
import subprocess
import sys
from pathlib import Path


LABEL = "com.isekai-lab.experiment-backup"
LAUNCHCTL = "/bin/launchctl"
REPO = Path(__file__).resolve().parent.parent


def install(volume):
    if sys.platform != "darwin":
        raise ValueError("LaunchAgent installation requires macOS")
    if not volume.is_absolute():
        raise ValueError("the volume path must be absolute")

    domain = f"gui/{os.getuid()}"
    service = f"{domain}/{LABEL}"
    subprocess.run([LAUNCHCTL, "print", domain], stdout=subprocess.DEVNULL, check=True)
    agents = Path.home() / "Library/LaunchAgents"
    local_state = REPO / ".local/experiment-backup"
    agents.mkdir(parents=True, exist_ok=True)
    local_state.mkdir(parents=True, exist_ok=True)
    job = {
        "Label": LABEL,
        "ProgramArguments": [
            sys.executable,
            "-B",
            str(REPO / "tools/experiment_backup.py"),
            "--volume",
            str(volume),
            "run",
        ],
        "WorkingDirectory": str(REPO),
        "StartCalendarInterval": [{"Hour": hour, "Minute": 20} for hour in (0, 6, 12, 18)],
        "StartOnMount": True,
        "StandardOutPath": str(local_state / "launchd.log"),
        "StandardErrorPath": str(local_state / "launchd.err.log"),
    }
    plist = agents / f"{LABEL}.plist"
    data = plistlib.dumps(job)
    if plist.is_symlink():
        raise ValueError(f"refusing to replace a symlink at {plist}")
    try:
        with plist.open("xb") as output:
            output.write(data)
    except FileExistsError:
        if plist.read_bytes() != data:
            raise ValueError(f"a different LaunchAgent exists at {plist}") from None

    subprocess.run(["/usr/bin/plutil", "-lint", str(plist)], check=True)
    loaded = subprocess.run(
        [LAUNCHCTL, "print", service], capture_output=True, check=False
    )
    if loaded.returncode:
        subprocess.run([LAUNCHCTL, "bootstrap", domain, str(plist)], check=True)
    subprocess.run([LAUNCHCTL, "kickstart", service], check=True)
    print(f"Scheduled {service} using {plist}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--volume", type=Path, default=Path(os.environ.get("ISEKAI_BACKUP_VOLUME", "/Volumes/HOME"))
    )
    try:
        install(parser.parse_args().volume)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"experiment backup scheduler: {error}\n")


if __name__ == "__main__":
    main()
