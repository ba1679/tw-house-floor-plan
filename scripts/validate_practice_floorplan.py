#!/usr/bin/env python3
"""Keep practice fragments reproducible and geometrically valid at build time."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / ".claude/skills/floorplan-generator/scripts"
FIGURES = (
    ("判讀練習", ROOT / "data/practice/bedroom-fragment.layout.json", ROOT / "data/practice/bedroom-fragment.floorplan.json"),
)
SYMBOLS = ROOT / "data/symbols.sample.json"


def run(*args):
    result = subprocess.run([sys.executable, *map(str, args)], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        print(result.stdout + result.stderr, file=sys.stderr)
    return result.returncode


def main():
    for label, source, product in FIGURES:
        if not source.is_file() or not product.is_file():
            print("%s缺少原始描述或生成圖面" % label, file=sys.stderr)
            return 1
        with tempfile.TemporaryDirectory() as folder:
            regenerated = Path(folder) / product.name
            if run(GENERATOR / "expand_layout.py", source, "-o", regenerated):
                return 1
            try:
                expected = json.loads(regenerated.read_text(encoding="utf-8"))
                actual = json.loads(product.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                print("%s圖面無法讀取：%s" % (label, exc), file=sys.stderr)
                return 1
            # Only this timestamp is intentionally different on every generation.
            expected.pop("generated_at", None)
            actual.pop("generated_at", None)
            if actual != expected:
                print("%s圖面與原始描述不一致；請重新執行 expand_layout.py" % label, file=sys.stderr)
                return 1
        if run(GENERATOR / "validate_floorplan.py", product, "--symbols", SYMBOLS):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
