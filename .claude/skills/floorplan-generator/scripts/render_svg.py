#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
floorplan.json → SVG

這支是「冒煙測試 renderer」：它的第一個任務是證明 JSON 畫得出來，
第二個任務才是好看。正式站上的 React <FloorPlanRenderer> 應該讀同一份 JSON，
畫法可以不同，但不得反過來修改 JSON——JSON 是唯一 source of truth。

座標直接沿用 cm，靠 viewBox 縮放，所以 SVG 座標 = 世界座標，
hotspot 的 coords 不需要任何換算就能疊上去。

畫法依據：《室內設計裝修製圖規範》（NAID），逐項出處見
docs/reference/naid-symbols.md。線寬階層見 LW、圖層代號見 LAYER。

用法:
    python3 render_svg.py <floorplan.json> [-o out.svg] [--show-hotspots]
"""
import argparse
import io
import json

M = 110  # 圖面留白（cm），放尺寸線

# --- 線寬階層（p47 表 24，以 S:1/50 為基準）-------------------------------
# 本專案 SVG 座標＝世界座標 cm、圖面比例 1/50，所以 stroke-width(cm) = 筆粗(mm) × 5。
# LW 存的就是這個換算後的標準值，不要在別處寫 magic number。
LW = {
    "structure_cut": 3.0,   # 0.6mm 特粗：RC／磚造主要結構剖、輪廓線—牆、梁、柱
    "structure_elev": 2.0,  # 0.4mm 粗實：主要結構立面線
    "major": 1.5,           # 0.3mm 中粗：主要裝修建材、主要家具外圍線、輕隔間
    "frame": 1.0,           # 0.2mm 中實：高程線、窗台線、門框、窗框
    "minor": 0.5,           # 0.1mm 細實：家具次要副線、尺寸標註線
    "hair": 0.25,           # 0.05mm 微細：材質剖面線、面材紋理線
}
# 表 24 的筆粗是給「列印在 1/50 圖紙上」用的，0.1mm 細實線在螢幕上等於看不見。
# 這個倍率只放大絕對值，不動相對關係——階層仍然是表 24 的階層。列印時設回 1.0。
LINE_SCALE = 2.5


def lw(key):
    return LW[key] * LINE_SCALE


# --- CAD 圖層代號（p46 表 23）---------------------------------------------
# viewer 可以直接用 data-layer 做分層開關。活動家具 FUM 與固定家具 FUF
# 在標準裡是兩個圖層——買房時「附不附」看的就是這條線。
LAYER = {
    "floor": "FL", "wall": "WL", "window": "WI", "door": "DR",
    "furn_movable": "FUM", "furn_fixed": "FUF",
    "dimension": "SI", "text": "TE",
}

PALETTE = {
    "paper": "#ffffff", "room": "#f4f4f4", "room_master": "#d4a373",
    "room_living": "#dd8b67", "room_dining_kitchen": "#faedcd",
    "room_wet_balcony": "#a3b18a",
    # 表 24 筆號 8／9：柱填深灰、牆填淺灰。牆與柱的差別在填色深淺，不在形狀。
    "wall": "#a8a8a8", "column": "#585858",
    "structure": "#2b2b2b", "line": "#4a4a4a",
    "furn": "#ffffff", "furn_line": "#8a8a8a", "text": "#2b2b2b",
    "muted": "#7a7a7a", "hotspot": "#c8622b",
}

# 高度語意（p25 表 10 備考）。平面圖是離地 120~150cm 平切下視，所以：
#   高櫃被切到 → 矩形內畫 X；吊櫃／壁掛在切面以上 → 虛線。
# 分類本身與 rules/furniture.md、expand_layout.py 的碰撞規則同源。
TALL = {"wardrobe", "refrigerator"}
WALL_MOUNTED = {"tv"}
# 固定家具（表 23 圖層 08 FUF）；其餘是活動家具（圖層 07 FUM）
FIXED_FURNITURE = {"kitchen_counter", "wardrobe", "toilet", "sink", "bathtub", "shower"}

# 空間代號（p48 表 25）。真實建案平面圖上就是這樣標，認得代號本身就是教學目標。
# hallway（走道）與 study（書房）在表 25 沒有對應代號，留空。
# 管道間：表 25 作 I.P、表 28 作 PS（Pipe Shaft）；建案平面圖上普遍寫 PS。
ROOM_CODES = {
    "living_room": "L", "dining_room": "D", "kitchen": "K",
    "bedroom": "B.R", "master_bedroom": "M.B.R", "bathroom": "W.C",
    "balcony": "BAL", "storage": "S", "entrance": "ENTRY", "pipe_shaft": "PS",
}
# 表 25 把 W.C（廁所）與 BATH（浴室）列為兩個代號，差別在有沒有洗澡的設備。
# 台灣習慣統稱「衛浴」，但標代號時要照實際配置分，否則等於教錯。
BATHING = {"shower", "bathtub"}


def room_code(room, fixtures):
    code = ROOM_CODES.get(room["type"])
    if code == "W.C" and (fixtures & BATHING):
        return "BATH"
    return code


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def room_fill(t):
    palette_key = {
        "master_bedroom": "room_master",
        "living_room": "room_living",
        "dining_room": "room_dining_kitchen",
        "kitchen": "room_dining_kitchen",
        "bathroom": "room_wet_balcony",
        "balcony": "room_wet_balcony",
    }.get(t, "room")
    return PALETTE[palette_key]


def wall_rect(w):
    t = w["thickness"]
    s, e = w["start"], w["end"]
    if w["orientation"] == "horizontal":
        return s["x"] - t / 2.0, s["y"] - t / 2.0, (e["x"] - s["x"]) + t, t
    return s["x"] - t / 2.0, s["y"] - t / 2.0, t, (e["y"] - s["y"]) + t


def opening_box(op, wall, pad=None):
    """開口在牆上佔的那一段（用來把牆挖空）。

    pad 要大於等於輪廓線的一半，否則挖完之後輪廓線的殘餘會留在開口上。
    """
    if pad is None:
        pad = lw("structure_cut") / 2.0 + 1.0
    t = wall["thickness"] + pad * 2
    s = wall["start"]
    if wall["orientation"] == "horizontal":
        return s["x"] + op["offset"], s["y"] - t / 2.0, op["width"], t
    return s["x"] - t / 2.0, s["y"] + op["offset"], t, op["width"]


def opening_frame(op, wall):
    """開口的區域座標系：原點在開口起點的牆心線上，u 沿牆、n 垂直牆。

    有了它，水平牆與垂直牆只要寫一次畫法。
    """
    s = wall["start"]
    if wall["orientation"] == "horizontal":
        return (s["x"] + op["offset"], s["y"]), (1.0, 0.0), (0.0, 1.0)
    return (s["x"], s["y"] + op["offset"]), (0.0, 1.0), (1.0, 0.0)


def pt(o, u, n, a, b):
    """區域座標 (a 沿牆, b 垂直牆) → 世界座標。"""
    return (o[0] + u[0] * a + n[0] * b, o[1] + u[1] * a + n[1] * b)


def exterior_sign(wall, bounds, n):
    """外牆的室外側落在 +n 還是 -n。

    窗只開在外牆，而外牆一定貼在 bounds 邊上，所以「離開圖面中心」就是室外。
    平開窗的開啟弧依規範向室外側開（p24 表 9）。
    """
    if wall["orientation"] == "horizontal":
        ext = (0.0, -1.0) if wall["start"]["y"] < bounds["height"] / 2.0 else (0.0, 1.0)
    else:
        ext = (-1.0, 0.0) if wall["start"]["x"] < bounds["width"] / 2.0 else (1.0, 0.0)
    return 1.0 if (ext[0] * n[0] + ext[1] * n[1]) > 0 else -1.0


def arc_sweep(open_dir, along_dir):
    """SVG sweep-flag：讓弧真的以鉸鏈為圓心掃過 90°。

    起點 tip = hinge + open×R、終點 far = hinge + along×R，兩點之間有**兩個**
    半徑相同的 90° 弧：一個以 hinge 為圓心（門扇真正掃過的），一個以對角點為
    圓心（弧會凹向鉸鏈，看起來像門往牆裡凹）。sweep-flag 決定取哪一個，
    取錯不會報錯、只會畫錯，所以這裡的正負號是實測出來的，不要憑直覺改：

        z = open × along  >0 → sweep=1；<0 → sweep=0
    """
    z = open_dir[0] * along_dir[1] - open_dir[1] * along_dir[0]
    return 1 if z > 0 else 0


def render(plan, show_hotspots=False):
    B = plan["bounds"]
    W, H = B["width"], B["height"]
    wall_by_id = dict((w["id"], w) for w in plan["walls"])
    room_by_id = dict((rm["id"], rm) for rm in plan["rooms"])
    fs = max(20, int(W * 0.026))          # 基準字級
    out = []
    a = out.append

    # 平開窗的開啟弧向室外側開（p24 表 9），半徑等於窗寬，會伸出建物之外——
    # 窗比留白寬時會被 viewBox 切掉。所以留白改成逐邊算，並保證尺寸線與圖名
    # 落在弧的外面。沒有平開窗時每邊都還是 M，構圖與過去完全相同。
    pad = {"n": M, "s": M, "e": M, "w": M}
    for wn in plan["windows"]:
        if wn.get("type") != "casement":
            continue
        wl = wall_by_id[wn["wall_id"]]
        if wl["orientation"] == "horizontal":
            side = "n" if wl["start"]["y"] < H / 2.0 else "s"
        else:
            side = "w" if wl["start"]["x"] < W / 2.0 else "e"
        pad[side] = max(pad[side], wn["width"] + wl["thickness"] / 2.0 + M)
    # 雨遮整個在建物之外，不算進留白就會被 viewBox 裁掉。
    for cp in plan.get("canopies", []):
        g = cp["geometry"]
        pad["n"] = max(pad["n"], -g["y"] + M) if g["y"] < 0 else pad["n"]
        pad["w"] = max(pad["w"], -g["x"] + M) if g["x"] < 0 else pad["w"]
        pad["s"] = max(pad["s"], g["y"] + g["height"] - H + M) if g["y"] + g["height"] > H else pad["s"]
        pad["e"] = max(pad["e"], g["x"] + g["width"] - W + M) if g["x"] + g["width"] > W else pad["e"]
    vx, vy = -pad["w"], -pad["n"]
    vw, vh = W + pad["w"] + pad["e"], H + pad["n"] + pad["s"]

    a('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" width="100%%" '
      'font-family="-apple-system, \'Noto Sans TC\', sans-serif">'
      % (vx, vy, vw, vh))
    a('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>'
      % (vx, vy, vw, vh, PALETTE["paper"]))

    # --- 雨遮：外牆之外的外挑構造 ---
    # ⚠ 這個畫法沒有標準來源。法規（建築技術規則、地籍測量實施規則）定義的是
    # 「雨遮是什麼、算不算坪數」，不是圖上怎麼畫。細實線矩形是台灣建案平面圖的
    # 普遍做法，屬 convention——不要在 symbol 上把它標成有標準明文。
    if plan.get("canopies"):
        a('<g id="canopies" fill="none" stroke="%s" stroke-width="%.2f">'
          % (PALETTE["muted"], lw("frame")))
        for cp in plan["canopies"]:
            g = cp["geometry"]
            a('<rect id="%s" x="%d" y="%d" width="%d" height="%d"/>'
              % (cp["id"], g["x"], g["y"], g["width"], g["height"]))
        a('</g>')

    # --- 房間（圖層 06 地板）---
    a('<g id="rooms" data-layer="%s">' % LAYER["floor"])
    for r in plan["rooms"]:
        g = r["geometry"]
        a('<rect id="%s" data-room-type="%s" x="%d" y="%d" width="%d" height="%d" fill="%s"/>'
          % (r["id"], r["type"], g["x"], g["y"], g["width"], g["height"], room_fill(r["type"])))
    a('</g>')

    # --- 牆（圖層 02）---
    # 表 24 筆號 9：牆填淺灰、筆號 8：柱填深灰——兩者的差別是填色深淺，不是形狀。
    # 順序：牆體填色 → 建物輪廓線 → 挖開口。輪廓線先畫，開口才能把它斷開，
    # 這正是「此一剖面均須切過該層所有門窗開口」（p44 §15.2）的畫面結果。
    a('<g id="walls" data-layer="%s">' % LAYER["wall"])
    xs, ys = [], []
    for w in plan["walls"]:
        x, y, ww, hh = wall_rect(w)
        xs += [x, x + ww]
        ys += [y, y + hh]
        a('<rect id="%s" data-wall-type="%s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>'
          % (w["id"], w["type"], x, y, ww, hh, PALETTE["wall"]))
    if xs:                                  # 建物輪廓：表 6「粗重線—輪廓線」
        a('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" '
          'stroke-width="%.2f"/>'
          % (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys),
             PALETTE["structure"], lw("structure_cut")))
    for op in plan["doors"] + plan["windows"]:
        wl = wall_by_id[op["wall_id"]]
        x, y, ww, hh = opening_box(op, wl)
        a('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>'
          % (x, y, ww, hh, PALETTE["paper"]))
    a('</g>')

    # --- 柱（圖層 02，與牆同層）---
    # 表 24 筆號 8：柱填深灰；筆號 9：牆填淺灰。差別在填色深淺，不在形狀——
    # 這正是「柱不能打掉、牆有些可以」那一課在圖上唯一看得出來的地方。
    if plan.get("columns"):
        a('<g id="columns" data-layer="%s">' % LAYER["wall"])
        for col in plan["columns"]:
            g = col["geometry"]
            a('<rect id="%s" x="%d" y="%d" width="%d" height="%d" fill="%s"/>'
              % (col["id"], g["x"], g["y"], g["width"], g["height"], PALETTE["column"]))
        a('</g>')

    # --- 門（圖層 04）---
    a('<g id="doors" data-layer="%s" fill="none" stroke="%s">' % (LAYER["door"], PALETTE["line"]))
    for d in plan["doors"]:
        wl = wall_by_id[d["wall_id"]]
        o, u, n = opening_frame(d, wl)
        t = wl["thickness"]
        a('<g id="%s" data-door-type="%s">' % (d["id"], d["type"]))

        # 門樘：牆在開口處斷開後的兩個端面
        for aa in (0.0, d["width"]):
            p0, p1 = pt(o, u, n, aa, -t / 2.0), pt(o, u, n, aa, t / 2.0)
            a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
              % (p0[0], p0[1], p1[0], p1[1], lw("frame")))

        if d["type"] == "opening":
            # 出入口（p23 表 8 第一項）：牆斷開留空、**不畫門扇**，
            # 開口中央一個小三角形記號。走道通客廳、開放式廚房這種寬開口用它——
            # 用加寬的拉門代替會畫出兩片不存在的門扇。
            # 規範沒有規定三角形的朝向，這裡朝 opens_to 那一側，讓它順帶帶一點資訊。
            sgn = 1.0
            rm = room_by_id.get(d.get("opens_to"))
            if rm:
                g = rm["geometry"]
                mid = pt(o, u, n, d["width"] / 2.0, 0.0)
                to_room = (g["x"] + g["width"] / 2.0 - mid[0], g["y"] + g["height"] / 2.0 - mid[1])
                sgn = 1.0 if (to_room[0] * n[0] + to_room[1] * n[1]) > 0 else -1.0
            bw, bh = t * 0.62, t * 0.52
            c = d["width"] / 2.0
            p0 = pt(o, u, n, c - bw, 0.0)
            p1 = pt(o, u, n, c + bw, 0.0)
            p2 = pt(o, u, n, c, sgn * bh)
            a('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" stroke="none"/>'
              % (p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], PALETTE["line"]))
            a('</g>')
            continue

        if d["type"] == "sliding":
            # 雙拉門（p23 表 8）：兩片門扇分別偏向兩端，中央一個小圓點表示交會
            off = t * 0.55
            s1a, s1b = pt(o, u, n, 0.0, -off), pt(o, u, n, d["width"] * 0.55, -off)
            s2a, s2b = pt(o, u, n, d["width"] * 0.45, off), pt(o, u, n, d["width"], off)
            for (pa, pb) in ((s1a, s1b), (s2a, s2b)):
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
                  % (pa[0], pa[1], pb[0], pb[1], lw("major")))
            c = pt(o, u, n, d["width"] * 0.5, 0.0)
            a('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke-width="%.2f"/>'
              % (c[0], c[1], t * 0.16, PALETTE["line"], lw("minor")))
            a('</g>')
            continue

        # 平開門：一片門扇一道弧。幾何由 expand_layout.py 算好放在 swing_arcs，
        # renderer 不重算——三邊各自推導遲早會漂移。
        # 單開門一片；雙開門兩片等寬，各自從兩側門樘向中央開（p23 表 8）。
        #
        # 弧畫虛線是**語意**，不是美術選擇，不要順手改成實線。p23 表 8 備考：
        #   「門扇之軌跡線如以實線表示，則可遮蔽地板材質線；
        #     如以虛線表示，則不可遮蔽之。」
        # 也就是說實線弧會蓋掉底下的地板材質線、虛線弧不會。本專案的圖之後要疊
        # 地板鋪面與 hotspot，選虛線＝宣告「這道弧不遮蔽底下的東西」。
        # （表 8 本身的圖例畫的是細實線弧，兩種都合規；虛線是這裡刻意的選擇。）
        for arc in d.get("swing_arcs") or []:
            hx, hy = arc["hinge"]["x"], arc["hinge"]["y"]
            R = arc["radius"]
            tip = (hx + arc["open"]["x"] * R, hy + arc["open"]["y"] * R)
            far = (hx + arc["along"]["x"] * R, hy + arc["along"]["y"] * R)
            a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
              % (hx, hy, tip[0], tip[1], lw("frame")))
            a('<path d="M %.1f %.1f A %d %d 0 0 %d %.1f %.1f" stroke-dasharray="14 10" '
              'stroke-width="%.2f"/>'
              % (tip[0], tip[1], R, R,
                 arc_sweep((arc["open"]["x"], arc["open"]["y"]),
                           (arc["along"]["x"], arc["along"]["y"])),
                 far[0], far[1], lw("minor")))
        a('</g>')
    a('</g>')

    # --- 窗（圖層 03）---
    # 共同構造（p24 表 9）：牆在開口處斷開，開口以一條窗框帶橫跨，兩端有窗樘記號。
    # 三種 type 的差別在框帶裡面畫幾條線、是實是虛、有沒有開啟弧。
    a('<g id="windows" data-layer="%s" stroke="%s" fill="none">'
      % (LAYER["window"], PALETTE["line"]))
    for wn in plan["windows"]:
        wl = wall_by_id[wn["wall_id"]]
        o, u, n = opening_frame(wn, wl)
        t, wd = wl["thickness"], wn["width"]
        wtype = wn.get("type", "sliding")
        a('<g id="%s" data-window-type="%s">' % (wn["id"], wtype))

        # 窗框帶（兩側牆面）＋兩端窗樘
        for b in (-t / 2.0, t / 2.0):
            p0, p1 = pt(o, u, n, 0.0, b), pt(o, u, n, wd, b)
            a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
              % (p0[0], p0[1], p1[0], p1[1], lw("frame")))
        for aa in (0.0, wd):
            p0, p1 = pt(o, u, n, aa, -t / 2.0), pt(o, u, n, aa, t / 2.0)
            a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
              % (p0[0], p0[1], p1[0], p1[1], lw("frame")))

        if wtype == "fixed":
            # 固定窗：框帶內 2 條平行細實線（玻璃）
            for b in (-t / 6.0, t / 6.0):
                p0, p1 = pt(o, u, n, 0.0, b), pt(o, u, n, wd, b)
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
                  % (p0[0], p0[1], p1[0], p1[1], lw("minor")))
        elif wtype == "casement":
            # 單開窗：一片窗扇（90° 全開）＋一道弧，向室外側開
            sgn = exterior_sign(wl, B, n)
            hinge = pt(o, u, n, 0.0, 0.0)
            tip = pt(o, u, n, 0.0, sgn * wd)
            far = pt(o, u, n, wd, 0.0)
            a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
              % (hinge[0], hinge[1], tip[0], tip[1], lw("major")))
            a('<path d="M %.1f %.1f A %d %d 0 0 %d %.1f %.1f" stroke-width="%.2f"/>'
              % (tip[0], tip[1], wd, wd,
                 arc_sweep((n[0] * sgn, n[1] * sgn), u),
                 far[0], far[1], lw("minor")))
        else:
            # 雙橫拉窗：框帶內兩段線於中央錯開，交會處一個小接點
            s1a, s1b = pt(o, u, n, 0.0, -t / 6.0), pt(o, u, n, wd * 0.55, -t / 6.0)
            s2a, s2b = pt(o, u, n, wd * 0.45, t / 6.0), pt(o, u, n, wd, t / 6.0)
            for (pa, pb) in ((s1a, s1b), (s2a, s2b)):
                a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.2f"/>'
                  % (pa[0], pa[1], pb[0], pb[1], lw("minor")))
            c = pt(o, u, n, wd * 0.5, 0.0)
            a('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="none"/>'
              % (c[0], c[1], t * 0.14, PALETTE["line"]))
        a('</g>')
    a('</g>')

    # --- 傢俱（圖層 07 活動 / 08 固定）---
    # 外圍線用中粗、副線用細實（表 24）。高度語意見 TALL / WALL_MOUNTED。
    a('<g id="furniture" fill="%s" stroke="%s" stroke-width="%.2f">'
      % (PALETTE["furn"], PALETTE["furn_line"], lw("minor")))
    for f in plan["furniture"]:
        g = f["geometry"]
        ft = f["type"]
        cx, cy = g["x"] + g["width"] / 2.0, g["y"] + g["height"] / 2.0
        layer = LAYER["furn_fixed"] if ft in FIXED_FURNITURE else LAYER["furn_movable"]
        a('<g id="%s" data-furniture-type="%s" data-layer="%s">' % (f["id"], ft, layer))
        # 壁掛／吊掛物在 120~150cm 切面「以上」，是投影下來的，所以畫虛線
        outline = ' stroke-dasharray="10 8"' if ft in WALL_MOUNTED else ''
        if ft in ("toilet", "sink"):
            a('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" stroke-width="%.2f"%s/>'
              % (cx, cy, g["width"] / 2.0, g["height"] / 2.0, lw("major"), outline))
        else:
            rx = 6 if ft in ("bed", "single_bed", "sofa", "bathtub") else 2
            a('<rect x="%d" y="%d" width="%d" height="%d" rx="%d" stroke-width="%.2f"%s/>'
              % (g["x"], g["y"], g["width"], g["height"], rx, lw("major"), outline))
        if ft in TALL:
            # 高櫃被 120~150cm 的切面切到 → 矩形內畫 X（p25 表 10 備考）
            a('<line x1="%d" y1="%d" x2="%d" y2="%d"/>'
              % (g["x"], g["y"], g["x"] + g["width"], g["y"] + g["height"]))
            a('<line x1="%d" y1="%d" x2="%d" y2="%d"/>'
              % (g["x"] + g["width"], g["y"], g["x"], g["y"] + g["height"]))
        if ft in ("bed", "single_bed"):               # 枕頭側
            if f["rotation"] in (0, 180):
                yy = g["y"] + (g["height"] * 0.22 if f["rotation"] == 0 else g["height"] * 0.78)
                a('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                  % (g["x"], yy, g["x"] + g["width"], yy))
            else:
                xx = g["x"] + (g["width"] * 0.22 if f["rotation"] == 90 else g["width"] * 0.78)
                a('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
                  % (xx, g["y"], xx, g["y"] + g["height"]))
        if ft == "sofa":                              # 椅背
            if f["rotation"] in (0, 180):
                yy = g["y"] + (g["height"] * 0.25 if f["rotation"] == 0 else g["height"] * 0.75)
                a('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                  % (g["x"], yy, g["x"] + g["width"], yy))
            else:
                xx = g["x"] + (g["width"] * 0.25 if f["rotation"] == 90 else g["width"] * 0.75)
                a('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
                  % (xx, g["y"], xx, g["y"] + g["height"]))
        if ft == "shower":
            a('<line x1="%d" y1="%d" x2="%d" y2="%d"/>'
              % (g["x"], g["y"], g["x"] + g["width"], g["y"] + g["height"]))
            a('<line x1="%d" y1="%d" x2="%d" y2="%d"/>'
              % (g["x"] + g["width"], g["y"], g["x"], g["y"] + g["height"]))
        a('</g>')
    a('</g>')

    # --- 房間名稱（圖層 11 文字）---
    # 名稱壓在傢俱線上會看不清楚，用白色描邊當底
    a('<g id="room-labels" data-layer="%s" text-anchor="middle" fill="%s" stroke="%s" '
      'stroke-width="%d" stroke-linejoin="round" paint-order="stroke">'
      % (LAYER["text"], PALETTE["text"], PALETTE["paper"], max(8, int(fs * 0.42))))
    fixtures = {}
    for f in plan["furniture"]:
        fixtures.setdefault(f["room_id"], set()).add(f["type"])
    for r in plan["rooms"]:
        g = r["geometry"]
        cx = g["x"] + g["width"] / 2.0
        cy = g["y"] + g["height"] / 2.0
        code = room_code(r, fixtures.get(r["id"], set()))
        label = "%s %s" % (r["name"], code) if code else r["name"]
        a('<text x="%.1f" y="%.1f" font-size="%d" font-weight="600">%s</text>'
          % (cx, cy, fs, esc(label)))
        a('<text x="%.1f" y="%.1f" font-size="%d" fill="%s">%.1f 坪</text>'
          % (cx, cy + fs * 1.2, int(fs * 0.72), PALETTE["muted"], r["area_ping"]))
    a('</g>')

    # --- 尺寸線（圖層 10）---
    # 表 24：尺寸標註線用細實線。端點符號 Arrow／Dot／Tick 三選一且全圖不得混用，
    # 這裡一律用 Tick（短斜線）。
    a('<g id="annotations" data-layer="%s" stroke="%s" fill="%s" stroke-width="%.2f">'
      % (LAYER["dimension"], PALETTE["muted"], PALETTE["muted"], lw("minor")))
    tick = 12
    dy = -pad["n"] + M * 0.55
    a('<line x1="0" y1="%.1f" x2="%d" y2="%.1f"/>' % (dy, W, dy))
    for xx in (0, W):
        a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
          % (xx - tick, dy + tick, xx + tick, dy - tick))
    a('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="middle" stroke="none">%d cm</text>'
      % (W / 2.0, dy - 22, int(fs * 0.78), W))
    dx = -pad["w"] + M * 0.55
    a('<line x1="%.1f" y1="0" x2="%.1f" y2="%d"/>' % (dx, dx, H))
    for yy in (0, H):
        a('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
          % (dx - tick, yy + tick, dx + tick, yy - tick))
    a('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="middle" stroke="none" '
      'transform="rotate(-90 %.1f %.1f)">%d cm</text>'
      % (dx - 22, H / 2.0, int(fs * 0.78), dx - 22, H / 2.0, H))
    a('</g>')

    # --- 指北針（p16 §10(a)：平面配置圖應標示指北針，並以圖之上方為北方）---
    ncx, ncy, nr = W + pad["e"] - M * 0.55, -pad["n"] + M * 0.55, M * 0.24
    a('<g id="north-arrow" stroke="%s" stroke-width="%.2f">' % (PALETTE["structure"], lw("minor")))
    a('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (ncx, ncy, nr, PALETTE["paper"]))
    a('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>'
      % (ncx, ncy - nr * 0.78, ncx - nr * 0.40, ncy + nr * 0.72,
         ncx, ncy + nr * 0.34, PALETTE["structure"]))
    a('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>'
      % (ncx, ncy - nr * 0.78, ncx + nr * 0.40, ncy + nr * 0.72,
         ncx, ncy + nr * 0.34, PALETTE["paper"]))
    a('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="middle" stroke="none" '
      'fill="%s" font-weight="700">N</text>'
      % (ncx, ncy - nr - 8, int(fs * 0.62), PALETTE["structure"]))
    a('</g>')

    # --- 圖名 / 比例尺 / 面積假設 ---
    # p8 §5、p14 圖 8：圖名右方標比例尺。規範以 mm 為原則，本專案內部用 cm，
    # 所以單位一律寫出來（見 rules/geometry.md），不留裸數字。
    am = plan.get("area_meta") or {}
    a('<text x="0" y="%.1f" font-size="%d" font-weight="700" fill="%s">%s 平面配置圖'
      '<tspan font-size="%d" font-weight="400" fill="%s">　S:1/50　單位：cm</tspan></text>'
      % (H + pad["s"] - M * 0.50, int(fs * 0.95), PALETTE["text"], esc(plan["name"]),
         int(fs * 0.68), PALETTE["muted"]))
    if am.get("deed_ping"):
        a('<text x="0" y="%.1f" font-size="%d" fill="%s">權狀 %s 坪 ／ 公設比 %.0f%% ／ '
          '室內 %.1f 坪（%.1f m²）</text>'
          % (H + pad["s"] - M * 0.18, int(fs * 0.68), PALETTE["muted"], am["deed_ping"],
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
