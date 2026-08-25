#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
layout_spec.json  →  floorplan.json

把模型撰寫的「拓樸 + 比例」展開成確定性的幾何。

設計原則（見 rules/geometry.md）：
  1. 模型不寫座標。房間座標由 slicing tree 展開，保證鋪滿 bounds、零重疊、零空隙。
  2. 模型不寫牆。牆由切割線與外框推導，永遠與房間邊界對齊。
  3. 模型不寫開口座標。門窗以「哪兩間房之間」或「哪間房的哪一面外牆」描述，
     由本程式解析成 wall_id + offset。因此「門沒長在牆上」這種狀態無法被表達。

用法:
    python3 expand_layout.py <spec.json> [-o out.json]
"""
import argparse
import datetime as _dt
import io
import json
import math
import os
import sys

PING_CM2 = 33057.85          # 1 坪 = 3.305785 m²
DEFAULT_PUBLIC_RATIO = 0.32  # 台灣新成屋常見公設比
DEFAULT_ASPECT = 1.25
DEFAULT_T = {"exterior": 24, "interior": 12}

D_PASS = 60      # 開口兩側必須留的通行淨深 (cm)
SILL = 40        # 窗前不得擺高傢俱的深度 (cm)
D_MOUNT = 25     # 壁掛物不佔通行空間，但不得跨過門洞本身
STEP = 5         # 傢俱求解沿牆滑動的步距 (cm)
TALL = {"wardrobe", "refrigerator"}          # 高度會擋住窗戶採光；廚房檯面是下櫃，本來就擺在窗下
WALL_MOUNTED = {"tv"}                        # 掛在牆上，不佔地面通行空間
FREESTANDING = {"dining_table", "chair"}     # 只有這些可以擺在房間中央；其餘一律靠牆

ROOM_NAMES = {
    "living_room": "客廳", "dining_room": "餐廳", "kitchen": "廚房",
    "bedroom": "臥室", "master_bedroom": "主臥", "bathroom": "衛浴",
    "balcony": "陽台", "hallway": "走道", "storage": "儲藏室",
    "study": "書房", "entrance": "玄關",
}

# 型錄尺寸 (width, depth) cm；width 為靠牆的那一邊
FURNITURE = {
    "sofa": (220, 90), "bed": (152, 188), "single_bed": (91, 188),
    "dining_table": (140, 80), "chair": (45, 45), "desk": (120, 60),
    "wardrobe": (180, 60), "tv": (120, 15), "kitchen_counter": (240, 60),
    "toilet": (40, 70), "sink": (60, 50), "bathtub": (150, 70),
    "shower": (90, 90), "refrigerator": (70, 70),
}

errors = []


def die_if_errors():
    if errors:
        sys.stderr.write("展開失敗，請修正 layout spec：\n")
        for e in errors:
            sys.stderr.write("  ✗ %s\n" % e)
        sys.exit(1)


def r(x):
    """四捨五入到整數公分（避開 banker's rounding）。"""
    return int(math.floor(x + 0.5))


# --------------------------------------------------------------------------
# 1. bounds：坪數 → 室內外框
# --------------------------------------------------------------------------
def resolve_bounds(spec):
    area = spec.get("area") or {}
    if "bounds" in area:
        w, h = r(area["bounds"]["width"]), r(area["bounds"]["height"])
        deed, ratio = area.get("deed_ping"), area.get("public_ratio")
    else:
        deed = area.get("deed_ping")
        if deed is None:
            errors.append("area 必須給 deed_ping 或 bounds 其中之一")
            return None, None
        ratio = area.get("public_ratio", DEFAULT_PUBLIC_RATIO)
        aspect = area.get("aspect", DEFAULT_ASPECT)
        interior_cm2 = deed * (1.0 - ratio) * PING_CM2
        w = r(math.sqrt(interior_cm2 * aspect))
        h = r(math.sqrt(interior_cm2 / aspect))

    m2 = w * h / 10000.0
    meta = {
        "deed_ping": deed,
        "public_ratio": ratio,
        "interior_ping": round(w * h / PING_CM2, 2),
        "interior_m2": round(m2, 2),
        "assumption": (
            "輸入坪數視為權狀坪數（含公設）；扣除公設比 %s 後為室內面積。"
            "本圖 bounds 為室內外框（含外牆中心線內），不含公設與雨遮。"
            % ("%.0f%%" % (ratio * 100) if ratio is not None else "未指定")
        ),
    }
    return {"width": w, "height": h}, meta


