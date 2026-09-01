#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
floorplan.json 的幾何與語意驗證。

風格對齊 scripts/validate_data.py：errors 擋掉，warnings 只提醒。
有 error 時 exit code 1。

分成兩類：
  幾何 — 理論上 expand_layout.py 已保證，這裡是抓「展開器自己壞掉」的回歸測試
  語意 — 展開器保證不了的：動線連通、採光、傢俱擺放、走道淨寬

用法:
    python3 validate_floorplan.py <floorplan.json> [--symbols data/symbols.sample.json]
"""
import argparse
import collections
import io
import json
import math
import sys

errors, warnings = [], []
MIN_DOOR_W = 70          # 內門最小淨寬
MIN_CLEARANCE = 60       # 傢俱前最小通行淨寬
NEED_WINDOW = {"living_room", "bedroom", "master_bedroom", "study", "dining_room"}
D_PASS = 60      # 開口兩側通行淨深
SILL = 40        # 窗前採光帶
TALL = {"wardrobe", "refrigerator"}
WALL_MOUNTED = {"tv"}
D_MOUNT = 25     # 壁掛物不得跨過門洞
CIRCULATION = {"hallway", "entrance", "living_room", "dining_room"}


def check(cond, msg, bucket=None):
    if not cond:
        (errors if bucket is None else bucket).append(msg)
    return cond


def rects_overlap(a, b, tol=0):
    return (min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"]) > tol and
            min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"]) > tol)


def contains(outer, inner, tol=0.5):
    return (inner["x"] >= outer["x"] - tol and inner["y"] >= outer["y"] - tol and
            inner["x"] + inner["width"] <= outer["x"] + outer["width"] + tol and
            inner["y"] + inner["height"] <= outer["y"] + outer["height"] + tol)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--symbols", help="data/symbols.*.json，用來檢查 hotspot.symbol_id 是否存在")
    args = ap.parse_args()

    plan = json.load(io.open(args.plan, encoding="utf-8"))
    B = plan["bounds"]
    rooms = plan["rooms"]
    walls = plan["walls"]
    wall_by_id = dict((w["id"], w) for w in walls)
    room_by_id = dict((r["id"], r) for r in rooms)

    # ---------------- 幾何 ----------------
    for r in rooms:
        g = r["geometry"]
        check(g["width"] > 0 and g["height"] > 0, "房間 %s 尺寸非正值" % r["id"])
        check(g["x"] >= 0 and g["y"] >= 0, "房間 %s 超出 bounds 左上界" % r["id"])
        check(g["x"] + g["width"] <= B["width"] and g["y"] + g["height"] <= B["height"],
              "房間 %s 超出 bounds 右下界" % r["id"])
        check(r["inner"]["width"] > 0 and r["inner"]["height"] > 0,
              "房間 %s 扣掉牆厚後淨空間為零，房間太小" % r["id"])

    for i in range(len(rooms)):
        for j in range(i + 1, len(rooms)):
            if rects_overlap(rooms[i]["geometry"], rooms[j]["geometry"]):
                errors.append("房間 %s 與 %s 重疊" % (rooms[i]["id"], rooms[j]["id"]))

    total = sum(r["geometry"]["width"] * r["geometry"]["height"] for r in rooms)
    check(abs(total - B["width"] * B["height"]) < 1,
          "房間面積總和 %d 與 bounds 面積 %d 不符（有空隙或重疊）" % (total, B["width"] * B["height"]))

    ids = [r["id"] for r in rooms]
    for rid, n in collections.Counter(ids).items():
        check(n == 1, "room.id 重複: %s" % rid)

    for w in walls:
        check(w["length"] > 0, "牆 %s 長度為零" % w["id"])
        check(w["thickness"] > 0, "牆 %s 厚度非正值" % w["id"])

    # ---------------- 開口 ----------------
    on_wall = collections.defaultdict(list)
    for op, kind in [(d, "門") for d in plan["doors"]] + [(w, "窗") for w in plan["windows"]]:
        wl = wall_by_id.get(op["wall_id"])
        if not check(wl is not None, "%s %s 指向不存在的牆 %s" % (kind, op["id"], op["wall_id"])):
            continue
        check(op["offset"] >= 0, "%s %s offset 為負" % (kind, op["id"]))
        check(op["offset"] + op["width"] <= wl["length"] + 0.5,
              "%s %s 超出牆 %s 的長度（%d + %d > %d）"
              % (kind, op["id"], wl["id"], op["offset"], op["width"], wl["length"]))
        on_wall[op["wall_id"]].append((op["offset"], op["offset"] + op["width"], kind, op["id"]))

    for wid, items in on_wall.items():
        items.sort()
        for k in range(len(items) - 1):
            if items[k][1] > items[k + 1][0]:
                errors.append("牆 %s 上 %s %s 與 %s %s 重疊"
                              % (wid, items[k][2], items[k][3], items[k + 1][2], items[k + 1][3]))

    for w in plan["windows"]:
        wl = wall_by_id.get(w["wall_id"])
        if wl:
            check(wl["type"] == "exterior", "窗 %s 開在 %s 牆上（只能開外牆）" % (w["id"], wl["type"]))

    for d in plan["doors"]:
        if d["role"] == "interior":
            check(d["width"] >= MIN_DOOR_W,
                  "門 %s 淨寬只有 %dcm，低於 %dcm" % (d["id"], d["width"], MIN_DOOR_W), warnings)

    # ---------------- 動線連通 ----------------
    entrances = [d for d in plan["doors"] if d["role"] == "entrance"]
    if not check(len(entrances) >= 1, "沒有任何 role=entrance 的大門"):
        pass

    for d in entrances:
        if d["type"] == "opening":
            warnings.append("大門 %s 的 type 是 opening（無門扇的出入口）——住宅大門不會沒有門扇，"
                            "應改成 single 或 double" % d["id"])

    # 製圖慣例（p16 §10(b)）：「作圖時出入口應置於圖面下方或右方為原則」。
    # 真實建案平面圖大多如此，所以這關係到生成的圖「像不像使用者在外面看到的圖」。
    #
    # 但它與 §10(a)「以圖之上方為北方」天生會打架：本 skill 的座標系固定北方朝上，
    # 大門開哪一側是格局決定的，不是排版決定的。因此這是 warning 而非 error——
    # 要修就是改切割樹讓玄關／客廳貼到南側或東側外牆，不是把圖轉過來。
    for d in entrances:
        wl = wall_by_id.get(d["wall_id"])
        if not wl:
            continue
        if wl["orientation"] == "horizontal":
            side = "n" if wl["start"]["y"] < B["height"] / 2.0 else "s"
        else:
            side = "w" if wl["start"]["x"] < B["width"] / 2.0 else "e"
        if side not in ("s", "e"):
            warnings.append("大門 %s 開在圖面 %s 側。製圖慣例是出入口置於下方（s）或右方（e），"
                            "真實建案平面圖多半如此；要對齊就得改切割樹讓該房貼到 s／e 側外牆。"
                            "若這棟房子本來就朝 %s，保留即可（北方固定朝上）。"
                            "見 docs/reference/naid-symbols.md §2.7"
                            % (d["id"], side, side))
    adj = collections.defaultdict(set)
    reachable = set()
    for d in plan["doors"]:
        a, b = d["connects"][0], d["connects"][1]
        if a and b:
            adj[a].add(b)
            adj[b].add(a)
        if d["role"] == "entrance" and b:
            reachable.add(b)
    queue = list(reachable)
    while queue:
        cur = queue.pop()
        for nxt in adj[cur]:
            if nxt not in reachable:
                reachable.add(nxt)
                queue.append(nxt)
    for r in rooms:
        # 管道間沒有門、本來就進不去（表 28 PS），不納入動線檢查。
        if r["type"] == "pipe_shaft":
            continue
        check(r["id"] in reachable,
              "房間 %s（%s）從大門走不到——缺門或動線斷開" % (r["id"], r["name"]))

    # 臥室不應該當作通道（套房內的專屬衛浴／更衣室不算）
    ENSUITE = ("bathroom", "storage")
    for r in rooms:
        if r["type"] not in ("bedroom", "master_bedroom"):
            continue
        thru = [n for n in adj[r["id"]]
                if room_by_id.get(n) and room_by_id[n]["type"] not in ENSUITE]
        if len(thru) > 1:
            warnings.append("房間 %s（%s）有 %d 個對外門，被當成通道——住戶必須穿越臥室才能到達其他空間"
                            % (r["id"], r["name"], len(thru)))

    # ---------------- 採光 ----------------
    win_rooms = set(w["room"] for w in plan["windows"] if w.get("room"))
    for r in rooms:
        if r["type"] in NEED_WINDOW and r["id"] not in win_rooms:
            warnings.append("房間 %s（%s）沒有窗戶，屬於暗房" % (r["id"], r["name"]))

    # ---------------- 柱與雨遮 ----------------
    envelope = {"x": 0, "y": 0,
                "width": plan["bounds"]["width"], "height": plan["bounds"]["height"]}
    struct_ids = collections.Counter()
    for col in plan.get("columns", []):
        struct_ids[col["id"]] += 1
        g = col["geometry"]
        check(g["width"] > 0 and g["height"] > 0, "柱 %s: 尺寸必須為正" % col["id"])
        check(contains(envelope, g, tol=1),
              "柱 %s 落在建物範圍外" % col["id"])
    for cp in plan.get("canopies", []):
        struct_ids[cp["id"]] += 1
        g = cp["geometry"]
        check(g["width"] > 0 and g["height"] > 0, "雨遮 %s: 尺寸必須為正" % cp["id"])
        # 雨遮**應該**在建物之外——在裡面代表掛錯側了。
        check(not contains(envelope, g, tol=-1),
              "雨遮 %s 落在建物範圍內，應該挑出到外牆之外" % cp["id"])
    for sid, n in struct_ids.items():
        check(n == 1, "柱／雨遮 id 重複: %s" % sid)

    # ---------------- 傢俱 ----------------
    for f in plan["furniture"]:
        rm = room_by_id.get(f["room_id"])
        if not check(rm is not None, "傢俱 %s 指向不存在的房間 %s" % (f["id"], f["room_id"])):
            continue
        check(contains(rm["inner"], f["geometry"]),
              "傢俱 %s（%s）超出房間 %s 的淨空間——房間放不下這件傢俱"
              % (f["id"], f["type"], rm["id"]))

    # 門的開啟弧線不得撞到傢俱；開口兩側必須留得出通行空間。
    # expand_layout.py 已在擺放階段把這些當障礙物，這裡是防止展開器自己壞掉的回歸網。
    def sector_hits(arc, rect, tol=2):
        hx, hy, R = arc["hinge"]["x"], arc["hinge"]["y"], arc["radius"]
        sx = arc["along"]["x"] or arc["open"]["x"]
        sy = arc["along"]["y"] or arc["open"]["y"]
        qx0, qx1 = (hx, hx + R) if sx > 0 else (hx - R, hx)
        qy0, qy1 = (hy, hy + R) if sy > 0 else (hy - R, hy)
        x0 = max(rect["x"] + tol, qx0); x1 = min(rect["x"] + rect["width"] - tol, qx1)
        y0 = max(rect["y"] + tol, qy0); y1 = min(rect["y"] + rect["height"] - tol, qy1)
        if x1 <= x0 or y1 <= y0:
            return False
        cx = min(max(hx, x0), x1); cy = min(max(hy, y0), y1)
        return (cx - hx) ** 2 + (cy - hy) ** 2 < R * R

    def passage(wl, offset, width, g, depth):
        s0 = wl["start"]
        if wl["orientation"] == "horizontal":
            into = 1.0 if g["y"] > s0["y"] - 1 else -1.0
            return {"x": s0["x"] + offset, "y": s0["y"] if into > 0 else s0["y"] - depth,
                    "width": width, "height": depth}
        into = 1.0 if g["x"] > s0["x"] - 1 else -1.0
        return {"x": s0["x"] if into > 0 else s0["x"] - depth, "y": s0["y"] + offset,
                "width": depth, "height": width}

    furn_by_room = collections.defaultdict(list)
    for f in plan["furniture"]:
        furn_by_room[f["room_id"]].append(f)

    for d in plan["doors"]:
        wl = wall_by_id.get(d["wall_id"])
        if not wl:
            continue
        for arc in d.get("swing_arcs") or []:
            for f in furn_by_room.get(d.get("opens_to"), []):
                if sector_hits(arc, f["geometry"]):
                    errors.append("門 %s 開啟時會撞到 %s（%s）"
                                  % (d["id"], f["id"], f["type"]))
        for rid in [c for c in d["connects"] if c and c in room_by_id]:
            box = passage(wl, d["offset"], d["width"], room_by_id[rid]["geometry"], D_PASS)
            mount_box = passage(wl, d["offset"], d["width"], room_by_id[rid]["geometry"], D_MOUNT)
            for f in furn_by_room.get(rid, []):
                if f["type"] in WALL_MOUNTED:
                    if rects_overlap(mount_box, f["geometry"], tol=2):
                        errors.append("%s（%s）掛在門 %s 的門洞上"
                                      % (f["id"], f["type"], d["id"]))
                    continue
                if rects_overlap(box, f["geometry"], tol=2):
                    errors.append("門 %s 在 %s 側的通行空間被 %s（%s）擋住，走不過去"
                                  % (d["id"], room_by_id[rid]["name"], f["id"], f["type"]))

    for wn in plan["windows"]:
        wl = wall_by_id.get(wn["wall_id"])
        rid = wn.get("room")
        if not wl or rid not in room_by_id:
            continue
        box = passage(wl, wn["offset"], wn["width"], room_by_id[rid]["geometry"], SILL)
        mount_box = passage(wl, wn["offset"], wn["width"], room_by_id[rid]["geometry"], D_MOUNT)
        for f in furn_by_room.get(rid, []):
            if f["type"] in TALL and rects_overlap(box, f["geometry"], tol=2):
                errors.append("窗 %s 被 %s（%s）擋住採光" % (wn["id"], f["id"], f["type"]))
            if f["type"] in WALL_MOUNTED and rects_overlap(mount_box, f["geometry"], tol=2):
                errors.append("%s（%s）掛在窗 %s 的窗洞上" % (f["id"], f["type"], wn["id"]))

    by_room = collections.defaultdict(list)
    for f in plan["furniture"]:
        by_room[f["room_id"]].append(f)
    for rid, items in by_room.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if rects_overlap(items[i]["geometry"], items[j]["geometry"], tol=1):
                    errors.append("傢俱 %s 與 %s 在 %s 內重疊" % (items[i]["id"], items[j]["id"], rid))

    # 走道淨寬：房間剩餘可通行寬度
    for rid, items in by_room.items():
        rm = room_by_id.get(rid)
        if not rm or rm["type"] not in ("living_room", "dining_room", "hallway", "bedroom", "master_bedroom"):
            continue
        used_y = sum(f["geometry"]["height"] for f in items
                     if f["facing"] in ("n", "s") and f["geometry"]["width"] > rm["inner"]["width"] * 0.5)
        if rm["inner"]["height"] - used_y < MIN_CLEARANCE and used_y > 0:
            warnings.append("房間 %s（%s）扣掉傢俱後通行淨寬不足 %dcm"
                            % (rid, rm["name"], MIN_CLEARANCE))

    # ---------------- hotspots ----------------
    hs_ids = [h["id"] for h in plan["hotspots"]]
    for hid, n in collections.Counter(hs_ids).items():
        check(n == 1, "hotspot.id 重複: %s" % hid)
    for h in plan["hotspots"]:
        c = h["coords"]
        if h["shape"] == "circle":
            ok = len(c) == 3 and c[2] > 0
        elif h["shape"] == "rect":
            ok = len(c) == 4 and c[2] > 0 and c[3] > 0
        else:
            ok = len(c) >= 6 and len(c) % 2 == 0
        check(ok, "hotspot %s 的 coords 格式不符 shape=%s" % (h["id"], h["shape"]))
    unmapped = [h["id"] for h in plan["hotspots"] if h["symbol_id"] is None]
    if unmapped:
        warnings.append("%d 個熱區還沒有對應的已查證符號（symbol_id=null），viewer 會略過："
                        "%s%s。這是 PRD M1 查證未完成的正常狀態，見 rules/symbol_map.json"
                        % (len(unmapped), "、".join(unmapped[:3]),
                           " 等" if len(unmapped) > 3 else ""))

    if args.symbols:
        known = set(s["id"] for s in json.load(io.open(args.symbols, encoding="utf-8"))["symbols"])
        for h in plan["hotspots"]:
            if h["symbol_id"] is not None:
                check(h["symbol_id"] in known,
                      "hotspot %s 的 symbol_id '%s' 不存在於符號資料檔" % (h["id"], h["symbol_id"]))

    # ---------------- 輸出 ----------------
    out = sys.stderr
    for w in warnings:
        out.write("  ⚠ %s\n" % w)
    for e in errors:
        out.write("  ✗ %s\n" % e)
    out.write("%s %s — %d rooms / %d walls / %d doors / %d windows / %d furniture / %d hotspots"
              " — %d errors, %d warnings\n"
              % ("✗" if errors else "✓", plan["id"], len(rooms), len(walls), len(plan["doors"]),
                 len(plan["windows"]), len(plan["furniture"]), len(plan["hotspots"]),
                 len(errors), len(warnings)))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
