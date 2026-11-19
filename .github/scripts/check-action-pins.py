#!/usr/bin/env python3
"""Fail if a GitHub Actions `uses:` is not pinned to an immutable ref.

Remote actions must use a full 40-hex commit SHA and a version comment such
as `# v1.2.3`. Tags, branches, and short SHAs fail. Local `./` actions are
allowed. `docker://` actions must include a `sha256` digest.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SCAN_GLOBS = (
    ".github/workflows/**/*.yml",
    ".github/workflows/**/*.yaml",
    ".github/actions/**/*.yml",
    ".github/actions/**/*.yaml",
    ".github/**/action.yml",
    ".github/**/action.yaml",
)

USES_LINE = re.compile(
    r"^\s*(?:-\s*)?uses:\s*(.+?)\s*$"
)
FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
HEX_SHA = re.compile(r"^[0-9a-fA-F]+$")
TAG_REF = re.compile(r"^v?\d+(?:\.\d+)*(?:[-+][\w.]+)?$")
VERSION_COMMENT = re.compile(r"(?:^|\s)v\d+(?:\.\d+)*(?:[-+][\w.]+)?\b")
DOCKER_DIGEST = re.compile(r"@sha256:[0-9a-f]{64}$")


def workflow_files(root: Path = ROOT) -> list[Path]:
    files: set[Path] = set()
    for pattern in SCAN_GLOBS:
        files.update(path for path in root.glob(pattern) if path.is_file())
    return sorted(files)


def split_uses(line: str) -> tuple[str, str | None] | None:
    """Return (value, comment) for a step `uses:` line, else None."""
    stripped = line.lstrip()
    if stripped.startswith("#"):
        return None
    code, sep, comment = line.partition("#")
    match = USES_LINE.match(code.rstrip())
    if not match:
        return None
    value = match.group(1).strip().strip("'\"")
    if not value:
        return None
    note = comment.strip() if sep else None
    return value, note or None


def pin_error(value: str, comment: str | None) -> str | None:
    """Return an error string when `value` is not an allowed pin."""
    if value.startswith("./"):
        return None

    if value.startswith("docker://"):
        if DOCKER_DIGEST.search(value):
            return None
        return "docker:// action is not pinned to a sha256 digest"

    if "@" not in value:
        return "remote action has no ref"

    ref = value.rsplit("@", 1)[1]
    if FULL_SHA.fullmatch(ref):
        if comment is None or VERSION_COMMENT.search(comment) is None:
            return "full SHA pin is missing a version comment (example: # v1.2.3)"
        return None
    if HEX_SHA.fullmatch(ref) and len(ref) == 40:
        return "commit SHA must be 40 lowercase hex characters"
    if HEX_SHA.fullmatch(ref):
        return f"short SHA {ref!r} is not a full 40-hex commit SHA"
    if TAG_REF.fullmatch(ref):
        return f"tag {ref!r} is not a full commit SHA"
    return f"ref {ref!r} is a branch, tag, or other unpinned ref"


def find_problems(root: Path = ROOT) -> list[str]:
    problems: list[str] = []
    files = workflow_files(root)
    if not files:
        return ["no GitHub Actions workflow files found under .github/"]
    for path in files:
        for lineno, line in enumerate(path.read_text().splitlines(), 1):
            parsed = split_uses(line)
            if parsed is None:
                continue
            value, comment = parsed
            reason = pin_error(value, comment)
            if reason:
                rel = path.relative_to(root)
                problems.append(f"{rel}:{lineno}: {reason}: {value}")
    return problems


def main() -> int:
    problems = find_problems()
    if problems:
        print("Unpinned GitHub Actions references:", file=sys.stderr)
        for problem in problems:
            print(problem, file=sys.stderr)
        return 1
    checked = len(workflow_files())
    print(f"All remote actions are pinned ({checked} file(s) checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