# --------------------------------------------------------------------------
# 2. slicing tree → rooms + cuts
# --------------------------------------------------------------------------
def expand_tree(node, x, y, w, h, rooms, cuts, path="root"):
    if "room" in node:
        rid = node["id"]
        rtype = node["room"]
        if w <= 0 or h <= 0:
            errors.append("房間 %s 展開後尺寸為零（%dx%d），請調整上層 ratios" % (rid, w, h))
        rooms.append({
            "id": rid,
            "type": rtype,
            "name": node.get("name") or ROOM_NAMES.get(rtype, rtype),
            "geometry": {"x": x, "y": y, "width": w, "height": h},
        })
        return

    stack = node["stack"]
    ratios = node["ratios"]
    kids = node["children"]
    if len(ratios) != len(kids):
        errors.append("%s: ratios 長度 %d 與 children 長度 %d 不符" % (path, len(ratios), len(kids)))
        return
    total = float(sum(ratios))
    if total <= 0:
        errors.append("%s: ratios 總和必須大於 0" % path)
        return

    extent = h if stack == "rows" else w
    start = y if stack == "rows" else x

    edges, cum = [start], 0.0
    for ratio in ratios[:-1]:
        cum += ratio / total
        edges.append(start + r(extent * cum))
    edges.append(start + extent)

    # 切割線本身就是一面內牆
    for e in edges[1:-1]:
        if stack == "rows":
            cuts.append({"orientation": "horizontal", "at": e, "lo": x, "hi": x + w})
        else:
            cuts.append({"orientation": "vertical", "at": e, "lo": y, "hi": y + h})

    for i, child in enumerate(kids):
        lo, hi = edges[i], edges[i + 1]
        if stack == "rows":
            expand_tree(child, x, lo, w, hi - lo, rooms, cuts, "%s/%d" % (path, i))
        else:
            expand_tree(child, lo, y, hi - lo, h, rooms, cuts, "%s/%d" % (path, i))


# --------------------------------------------------------------------------
# 3. walls：外框 + 切割線，並標記兩側房間
# --------------------------------------------------------------------------
def build_walls(bounds, cuts, rooms, thickness, party):
    W, H = bounds["width"], bounds["height"]
    t_ext, t_int = thickness["exterior"], thickness["interior"]
    walls = []

    def add(orientation, at, lo, hi, wtype, thick, side=None):
        if orientation == "horizontal":
            start, end = {"x": lo, "y": at}, {"x": hi, "y": at}
        else:
            start, end = {"x": at, "y": lo}, {"x": at, "y": hi}
        walls.append({
            "id": "wall-%03d" % (len(walls) + 1),
            "start": start, "end": end,
            "orientation": orientation,
            "length": hi - lo,
            "thickness": thick,
            "type": wtype,
            "rooms_a": [], "rooms_b": [],
            "_side": side, "_at": at, "_lo": lo, "_hi": hi,
        })

    for side, orientation, at, lo, hi in (
        ("n", "horizontal", 0, 0, W), ("s", "horizontal", H, 0, W),
        ("w", "vertical", 0, 0, H), ("e", "vertical", W, 0, H),
    ):
        add(orientation, at, lo, hi, "party" if side in party else "exterior", t_ext, side)

    for c in cuts:
        add(c["orientation"], c["at"], c["lo"], c["hi"], "interior", t_int)

    # 兩側房間：水平牆 a=上 b=下；垂直牆 a=左 b=右
    for wl in walls:
        for rm in rooms:
            g = rm["geometry"]
            if wl["orientation"] == "horizontal":
                ov = min(g["x"] + g["width"], wl["_hi"]) - max(g["x"], wl["_lo"])
                if ov <= 0:
                    continue
                if g["y"] + g["height"] == wl["_at"]:
                    wl["rooms_a"].append(rm["id"])
                elif g["y"] == wl["_at"]:
                    wl["rooms_b"].append(rm["id"])
            else:
                ov = min(g["y"] + g["height"], wl["_hi"]) - max(g["y"], wl["_lo"])
                if ov <= 0:
                    continue
                if g["x"] + g["width"] == wl["_at"]:
                    wl["rooms_a"].append(rm["id"])
                elif g["x"] == wl["_at"]:
                    wl["rooms_b"].append(rm["id"])
    return walls


