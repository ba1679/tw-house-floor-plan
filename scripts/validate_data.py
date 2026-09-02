#!/usr/bin/env python3
"""
資料完整性驗證（PRD v0.3.1 §10.1 ③ 的原型）

這是 Python 原型，用來在 Next.js 專案建起來之前先驗證資料檔。
正式版應以 zod 實作並掛進 build，任一項失敗即中斷建置。

用法: python3 scripts/validate_data.py
"""
import json, io, sys, glob, os, subprocess
import xml.etree.ElementTree as ET
from collections import Counter

REQUIRED_WHEN_VERIFIED = ["plain_meaning", "caution", "source_refs", "verified_at", "verified_by"]
VALID_TIERS = {"cns", "regulation", "convention", "varies"}
VALID_STATUS = {"verified", "partial", "pending_purchase", "blocked"}
VALID_CATEGORIES = {"structure", "door_window", "plumbing_electric", "fire_safety", "furniture"}
SPRITE_PATH = "data/symbols.sprite.svg"
SPRITE_VIEWBOX = "0 0 140 140"
VALID_HOTSPOT_SOURCES = set(['auto_door', 'auto_window', 'auto_column', 'auto_canopy', 'auto_furniture', 'auto_room', 'manual'])

errors, warnings = [], []


def check(cond, msg, bucket=errors):
    if not cond:
        bucket.append(msg)
    return cond


symbols = json.load(io.open("data/symbols.sample.json", encoding="utf-8"))["symbols"]
# Q3(b)：floorplan 是 commit 進 repo 的產物，由 layout spec 經 expand_layout.py 生成。
# 這裡讀的就是網站要吃的那份檔案，不是另一份樣本——樣本與正式檔分家正是內容雙份維護的開端。
floorplan_paths = sorted(glob.glob("data/layouts/*.floorplan.json"))
floorplans = [json.load(io.open(p, encoding="utf-8")) for p in floorplan_paths]
check(bool(floorplans), "data/layouts/ 底下找不到任何 *.floorplan.json")

# --- symbol.id unique ---
ids = [s["id"] for s in symbols]
for sid, n in Counter(ids).items():
    check(n == 1, "symbol.id 重複: %s (%d 次)" % (sid, n))
symbol_ids = set(ids)

# --- aliases unique across symbols ---
alias_owner = {}
for s in symbols:
    for a in s.get("aliases") or []:
        if a in alias_owner:
            warnings.append("alias「%s」同時屬於 %s 與 %s，搜尋會有歧義" % (a, alias_owner[a], s["id"]))
        alias_owner[a] = s["id"]

# --- enum 值合法 ---
for s in symbols:
    check(s["category"] in VALID_CATEGORIES, "%s: category 非法值 %r" % (s["id"], s["category"]))
    check(s["verification_status"] in VALID_STATUS, "%s: verification_status 非法值 %r" % (s["id"], s["verification_status"]))
    if s.get("source_tier") is not None:
        check(s["source_tier"] in VALID_TIERS, "%s: source_tier 非法值 %r" % (s["id"], s["source_tier"]))

# --- v0.3: risk_flags 必須已移除 ---
for s in symbols:
    check("risk_flags" not in s, "%s: 仍含 risk_flags，v0.3 已刪除此欄位（PRD §7.2.1）" % s["id"])

# --- verified 的符號必須內容完整 ---
for s in symbols:
    if s["verification_status"] == "verified":
        for f in REQUIRED_WHEN_VERIFIED:
            check(s.get(f), "%s: 標記 verified 但 %s 為空" % (s["id"], f))
        check(s.get("source_tier"), "%s: 標記 verified 但無 source_tier" % s["id"])

