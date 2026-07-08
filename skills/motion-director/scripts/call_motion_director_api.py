from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--product", required=True)
    parser.add_argument("--captures", nargs="*", default=[])
    parser.add_argument("--audio")
    parser.add_argument("--duration", type=float, default=28)
    parser.add_argument("--vibe", default="mysterious premium tech, fast beat cuts")
    parser.add_argument("--url", default=os.environ.get("MOTION_DIRECTOR_URL", "http://127.0.0.1:3000"))
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args()

    payload = {
        "repoPath": str(Path(args.repo).resolve()),
        "productName": args.product,
        "durationSeconds": args.duration,
        "vibe": args.vibe,
        "referenceStyle": "Cursorful-like focal zooms with side callouts",
        "captures": args.captures,
        "audio": {"path": args.audio} if args.audio else {},
        "render": args.render,
    }

    headers = {"Content-Type": "application/json"}
    key = os.environ.get("MOTION_DIRECTOR_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"

    req = Request(
        f"{args.url}/api/v1/generate-launch-film",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urlopen(req, timeout=60) as response:
        print(response.read().decode("utf-8"))


if __name__ == "__main__":
    main()
