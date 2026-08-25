#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
floorplan.json → SVG

這支是「冒煙測試 renderer」：它的第一個任務是證明 JSON 畫得出來，
第二個任務才是好看。正式站上的 React <FloorPlanRenderer> 應該讀同一份 JSON，
畫法可以不同，但不得反過來修改 JSON——JSON 是唯一 source of truth。

座標直接沿用 cm，靠 viewBox 縮放，所以 SVG 座標 = 世界座標，
hotspot 的 coords 不需要任何換算就能疊上去。

用法:
    python3 render_svg.py <floorplan.json> [-o out.svg] [--show-hotspots]
"""
import argparse
import io
import json
import math

M = 110  # 圖面留白（cm），放尺寸線

PALETTE = {
    "paper": "#ffffff", "room": "#f4f2ed", "room_wet": "#eaf0f2",
    "room_balcony": "#eef1e9", "wall": "#2b2b2b", "line": "#4a4a4a",
    "furn": "#ffffff", "furn_line": "#8a8a8a", "text": "#2b2b2b",
    "muted": "#7a7a7a", "hotspot": "#c8622b",
}
WET = {"bathroom", "kitchen"}


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def room_fill(t):
    if t in WET:
        return PALETTE["room_wet"]
    if t == "balcony":
        return PALETTE["room_balcony"]
    return PALETTE["room"]


def wall_rect(w):
    t = w["thickness"]
    s, e = w["start"], w["end"]
    if w["orientation"] == "horizontal":
        return s["x"] - t / 2.0, s["y"] - t / 2.0, (e["x"] - s["x"]) + t, t
    return s["x"] - t / 2.0, s["y"] - t / 2.0, t, (e["y"] - s["y"]) + t


def opening_box(op, wall, pad=1.0):
    """開口在牆上佔的那一段（用來把牆挖空）。"""
    t = wall["thickness"] + pad * 2
    s = wall["start"]
    if wall["orientation"] == "horizontal":
        return s["x"] + op["offset"], s["y"] - t / 2.0, op["width"], t
    return s["x"] - t / 2.0, s["y"] + op["offset"], t, op["width"]


def render(plan, show_hotspots=False):
    B = plan["bounds"]
    W, H = B["width"], B["height"]
    wall_by_id = dict((w["id"], w) for w in plan["walls"])
    room_by_id = dict((r["id"], r) for r in plan["rooms"])
    fs = max(20, int(W * 0.026))          # 基準字級
    out = []
    a = out.append

    a('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" width="100%%" '
      'font-family="-apple-system, \'Noto Sans TC\', sans-serif">'
      % (-M, -M, W + 2 * M, H + 2 * M))
    a('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>'
      % (-M, -M, W + 2 * M, H + 2 * M, PALETTE["paper"]))

    # --- 房間 ---
    a('<g id="rooms">')
    for r in plan["rooms"]:
        g = r["geometry"]
        a('<rect id="%s" data-room-type="%s" x="%d" y="%d" width="%d" height="%d" fill="%s"/>'
          % (r["id"], r["type"], g["x"], g["y"], g["width"], g["height"], room_fill(r["type"])))
    a('</g>')

    # --- 牆（先畫實體，再挖開口） ---
    a('<g id="walls">')
    for w in plan["walls"]:
        x, y, ww, hh = wall_rect(w)
        a('<rect id="%s" data-wall-type="%s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>'
          % (w["id"], w["type"], x, y, ww, hh, PALETTE["wall"]))
    for op in plan["doors"] + plan["windows"]:
        wl = wall_by_id[op["wall_id"]]
        x, y, ww, hh = opening_box(op, wl)
        a('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>'
          % (x, y, ww, hh, PALETTE["paper"]))
    a('</g>')

    # --- 門 ---
    a('<g id="doors" fill="none" stroke="%s" stroke-width="4">' % PALETTE["line"])
    for d in plan["doors"]:
        wl = wall_by_id[d["wall_id"]]
        s = wl["start"]
        horiz = wl["orientation"] == "horizontal"
        if horiz:
            x0, y0 = s["x"] + d["offset"], s["y"]
            x1, y1 = x0 + d["width"], y0
        else:
            x0, y0 = s["x"], s["y"] + d["offset"]
            x1, y1 = x0, y0 + d["width"]

        if d["type"] == "sliding":
            off = wl["thickness"] * 0.55
            if horiz:
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="7"/>'
                  % (x0, y0 - off, x0 + d["width"] * 0.55, y0 - off))
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="7"/>'
                  % (x1 - d["width"] * 0.55, y0 + off, x1, y0 + off))
            else:
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="7"/>'
                  % (x0 - off, y0, x0 - off, y0 + d["width"] * 0.55))
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="7"/>'
                  % (x0 + off, y1 - d["width"] * 0.55, x0 + off, y1))
            continue

        # 平開門：門扇 + 開啟弧線。幾何由 expand_layout.py 算好放在 swing_arc，
        # renderer 不重算——三邊各自推導遲早會漂移。
        arc = d.get("swing_arc")
        if not arc:
            continue
        hx, hy = arc["hinge"]["x"], arc["hinge"]["y"]
        R = arc["radius"]
        tip = (hx + arc["open"]["x"] * R, hy + arc["open"]["y"] * R)
        far = (hx + arc["along"]["x"] * R, hy + arc["along"]["y"] * R)
        cross = (tip[0] - hx) * (far[1] - hy) - (tip[1] - hy) * (far[0] - hx)
        sweep = 1 if cross < 0 else 0
        a('<g id="%s" data-door-type="%s">' % (d["id"], d["type"]))
        a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (hx, hy, tip[0], tip[1]))
        a('<path d="M %.1f %.1f A %d %d 0 0 %d %.1f %.1f" stroke-dasharray="14 10" stroke-width="3"/>'
          % (tip[0], tip[1], R, R, sweep, far[0], far[1]))
        a('</g>')
    a('</g>')

    # --- 窗 ---
    a('<g id="windows" stroke="%s" fill="none">' % PALETTE["line"])
    for wn in plan["windows"]:
        wl = wall_by_id[wn["wall_id"]]
        s, t = wl["start"], wl["thickness"]
        a('<g id="%s">' % wn["id"])
        if wl["orientation"] == "horizontal":
            x0 = s["x"] + wn["offset"]
            for k, sw in ((-t / 2.0, 4), (0, 3), (t / 2.0, 4)):
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%d"/>'
                  % (x0, s["y"] + k, x0 + wn["width"], s["y"] + k, sw))
        else:
            y0 = s["y"] + wn["offset"]
            for k, sw in ((-t / 2.0, 4), (0, 3), (t / 2.0, 4)):
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%d"/>'
                  % (s["x"] + k, y0, s["x"] + k, y0 + wn["width"], sw))
        a('</g>')
    a('</g>')

    # --- 傢俱 ---
    a('<g id="furniture" fill="%s" stroke="%s" stroke-width="3">' % (PALETTE["furn"], PALETTE["furn_line"]))
    for f in plan["furniture"]:
        g = f["geometry"]
        cx, cy = g["x"] + g["width"] / 2.0, g["y"] + g["height"] / 2.0
        a('<g id="%s" data-furniture-type="%s">' % (f["id"], f["type"]))
        if f["type"] in ("toilet", "sink"):
            a('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f"/>'
              % (cx, cy, g["width"] / 2.0, g["height"] / 2.0))
        else:
            rx = 6 if f["type"] in ("bed", "single_bed", "sofa", "bathtub") else 2
            a('<rect x="%d" y="%d" width="%d" height="%d" rx="%d"/>'
              % (g["x"], g["y"], g["width"], g["height"], rx))
        if f["type"] in ("bed", "single_bed"):        # 枕頭側
            if f["rotation"] in (0, 180):
                yy = g["y"] + (g["height"] * 0.22 if f["rotation"] == 0 else g["height"] * 0.78)
                a('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                  % (g["x"], yy, g["x"] + g["width"], yy))
            else:
                xx = g["x"] + (g["width"] * 0.22 if f["rotation"] == 90 else g["width"] * 0.78)
                a('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
                  % (xx, g["y"], xx, g["y"] + g["height"]))
        if f["type"] == "sofa":                       # 椅背
            if f["rotation"] in (0, 180):
                yy = g["y"] + (g["height"] * 0.25 if f["rotation"] == 0 else g["height"] * 0.75)
                a('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                  % (g["x"], yy, g["x"] + g["width"], yy))
            else:
                xx = g["x"] + (g["width"] * 0.25 if f["rotation"] == 90 else g["width"] * 0.75)
                a('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
                  % (xx, g["y"], xx, g["y"] + g["height"]))
        if f["type"] == "shower":
            a('<line x1="%d" y1="%d" x2="%d" y2="%d"/>'
              % (g["x"], g["y"], g["x"] + g["width"], g["y"] + g["height"]))
            a('<line x1="%d" y1="%d" x2="%d" y2="%d"/>'
              % (g["x"] + g["width"], g["y"], g["x"], g["y"] + g["height"]))
        a('</g>')
    a('</g>')

    # --- 房間名稱 ---
    # 名稱壓在傢俱線上會看不清楚，用白色描邊當底
    a('<g id="room-labels" text-anchor="middle" fill="%s" stroke="%s" stroke-width="%d" '
      'stroke-linejoin="round" paint-order="stroke">'
      % (PALETTE["text"], PALETTE["paper"], max(8, int(fs * 0.42))))
    for r in plan["rooms"]:
        g = r["geometry"]
        cx = g["x"] + g["width"] / 2.0
        cy = g["y"] + g["height"] / 2.0
        a('<text x="%.1f" y="%.1f" font-size="%d" font-weight="600">%s</text>'
          % (cx, cy, fs, esc(r["name"])))
        a('<text x="%.1f" y="%.1f" font-size="%d" fill="%s">%.1f 坪</text>'
          % (cx, cy + fs * 1.2, int(fs * 0.72), PALETTE["muted"], r["area_ping"]))
    a('</g>')

    # --- 尺寸線 ---
    a('<g id="annotations" stroke="%s" fill="%s" stroke-width="2">' % (PALETTE["muted"], PALETTE["muted"]))
    dy = -M * 0.45
    a('<line x1="0" y1="%.1f" x2="%d" y2="%.1f"/>' % (dy, W, dy))
    for xx in (0, W):
        a('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (xx, dy - 14, xx, dy + 14))
    a('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="middle" stroke="none">%d cm</text>'
      % (W / 2.0, dy - 22, int(fs * 0.78), W))
    dx = -M * 0.45
    a('<line x1="%.1f" y1="0" x2="%.1f" y2="%d"/>' % (dx, dx, H))
    for yy in (0, H):
        a('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (dx - 14, yy, dx + 14, yy))
    a('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="middle" stroke="none" '
      'transform="rotate(-90 %.1f %.1f)">%d cm</text>'
      % (dx - 22, H / 2.0, int(fs * 0.78), dx - 22, H / 2.0, H))
    a('</g>')

    # --- 標題 / 面積假設 ---
    am = plan.get("area_meta") or {}
    a('<text x="0" y="%.1f" font-size="%d" font-weight="700" fill="%s">%s</text>'
      % (H + M * 0.5, int(fs * 0.95), PALETTE["text"], esc(plan["name"])))
    if am.get("deed_ping"):
        a('<text x="0" y="%.1f" font-size="%d" fill="%s">權狀 %s 坪 ／ 公設比 %.0f%% ／ '
          '室內 %.1f 坪（%.1f m²）</text>'
          % (H + M * 0.82, int(fs * 0.68), PALETTE["muted"], am["deed_ping"],
             (am.get("public_ratio") or 0) * 100, am["interior_ping"], am["interior_m2"]))

    # --- hotspot 圖層（PRD §7.3，viewer 直接用） ---
    style = ('fill="none" stroke="%s" stroke-width="4" stroke-dasharray="12 8"' % PALETTE["hotspot"]) \
        if show_hotspots else 'fill="transparent" stroke="none"'
    a('<g id="hotspots" %s>' % style)
    for h in plan["hotspots"]:
        c = h["coords"]
        attrs = 'id="%s" data-symbol-id="%s" data-source="%s"' % (
            h["id"], h["symbol_id"] if h["symbol_id"] else "", h.get("source", ""))
        if h["shape"] == "circle":
            a('<circle %s cx="%d" cy="%d" r="%d"/>' % (attrs, c[0], c[1], c[2]))
        elif h["shape"] == "rect":
            a('<rect %s x="%d" y="%d" width="%d" height="%d"/>' % (attrs, c[0], c[1], c[2], c[3]))
        else:
            pts = " ".join("%d,%d" % (c[i], c[i + 1]) for i in range(0, len(c), 2))
            a('<polygon %s points="%s"/>' % (attrs, pts))
    a('</g>')

    a('</svg>')
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("-o", "--out")
    ap.add_argument("--show-hotspots", action="store_true")
    args = ap.parse_args()
    plan = json.load(io.open(args.plan, encoding="utf-8"))
    svg = render(plan, args.show_hotspots)
    if args.out:
        io.open(args.out, "w", encoding="utf-8").write(svg + "\n")
    else:
        print(svg)


if __name__ == "__main__":
    main()