# --- svg_ref exists in sprite（PRD §10.1）---
# sprite 是「符號畫成什麼樣」的唯一來源。svg_ref 斷掉的後果不是報錯而是靜默留白：
# 符號頁與清單就少一格圖，看起來像設計沒做完，所以這裡是 error。
SVG_NS = "{http://www.w3.org/2000/svg}"
sprite_ids = set()
try:
    root = ET.parse(SPRITE_PATH).getroot()
    for node in root.findall(SVG_NS + "symbol"):
        sid = node.get("id")
        sprite_ids.add(sid)
        # viewBox 不一致 = 同一排圖示大小會跳動。這是 sprite 唯一的跨檔約定，照實檢查。
        check(node.get("viewBox") == SPRITE_VIEWBOX,
              "sprite %s: viewBox 應為 %r，實際 %r" % (sid, SPRITE_VIEWBOX, node.get("viewBox")))
        # <title> 是螢幕閱讀器唸出來的名字（PRD §9）
        check(node.find(SVG_NS + "title") is not None, "sprite %s: 缺 <title>" % sid)
except (IOError, OSError):
    errors.append("找不到 sprite: %s" % SPRITE_PATH)
except ET.ParseError as exc:
    errors.append("sprite 不是合法 XML: %s" % exc)

for s in symbols:
    check(s.get("svg_ref"), "%s: 缺 svg_ref" % s["id"])
    if s.get("svg_ref") and sprite_ids:
        check(s["svg_ref"] in sprite_ids,
              "%s: svg_ref %r 在 %s 找不到" % (s["id"], s["svg_ref"], SPRITE_PATH))
used = set(s.get("svg_ref") for s in symbols)
for orphan in sorted(sprite_ids - used):
    warnings.append("sprite 有 %s，但沒有任何 symbol 指向它——多畫的還是 id 打錯？" % orphan)

# --- floorplan / hotspot ---
floorplan_ids = [f["id"] for f in floorplans]
for fid, n in Counter(floorplan_ids).items():
    check(n == 1, "floorplan.id 重複: %s" % fid)

hotspot_ids, broken_refs = [], 0
for f in floorplans:
    for h in f["hotspots"]:
        hotspot_ids.append(h["id"])
        if h["symbol_id"] not in symbol_ids:
            broken_refs += 1
            errors.append("hotspot %s 指向不存在的 symbol_id: %s" % (h["id"], h["symbol_id"]))
        check(h.get("source") in VALID_HOTSPOT_SOURCES,
              "hotspot %s: source 非法值 %r（PRD v0.3.1 §7.3）" % (h["id"], h.get("source")))
for hid, n in Counter(hotspot_ids).items():
    check(n == 1, "hotspot.id 重複: %s" % hid)

# --- 檔名與 floorplan.id 一致 ---
# 網站以檔名決定網址（data/layouts/<id>.floorplan.json → /layouts/<id>）。
# 對不上就是有一邊被手改過，而格局 id 一旦上線不得更改（CONTEXT.md）。
for path, f in zip(floorplan_paths, floorplans):
    stem = os.path.basename(path)[:-len(".floorplan.json")]
    check(f["id"] == stem, "%s 裡的 id 是 %r，與檔名 %r 對不上——網址由檔名決定，"
                           "而格局 id 一旦上線不得更改" % (os.path.basename(path), f["id"], stem))

# --- 圖面產物與 floorplan 同步（檢視器直接顯示這個產物）---
# data/layouts/*.svg 是 floorplan-generator 從同一份 floorplan 資料畫出來的產物，網站顯示的就是它，
# 而熱區是檢視器另外依 floorplan.hotspots 畫的。兩份東西一旦不同步，使用者會看著一張畫錯的圖、
# 點在錯的位置——而畫面上看不出來。所以這裡把產生器重跑一次，逐字比對：
# 只要有人手改了 SVG，或改了 floorplan 卻忘記重跑產生器，建置就停下來。
RENDERER = ".claude/skills/floorplan-generator/scripts/render_svg.py"

if not os.path.exists(RENDERER):
    errors.append("找不到 %s——沒有它就無從確認網站顯示的圖面還跟資料一致，"
                  "而圖面過期在畫面上看不出來" % RENDERER)