def room_inner(rm, bounds, thickness):
    g = rm["geometry"]
    te, ti = thickness["exterior"] / 2.0, thickness["interior"] / 2.0
    left = te if g["x"] == 0 else ti
    top = te if g["y"] == 0 else ti
    right = te if g["x"] + g["width"] == bounds["width"] else ti
    bottom = te if g["y"] + g["height"] == bounds["height"] else ti
    return {
        "x": r(g["x"] + left), "y": r(g["y"] + top),
        "width": r(g["width"] - left - right), "height": r(g["height"] - top - bottom),
    }


# --------------------------------------------------------------------------
# 4. 開口解析：語意 → wall_id + offset
# --------------------------------------------------------------------------
def room_by_id(rooms, rid):
    for rm in rooms:
        if rm["id"] == rid:
            return rm
    return None


def shared_span(walls, rooms, a_id, b_id):
    """回傳 (wall, span_lo, span_hi)。找不到就回 None。"""
    ra, rb = room_by_id(rooms, a_id), room_by_id(rooms, b_id)
    if ra is None or rb is None:
        return None
    ga, gb = ra["geometry"], rb["geometry"]
    for wl in walls:
        pair = (a_id in wl["rooms_a"] and b_id in wl["rooms_b"]) or \
               (b_id in wl["rooms_a"] and a_id in wl["rooms_b"])
        if not pair:
            continue
        if wl["orientation"] == "horizontal":
            lo = max(ga["x"], gb["x"], wl["_lo"])
            hi = min(ga["x"] + ga["width"], gb["x"] + gb["width"], wl["_hi"])
        else:
            lo = max(ga["y"], gb["y"], wl["_lo"])
            hi = min(ga["y"] + ga["height"], gb["y"] + gb["height"], wl["_hi"])
        if hi > lo:
            return wl, lo, hi
    return None


def exterior_span(walls, rooms, bounds, rid, side):
    rm = room_by_id(rooms, rid)
    if rm is None:
        return None
    g = rm["geometry"]
    want = {
        "n": ("horizontal", 0, g["x"], g["x"] + g["width"], g["y"] == 0),
        "s": ("horizontal", bounds["height"], g["x"], g["x"] + g["width"],
              g["y"] + g["height"] == bounds["height"]),
        "w": ("vertical", 0, g["y"], g["y"] + g["height"], g["x"] == 0),
        "e": ("vertical", bounds["width"], g["y"], g["y"] + g["height"],
              g["x"] + g["width"] == bounds["width"]),
    }[side]
    orientation, at, lo, hi, touches = want
    if not touches:
        return None
    for wl in walls:
        if wl["orientation"] == orientation and wl["_at"] == at and wl["type"] in ("exterior", "party"):
            return wl, lo, hi
    return None


def place_on_wall(wl, lo, hi, width, at):
    span = hi - lo
    center = lo + at * span
    off_start = center - width / 2.0
    # 夾回共用段內
    off_start = max(lo, min(off_start, hi - width))
    offset = r(off_start - (wl["_lo"]))
    if wl["orientation"] == "horizontal":
        pos = {"x": r(off_start + width / 2.0), "y": wl["_at"]}
        rot = 0
    else:
        pos = {"x": wl["_at"], "y": r(off_start + width / 2.0)}
        rot = 90
    return offset, pos, rot, span


