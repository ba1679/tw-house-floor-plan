#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""跑完 examples/ 底下所有 spec：展開 → 驗證 → 渲染。任何一份有 error 就 exit 1。"""
import glob
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "examples", "out")
SYMBOLS = os.path.abspath(os.path.join(BASE, "..", "..", "..", "data", "symbols.sample.json"))


def run(*cmd):
    return subprocess.call([sys.executable] + list(cmd))


def write_preview():
    """把所有 SVG 併成一頁，方便一次目視檢查。"""
    css = ("body{font-family:system-ui;background:#e9e7e2;margin:0;padding:24px}"
           "h2{font-size:15px;margin:24px 0 8px}"
           ".card{background:#fff;padding:12px;border-radius:6px;"
           "box-shadow:0 1px 4px rgba(0,0,0,.15)}svg{max-width:100%;height:auto;display:block}")
    parts = ['<meta charset="utf-8"><title>floorplan examples</title><style>%s</style>' % css]
    for svg in sorted(glob.glob(os.path.join(OUT, "*.svg"))):
        with open(svg, encoding="utf-8") as fh:
            parts.append("<h2>%s</h2><div class='card'>%s</div>"
                         % (os.path.basename(svg), fh.read()))
    with open(os.path.join(OUT, "_preview.html"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts))


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    failed = []
    for spec in sorted(glob.glob(os.path.join(BASE, "examples", "*.json"))):
        name = os.path.splitext(os.path.basename(spec))[0]
        plan = os.path.join(OUT, name + ".plan.json")
        svg = os.path.join(OUT, name + ".svg")
        sys.stderr.write("──── %s\n" % name)
        if run(os.path.join(BASE, "scripts", "expand_layout.py"), spec, "-o", plan) != 0:
            failed.append(name)
            continue
        args = [os.path.join(BASE, "scripts", "validate_floorplan.py"), plan]
        if os.path.exists(SYMBOLS):
            args += ["--symbols", SYMBOLS]
        if run(*args) != 0:
            failed.append(name)
            continue
        run(os.path.join(BASE, "scripts", "render_svg.py"), plan, "-o", svg)
    write_preview()
    sys.stderr.write("\n%s\n" % ("✗ 失敗: " + ", ".join(failed) if failed else "✓ 全部範例通過"))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