else:
    for path, f in zip(floorplan_paths, floorplans):
        svg_path = path.replace(".floorplan.json", ".svg")
        if not os.path.exists(svg_path):
            errors.append("%s 沒有對應的圖面 %s——檢視器就是顯示這個檔案，缺了整頁只剩空白"
                          % (os.path.basename(path), os.path.basename(svg_path)))
            continue
        proc = subprocess.Popen([sys.executable, RENDERER, path],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        rendered, stderr = proc.communicate()
        if proc.returncode != 0:
            errors.append("%s 畫不出 %s: %s"
                          % (RENDERER, os.path.basename(path), stderr.decode("utf-8", "replace").strip()))
            continue
        committed = io.open(svg_path, "rb").read()
        check(rendered == committed,
              "%s 與重跑產生器的結果不一致——不是有人手改了 SVG，就是改了 floorplan 卻沒重跑產生器。"
              "圖面是 floorplan 的投影，不是資料（CONTEXT.md）；修法：\n"
              "       python3 %s %s -o %s" % (os.path.basename(svg_path), RENDERER, path, svg_path))


# --- confused_with 必須雙向登錄（PRD §7.2）---
# 「撒水頭跟偵煙器很像」與「偵煙器跟撒水頭很像」是同一件事。單向登錄遲早會兩邊不同步，
# 而答錯回饋兩個方向都會用到，所以這裡是 error 不是 warning。
cw = {}
for s in symbols:
    for pair in s.get("confused_with") or []:
        check(isinstance(pair, dict) and pair.get("symbol_id") and pair.get("difference"),
              "%s: confused_with 每一項都要有 symbol_id 與 difference" % s["id"])
        if isinstance(pair, dict) and pair.get("symbol_id"):
            cw.setdefault(s["id"], set()).add(pair["symbol_id"])
            check(pair["symbol_id"] in symbol_ids,
                  "%s: confused_with 指向不存在的 symbol_id: %s" % (s["id"], pair["symbol_id"]))
            check(pair["symbol_id"] != s["id"], "%s: confused_with 不能指向自己" % s["id"])
for a, targets in cw.items():
    for b in targets:
        check(a in cw.get(b, set()),
              "confused_with 只登錄了單向: %s → %s，但 %s 沒有指回 %s" % (a, b, b, a))

# --- 雙向一致性: symbol.related_layouts vs 實際 hotspot ---
# related_layouts 存的是 layout.id，而 floorplan.id 與 layout.id 相同，故可直接比對。
actual = {}
for f in floorplans:
    for h in f["hotspots"]:
        actual.setdefault(h["symbol_id"], set()).add(f["id"])
for s in symbols:
    declared = set(s.get("related_layouts") or [])
    real = actual.get(s["id"], set())
    for lid in declared - real:
        warnings.append("%s 宣稱出現在 %s，但該圖沒有對應 hotspot——"
                        "若是刻意的（例如「樑」：建案平面圖不畫樑，只做符號頁），"
                        "這條警告就是預期行為；否則代表圖或清單少了東西" % (s["id"], lid))

# --- 報告 ---
verified = sum(1 for s in symbols if s["verification_status"] == "verified")
rate = verified / len(symbols) if symbols else 0

print("\n資料驗證報告 (PRD v0.3.1)")
print("=" * 46)
for w in warnings:
    print("  ⚠  %s" % w)
for e in errors:
    print("  ✗  %s" % e)
if not errors:
    print("  ✓ symbol.id unique")
    print("  ✓ hotspot.id unique")
    print("  ✓ hotspot.symbol_id 全部存在")
    print("  ✓ hotspot.source 合法")
    print("  ✓ confused_with 雙向一致")
    print("  ✓ enum 值合法")
    print("  ✓ risk_flags 已移除")
    print("  ✓ verified 符號內容完整")
    print("  ✓ svg_ref 全部存在於 sprite")
    print("  ✓ 圖面產物與 floorplan 同步（重跑產生器逐字比對）")
print("-" * 46)
print("  %d symbols validated" % len(symbols))
print("  %d sprite symbols" % len(sprite_ids))
print("  %d floorplans validated" % len(floorplans))
print("  %d hotspots validated" % len(hotspot_ids))
print("  %d broken references" % broken_refs)
print("  查證率 %d/%d = %.0f%%  (上線門檻 80%%) %s"
      % (verified, len(symbols), rate * 100, "✓" if rate >= 0.8 else "← 未達標"))
print("=" * 46)
print("  %d errors, %d warnings\n" % (len(errors), len(warnings)))
sys.exit(1 if errors else 0)