def resolve_doors(spec, walls, rooms, bounds):
    out = []
    for d in spec.get("doors", []):
        did = d["id"]
        width = d.get("width", 90)
        at = d.get("at", 0.5)
        role = d.get("role", "interior")
        found = None
        connects = [None, None]
        if "between" in d:
            a, b = d["between"]
            found = shared_span(walls, rooms, a, b)
            if found is None:
                errors.append("門 %s: %s 與 %s 沒有共用牆段，無法安裝" % (did, a, b))
                continue
            connects = [a, b]
        elif "exterior" in d:
            rid, side = d["exterior"]["room"], d["exterior"]["side"]
            found = exterior_span(walls, rooms, bounds, rid, side)
            if found is None:
                errors.append("門 %s: 房間 %s 沒有貼到 %s 側外牆" % (did, rid, side))
                continue
            connects = [None, rid]
        else:
            errors.append("門 %s: 必須指定 between 或 exterior" % did)
            continue

        wl, lo, hi = found
        if hi - lo < width:
            errors.append("門 %s: 共用段只有 %dcm，裝不下 %dcm 的門（請調整 ratios 或縮小門寬）"
                          % (did, hi - lo, width))
            continue
        offset, pos, rot, _ = place_on_wall(wl, lo, hi, width, at)
        opens_to = d.get("opens_to")
        if opens_to is None:
            opens_to = connects[1] or connects[0]
        dtype = d.get("type", "single")
        swing = d.get("swing", "right")
        rec = {
            "id": did, "type": dtype, "wall_id": wl["id"],
            "offset": offset, "width": width, "position": pos, "rotation": rot,
            "swing": swing, "opens_to": opens_to,
            "connects": connects, "role": role,
            "swing_arc": None,
        }
        if dtype != "sliding":
            rec["swing_arc"] = swing_arc(wl, offset, width, swing, rooms, opens_to)
        out.append(rec)
    return out


def swing_arc(wl, offset, width, swing, rooms, opens_to):
    """門扇掃過的四分之一圓：鉸鏈位置 + 兩個單位方向。

    renderer 與 validator 都讀這份資料，不各自重算，避免三邊定義漂移。
    """
    s = wl["start"]
    horiz = wl["orientation"] == "horizontal"
    if horiz:
        a = (s["x"] + offset, s["y"])
        b = (s["x"] + offset + width, s["y"])
    else:
        a = (s["x"], s["y"] + offset)
        b = (s["x"], s["y"] + offset + width)
    hinge, far = (b, a) if swing == "right" else (a, b)

    rm = room_by_id(rooms, opens_to)
    if horiz:
        along = (1.0 if far[0] > hinge[0] else -1.0, 0.0)
        into = -1.0 if (rm and rm["geometry"]["y"] + rm["geometry"]["height"] <= a[1]) else 1.0
        open_dir = (0.0, into)
    else:
        along = (0.0, 1.0 if far[1] > hinge[1] else -1.0)
        into = -1.0 if (rm and rm["geometry"]["x"] + rm["geometry"]["width"] <= a[0]) else 1.0
        open_dir = (into, 0.0)
    return {
        "hinge": {"x": r(hinge[0]), "y": r(hinge[1])},
        "radius": r(width),
        "along": {"x": along[0], "y": along[1]},
        "open": {"x": open_dir[0], "y": open_dir[1]},
    }


def resolve_windows(spec, walls, rooms, bounds):
    out = []
    for wnd in spec.get("windows", []):
        wid, rid, side = wnd["id"], wnd["room"], wnd["side"]
        width = wnd.get("width", 150)
        found = exterior_span(walls, rooms, bounds, rid, side)
        if found is None:
            errors.append("窗 %s: 房間 %s 沒有貼到 %s 側外牆，窗戶只能開在外牆" % (wid, rid, side))
            continue
        wl, lo, hi = found
        if wl["type"] == "party":
            errors.append("窗 %s: %s 側是共同壁（party wall），不得開窗" % (wid, side))
            continue
        if hi - lo < width:
            errors.append("窗 %s: 該面外牆只有 %dcm，裝不下 %dcm 的窗" % (wid, hi - lo, width))
            continue
        offset, pos, rot, _ = place_on_wall(wl, lo, hi, width, wnd.get("at", 0.5))
        out.append({
            "id": wid, "type": wnd.get("type", "sliding"), "wall_id": wl["id"],
            "offset": offset, "width": width, "position": pos, "rotation": rot,
            "room": rid,
        })
    return out


