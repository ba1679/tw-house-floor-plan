#!/usr/bin/env python3
"""Keep the teaching fragment reproducible and geometrically valid at build time."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / ".claude/skills/floorplan-generator/scripts"
SOURCE = ROOT / "data/practice/bedroom-fragment.layout.json"
PRODUCT = ROOT / "data/practice/bedroom-fragment.floorplan.json"
SYMBOLS = ROOT / "data/symbols.sample.json"


def run(*args):
    result = subprocess.run([sys.executable, *map(str, args)], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        print(result.stdout + result.stderr, file=sys.stderr)
    return result.returncode


def main():
    if not SOURCE.is_file() or not PRODUCT.is_file():
        print("判讀練習缺少原始描述或生成圖面", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as folder:
        regenerated = Path(folder) / "bedroom-fragment.floorplan.json"
        if run(GENERATOR / "expand_layout.py", SOURCE, "-o", regenerated):
            return 1
        try:
            expected = json.loads(regenerated.read_text(encoding="utf-8"))
            actual = json.loads(PRODUCT.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            print("判讀練習圖面無法讀取：%s" % exc, file=sys.stderr)
            return 1
        # Only this timestamp is intentionally different on every generation.
        expected.pop("generated_at", None)
        actual.pop("generated_at", None)
        if actual != expected:
            print("判讀練習圖面與原始描述不一致；請重新執行 expand_layout.py", file=sys.stderr)
            return 1
    return run(GENERATOR / "validate_floorplan.py", PRODUCT, "--symbols", SYMBOLS)


if __name__ == "__main__":
    sys.exit(main())