# --------------------------------------------------------------------------
# 5. 傢俱：不是照抄 anchor/at，而是在「合法空位」裡求解
# --------------------------------------------------------------------------
def rects_overlap(a, b, tol=0):
    return (min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"]) > tol and
            min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"]) > tol)


def sector_hits_rect(arc, rect, tol=0):
    """四分之一圓 vs 軸對齊矩形。先夾到象限方框，再比最近點距離。"""
    hx, hy = arc["hinge"]["x"], arc["hinge"]["y"]
    R = arc["radius"]
    sx = arc["along"]["x"] or arc["open"]["x"]
    sy = arc["along"]["y"] or arc["open"]["y"]
    qx0, qx1 = (hx, hx + R) if sx > 0 else (hx - R, hx)
    qy0, qy1 = (hy, hy + R) if sy > 0 else (hy - R, hy)
    x0 = max(rect["x"] + tol, qx0)
    x1 = min(rect["x"] + rect["width"] - tol, qx1)
    y0 = max(rect["y"] + tol, qy0)
    y1 = min(rect["y"] + rect["height"] - tol, qy1)
    if x1 <= x0 or y1 <= y0:
        return False
    cx = min(max(hx, x0), x1)
    cy = min(max(hy, y0), y1)
    return (cx - hx) ** 2 + (cy - hy) ** 2 < R * R


def passage_rect(wl, offset, width, room_geom, depth=D_PASS):
    """開口在某個房間側的通行淨空。"""
    s = wl["start"]
    if wl["orientation"] == "horizontal":
        into = 1.0 if room_geom["y"] > s["y"] - 1 else -1.0
        y = s["y"] if into > 0 else s["y"] - depth
        return {"x": s["x"] + offset, "y": y, "width": width, "height": depth}
    into = 1.0 if room_geom["x"] > s["x"] - 1 else -1.0
    x = s["x"] if into > 0 else s["x"] - depth
    return {"x": x, "y": s["y"] + offset, "width": depth, "height": width}


def build_blocked(rooms, doors, windows, walls):
    """每個房間的禁區：門的開啟弧線、開口兩側的通行空間、窗前的採光帶。

    傢俱在這些區域裡就等於「門打不開」或「走不過去」。與其事後驗證，
    不如在擺放時就把它們當成障礙物——這跟房間座標由切割樹保證的道理一樣。
    """
    wall_by_id = dict((w["id"], w) for w in walls)
    geom = dict((rm["id"], rm["geometry"]) for rm in rooms)
    hard = dict((rm["id"], []) for rm in rooms)   # 擋所有落地傢俱（通行空間）
    soft = dict((rm["id"], []) for rm in rooms)   # 只擋高傢俱（窗前採光）
    mount = dict((rm["id"], []) for rm in rooms)  # 只擋壁掛物（門洞本身）

    for d in doors:
        wl = wall_by_id[d["wall_id"]]
        for rid in [c for c in d["connects"] if c and c in geom]:
            hard[rid].append(("rect", passage_rect(wl, d["offset"], d["width"], geom[rid])))
            mount[rid].append(("rect", passage_rect(wl, d["offset"], d["width"], geom[rid], D_MOUNT)))
        if d["swing_arc"] and d["opens_to"] in hard:
            hard[d["opens_to"]].append(("sector", d["swing_arc"]))

    for wn in windows:
        rid = wn.get("room")
        if rid not in soft:
            continue
        wl = wall_by_id[wn["wall_id"]]
        soft[rid].append(("rect", passage_rect(wl, wn["offset"], wn["width"], geom[rid], SILL)))
        mount[rid].append(("rect", passage_rect(wl, wn["offset"], wn["width"], geom[rid], D_MOUNT)))
    return hard, soft, mount


def zone_hits(zones, rect):
    for kind, z in zones:
        if kind == "rect" and rects_overlap(z, rect):
            return True
        if kind == "sector" and sector_hits_rect(z, rect):
            return True
    return False


def bbox_for(anchor, inner, fw, fd, pos):
    """回傳 (bbox, rotation, facing)。pos 是沿牆方向的座標（bbox 起點）。"""
    if anchor == "n":
        return {"x": pos, "y": inner["y"], "width": fw, "height": fd}, 0, "s"
    if anchor == "s":
        return {"x": pos, "y": inner["y"] + inner["height"] - fd, "width": fw, "height": fd}, 180, "n"
    if anchor == "w":
        return {"x": inner["x"], "y": pos, "width": fd, "height": fw}, 90, "e"
    if anchor == "e":
        return {"x": inner["x"] + inner["width"] - fd, "y": pos, "width": fd, "height": fw}, 270, "w"
    return None


def solve_anchor(anchor, inner, fw, fd, want_at, obstacles):
    """沿該面牆滑動，找離期望位置最近的合法空位。找不到回 None。"""
    if anchor in ("n", "s"):
        span, size = inner["width"], fw
        lo = inner["x"]
        if fd > inner["height"]:
            return None
    else:
        span, size = inner["height"], fw
        lo = inner["y"]
        if fd > inner["width"]:
            return None
    if size > span:
        return None
    want = lo + want_at * span - size / 2.0
    want = max(lo, min(want, lo + span - size))
    steps = int((span - size) / STEP) + 1
    cands = [want]
    for k in range(1, steps + 1):
        for delta in (k * STEP, -k * STEP):
            v = want + delta
            if lo <= v <= lo + span - size:
                cands.append(v)
    for v in cands:
        box, rot, facing = bbox_for(anchor, inner, fw, fd, r(v))
        if not zone_hits(obstacles, box):
            return box, rot, facing
    return None


def free_run(anchor, inner, fw, fd, obstacles):
    """該面牆上最長的連續合法區段，用來產生看得懂的錯誤訊息。"""
    if anchor in ("n", "s"):
        span, lo, depth_ok = inner["width"], inner["x"], fd <= inner["height"]
    else:
        span, lo, depth_ok = inner["height"], inner["y"], fd <= inner["width"]
    if not depth_ok:
        return -1                      # 深度就不夠，根本靠不了這面牆
    best = run = 0
    probe = max(10, int(fw / 4)) or 10
    v = lo
    while v <= lo + span - probe:
        box, _, _ = bbox_for(anchor, inner, probe, fd, r(v))
        if zone_hits(obstacles, box):
            run = 0
        else:
            run += STEP
            best = max(best, run + probe - STEP)
        v += STEP
    return min(best, span)


def solve_center(inner, fw, fd, obstacles):
    if fw > inner["width"] or fd > inner["height"]:
        return None
    cx = inner["x"] + (inner["width"] - fw) / 2.0
    cy = inner["y"] + (inner["height"] - fd) / 2.0
    offs = [0]
    for k in range(1, 21):
        offs += [k * STEP, -k * STEP]
    for dy in offs:
        for dx in offs:
            x = max(inner["x"], min(cx + dx, inner["x"] + inner["width"] - fw))
            y = max(inner["y"], min(cy + dy, inner["y"] + inner["height"] - fd))
            box = {"x": r(x), "y": r(y), "width": r(fw), "height": r(fd)}
            if not zone_hits(obstacles, box):
                return box, 0, "none"
    return None


def resolve_furniture(spec, rooms, hard, soft, mount):
    out = []
    moved = []
    by_id = dict((rm["id"], rm) for rm in rooms)
    placed = dict((rm["id"], []) for rm in rooms)

    for f in spec.get("furniture", []):
        fid, ftype, rid = f["id"], f["type"], f["room"]
        if rid not in by_id:
            errors.append("傢俱 %s: 房間 %s 不存在" % (fid, rid))
            continue
        if ftype not in FURNITURE and ("width" not in f or "depth" not in f):
            errors.append("傢俱 %s: 型錄沒有 %s，必須自行給 width/depth" % (fid, ftype))
            continue
        dw, dd = FURNITURE.get(ftype, (0, 0))
        fw, fd = f.get("width", dw), f.get("depth", dd)
        inner = by_id[rid]["inner"]
        want_anchor = f.get("anchor", "center")
        want_at = f.get("at", 0.5)

        # 壁掛物（電視）掛在牆上不佔地面，所以不受 60cm 通行空間限制；
        # 但不能掛在門洞或窗洞上，也不能被開啟的門扇掃到。
        obstacles = [("rect", g) for g in placed[rid]]
        if ftype in WALL_MOUNTED:
            obstacles += mount[rid] + [z for z in hard[rid] if z[0] == "sector"]
        else:
            obstacles += hard[rid]
        if ftype in TALL:
            obstacles += soft[rid]

        # 靠牆的傢俱不給 center 這個退路——冰箱擺在廚房正中央雖然「合法」，但那是張錯的圖。
        fallbacks = ("n", "e", "s", "w", "center") if ftype in FREESTANDING else ("n", "e", "s", "w")
        order = [want_anchor] + [a for a in fallbacks if a != want_anchor]
        if f.get("strict"):
            order = [want_anchor]

        got = None
        for anchor in order:
            got = (solve_center(inner, fw, fd, obstacles) if anchor == "center"
                   else solve_anchor(anchor, inner, fw, fd, want_at, obstacles))
            if got:
                if anchor != want_anchor:
                    moved.append("%s: anchor %s → %s" % (fid, want_anchor, anchor))
                    sys.stderr.write("  ↻ %s 為避開門窗自動改擺: anchor %s → %s\n"
                                     % (fid, want_anchor, anchor))
                break
        if not got:
            diag = []
            for anchor in ("n", "e", "s", "w"):
                run = free_run(anchor, inner, fw, fd, obstacles)
                need = fw if anchor in ("n", "s") else fw
                diag.append("%s牆%s" % (
                    {"n": "北", "e": "東", "s": "南", "w": "西"}[anchor],
                    "淨深不足" if run < 0 else "可用 %dcm／需要 %dcm" % (run, need)))
            errors.append(
                "傢俱 %s（%s，%dx%d）放不進 %s。房間淨空間 %dx%d，扣掉門的開啟弧線與"
                "開口兩側 %dcm 通行空間後：%s。"
                "→ 調大該房的 ratios，或換小一點的傢俱，或把門的 at 推到牆的一端。"
                % (fid, ftype, fw, fd, by_id[rid]["name"],
                   inner["width"], inner["height"], D_PASS, "；".join(diag)))
            continue
        box, rot, facing = got
        placed[rid].append(box)
        out.append({"id": fid, "type": ftype, "room_id": rid,
                    "geometry": box, "rotation": rot, "facing": facing})
    return out, moved


# --------------------------------------------------------------------------
# 6. hotspots：門窗自動生成 + 手動 CNS 符號
# --------------------------------------------------------------------------
def load_symbol_map(base):
    path = os.path.join(base, "rules", "symbol_map.json")
    if os.path.exists(path):
        return json.load(io.open(path, encoding="utf-8"))
    return {}


def opening_hotspot_rect(op, walls, min_depth=24):
    wl = next(w for w in walls if w["id"] == op["wall_id"])
    depth = max(wl["thickness"], min_depth)
    if wl["orientation"] == "horizontal":
        return [r(op["position"]["x"] - op["width"] / 2.0), r(op["position"]["y"] - depth / 2.0),
                r(op["width"]), r(depth)]
    return [r(op["position"]["x"] - depth / 2.0), r(op["position"]["y"] - op["width"] / 2.0),
            r(depth), r(op["width"])]


def build_hotspots(spec, doors, windows, walls, rooms, symmap):
    hs = []
    for d in doors:
        hs.append({
            "id": "hs-%s" % d["id"], "symbol_id": symmap.get("door." + d["type"]),
            "shape": "rect", "coords": opening_hotspot_rect(d, walls),
            "label_position": "below", "source": "auto_door", "ref": d["id"],
        })
    for w in windows:
        hs.append({
            "id": "hs-%s" % w["id"], "symbol_id": symmap.get("window." + w.get("type", "sliding")),
            "shape": "rect", "coords": opening_hotspot_rect(w, walls),
            "label_position": "above", "source": "auto_window", "ref": w["id"],
        })
    inner_by_id = dict((rm["id"], rm["inner"]) for rm in rooms)
    for h in spec.get("hotspots", []):
        shape = h.get("shape", "circle")
        coords = h.get("coords")
        if coords is None:
            place = h.get("place")
            if place is None:
                errors.append("hotspot %s: 必須給 coords 或 place" % h["id"])
                continue
            if place["room"] not in inner_by_id:
                errors.append("hotspot %s: 房間 %s 不存在" % (h["id"], place["room"]))
                continue
            inner = inner_by_id[place["room"]]
            rel = place.get("rel", [0.5, 0.5])
            cx = r(inner["x"] + rel[0] * inner["width"])
            cy = r(inner["y"] + rel[1] * inner["height"])
            if shape == "circle":
                coords = [cx, cy, r(place.get("radius", 15))]
            elif shape == "rect":
                sw, sh = place.get("size", [60, 60])
                coords = [r(cx - sw / 2.0), r(cy - sh / 2.0), r(sw), r(sh)]
            else:
                errors.append("hotspot %s: polygon 必須直接給 coords" % h["id"])
                continue
        hs.append({
            "id": h["id"], "symbol_id": h["symbol_id"], "shape": shape, "coords": coords,
            "label_position": h.get("label_position", "right"), "source": "manual", "ref": None,
        })
    return hs


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("-o", "--out")
    args = ap.parse_args()

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    spec = json.load(io.open(args.spec, encoding="utf-8"))

    bounds, area_meta = resolve_bounds(spec)
    die_if_errors()

    thickness = dict(DEFAULT_T)
    thickness.update(spec.get("wall_thickness") or {})
    party = spec.get("party_walls", [])

    rooms, cuts = [], []
    expand_tree(spec["tree"], 0, 0, bounds["width"], bounds["height"], rooms, cuts)
    die_if_errors()

    ids = [rm["id"] for rm in rooms]
    for rid in set(ids):
        if ids.count(rid) > 1:
            errors.append("room.id 重複: %s" % rid)
    die_if_errors()

    walls = build_walls(bounds, cuts, rooms, thickness, party)
    for rm in rooms:
        rm["inner"] = room_inner(rm, bounds, thickness)
        g = rm["geometry"]
        rm["area_m2"] = round(g["width"] * g["height"] / 10000.0, 2)
        rm["area_ping"] = round(g["width"] * g["height"] / PING_CM2, 2)

    doors = resolve_doors(spec, walls, rooms, bounds)
    windows = resolve_windows(spec, walls, rooms, bounds)
    die_if_errors()
    hard, soft, mount = build_blocked(rooms, doors, windows, walls)
    furniture, moved = resolve_furniture(spec, rooms, hard, soft, mount)
    hotspots = build_hotspots(spec, doors, windows, walls, rooms, load_symbol_map(base))
    die_if_errors()

    annotations = [
        {"id": "dim-overall-w", "type": "dimension",
         "start": {"x": 0, "y": 0}, "end": {"x": bounds["width"], "y": 0},
         "label": "%d cm" % bounds["width"]},
        {"id": "dim-overall-h", "type": "dimension",
         "start": {"x": 0, "y": 0}, "end": {"x": 0, "y": bounds["height"]},
         "label": "%d cm" % bounds["height"]},
    ]

    for wl in walls:
        for k in ("_side", "_at", "_lo", "_hi"):
            wl.pop(k, None)

    plan = {
        "schema_version": 1,
        "id": spec["id"], "name": spec["name"], "unit": "cm",
        "generated_by": "floorplan-generator/expand_layout.py",
        "generated_at": _dt.date.today().isoformat(),
        "area_meta": area_meta,
        "bounds": bounds,
        "party_walls": party,
        "rooms": rooms, "walls": walls, "doors": doors, "windows": windows,
        "furniture": furniture, "annotations": annotations, "hotspots": hotspots,
    }

    text = json.dumps(plan, ensure_ascii=False, indent=2)
    if args.out:
        io.open(args.out, "w", encoding="utf-8").write(text + "\n")
        sys.stderr.write("✓ %s → %s（%d 房 / %d 牆 / %d 門 / %d 窗 / %d 熱區）\n" % (
            os.path.basename(args.spec), args.out,
            len(rooms), len(walls), len(doors), len(windows), len(hotspots)))
    else:
        sys.stdout.write(text + "\n")


if __name__ == "__main__":
    main()
