#!/usr/bin/env python3
"""
資料完整性驗證（PRD v0.3.1 §10.1 ③ 的原型）

這是 Python 原型，用來在 Next.js 專案建起來之前先驗證資料檔。
正式版應以 zod 實作並掛進 build，任一項失敗即中斷建置。

用法: python3 scripts/validate_data.py
"""
import json, io, sys, glob, os
import xml.etree.ElementTree as ET
from collections import Counter

# verification_status 描述的是「**來源查證**做到哪」，所以這裡只擋查證這件事本身的紀錄。
# caution（買房時要注意什麼）刻意不在清單裡：它要的是建築技術規則、防火門 A/B 分級、
# 採光通風規定這類**法規**來源，與畫法來源是兩回事，不能從製圖規範推導
# （symbols.sample.json 的 _meta.content_state 已經這樣寫，SymbolRecord 也宣告它可為 null）。
# 把它綁進來等於宣告「沒有法規注意事項的符號就不算查證完成」，那是把兩條軸混成一條
# （CONTEXT.md 的「Source Tier」與「Verification Status」兩條對此警告過），而且 14 筆裡
# 只有雨遮有 caution——查證率上限因此被壓到 1/14 = 7%，上線門檻 80% 在算術上不可能達成。
#
# 理由與欄位寫在同一行，一個欄位一句自己的：共用一句會退化成「這些欄位就是要填」，
# 而那正是 caution 當初混進來沒被擋下的原因——清單裡的每一項都說不出自己為什麼在清單裡。
# 也因此不拆成「清單」與「理由表」兩份：兩份手工同步的東西，漏掉一邊就是 KeyError 炸在
# 驗證器裡，而不是一條說得清楚的驗證錯誤。
REQUIRED_WHEN_VERIFIED = {
    "plain_meaning": "verified 的意思是這個符號的說法已經查到來源，"
                     "沒有白話意思就沒有任何被查證的內容",
    "source_refs": "查證的產物就是出處，少了它 verified 說不出自己憑什麼——"
                   "而「憑什麼」正是本站的核心主張",
    "verified_at": "verified 要記得這筆查證是什麼時候做的，缺了日期就看不出它有多舊",
    "verified_by": "verified 要記得這筆查證是誰做的，缺了人就沒有人能被問起它",
}

# 符號頁是搜尋落地頁（PRD §6.2.1），這幾個欄位是它渲染得出一頁的最低限度。
# 缺一個的後果不是報錯而是**靜默少一塊**：標題少一半、圖形留白、徽章不見、轉換點的按鈕不見——
# 那看起來像設計沒做完，不像資料出問題，所以擋在建置之前。
#
# 理由與欄位寫在同一行，一個欄位一句自己的（與 REQUIRED_WHEN_VERIFIED 同一條規矩）：
# 共用一句會退化成「這些欄位就是要填」，而清單裡說不出自己為什麼在清單裡的那一項，
# 遲早會變成下一個 caution。
REQUIRED_CONTENT = {
    "name": "符號頁的標題由它生成（「平面圖上的○○是什麼？」），沒有名字就沒有標題，"
            "而標題正是搜尋結果上使用者看到的那一行",
    "plain_meaning": "讀者三秒內要的那句答案，缺了它這一頁就只剩一張圖和一個徽章",
    "svg_ref": "符號頁的圖形取自 sprite 的這一格，缺了它頁面上就是一塊空白",
    "category": "分類頁的清單由符號的 category 算出來，沒有分類的符號哪一頁都不會列到它",
    "source_tier": "答案出自哪一級文件——「這個答案硬到什麼程度」是本站相對於內容農場的"
                   "核心主張，沒有它符號頁就退化成一篇說不出自己憑什麼的文章",
    "related_layouts": "符號頁底部的轉換點由它決定帶讀者去哪裡，空的話那一頁安靜地沒有按鈕——而那顆按鈕"
                       "是把搜尋流量帶進平面圖的唯一入口（PRD §6.2.1）。連樑都填得出值：它在圖上沒有熱區，"
                       "我們照樣帶讀者去看那張圖（規格主人 2026-09-13 的決定 D3）",
}
VALID_TIERS = {"cns", "regulation", "convention", "varies"}
VALID_STATUS = {"verified", "partial", "pending_purchase", "blocked"}
# 階段一只收這三類（PRD §4.1）。plumbing_electric 與 fire_safety 曾經也在這裡——它們是
# v0.4 刻意砍出範圍的設備類，**不是打錯字**：《室內設計裝修製圖規範》p9 表 3 把開關插座
# 位置圖、消防設備圖、給排水配置圖與平面配置圖列為不同的圖，設備符號本來就不畫在建案
# 平面圖上，而階段一教的正是看懂建案平面圖。
#
# 收窄有實際的後果，不只是清單短了兩項：分類頁的清單由資料算出（出現過的分類才產生頁面，
# lib/symbols/data.ts 的 loadCategories），放行一個設備類符號就會多長一張分類頁，而
# lib/ui/copy.ts 的 CATEGORY_LABELS 裡沒有它的中文名——next build 會死在渲染那一頁的
# 時候，而那個 TypeError 不會說是哪一個符號。
#
# **「每個合法分類都有中文名」刻意不在這裡檢查。** 中文名在 TypeScript 的文案常數裡，
# 這支 Python 讀不到它；在這裡檢查就得再抄一份中文名，變成第二份會跟 UI 分岔的清單。
# 所以這條保證拆成兩半，各自用看得到事實的語言把關：Python 管「資料裡的分類合不合法」，
# TypeScript 管「合法的分類有沒有中文名」（CATEGORY_LABELS 的型別是以 SymbolCategory
# 為 key 的 Record，少一個 key 直接編譯失敗）。中文名因此只有一份。
#
# **但兩半之間仍有一份手工同步的東西：合法分類的 id 清單本身**——這裡的 VALID_CATEGORIES 與
# lib/symbols/types.ts 的 SymbolCategory。只放寬這一邊、再有符號用上那一類的話，tsc 照樣是綠的
# （資料是 JSON.parse 之後 `as` 進去的），建置會死在分類頁取中文名的那一行，而那個 TypeError
# 不會說是兩份清單分岔了。tests/build-validation.spec.ts 比對這兩份，分岔時說得出是哪兩份。
VALID_CATEGORIES = {"structure", "door_window", "furniture"}
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

# --- 符號頁渲染得出一頁：必填內容欄位非空 ---
for s in symbols:
    for f, why in REQUIRED_CONTENT.items():
        check(s.get(f), "%s: %s 為空——%s" % (s["id"], f, why))

# --- enum 值合法 ---
for s in symbols:
    check(s.get("category") in VALID_CATEGORIES,
          "%s: category 非法值 %r——階段一只收 %s。設備類（plumbing_electric／fire_safety）"
          "不在清單上不是打錯字，是 v0.4 刻意砍出範圍的：設備符號畫在開關插座、消防、給排水"
          "那幾張圖上，不畫在建案平面圖上（PRD §4.1）。要收回來得先改 PRD 的範圍，不是在這裡"
          "加回去——分類頁由資料算出，放行一類就多長一張頁面，而文案常數裡沒有它的中文名"
          % (s["id"], s.get("category"), "、".join(sorted(VALID_CATEGORIES))))
    check(s["verification_status"] in VALID_STATUS, "%s: verification_status 非法值 %r" % (s["id"], s["verification_status"]))
    if s.get("source_tier") is not None:
        check(s["source_tier"] in VALID_TIERS, "%s: source_tier 非法值 %r" % (s["id"], s["source_tier"]))

# --- v0.3: risk_flags 必須已移除 ---
for s in symbols:
    check("risk_flags" not in s, "%s: 仍含 risk_flags，v0.3 已刪除此欄位（PRD §7.2.1）" % s["id"])

# --- verified 的符號必須有完整的查證紀錄 ---
for s in symbols:
    if s["verification_status"] == "verified":
        for f, why in REQUIRED_WHEN_VERIFIED.items():
            check(s.get(f), "%s: 標記 verified 但 %s 為空——%s" % (s["id"], f, why))
        check(s.get("source_tier"),
              "%s: 標記 verified 但無 source_tier——查證完成卻不說答案出自哪一級文件，"
              "讀者就無法判斷這個答案硬到什麼程度；這兩個欄位是兩條不同的軸，"
              "不可互相取代（CONTEXT.md）" % s["id"])

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
    # 「有沒有 svg_ref」在 REQUIRED_CONTENT 那一輪就問過了，這裡只問它指得到不到。
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
        # symbol_id 為 None 是合法的：schema 寫著「這個開口目前沒有對應的已查證符號
        # （M1 未完成），viewer 應略過」。M1 的內容查證與 M2 並行，把 None 當成斷掉的參照
        # 會讓查證還沒做完的圖整張上不了線——那正是 null 要避免的事。
        if h["symbol_id"] is not None and h["symbol_id"] not in symbol_ids:
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

# --- floorplan 畫得出來（檢視器自己渲染，docs/adr/0005）--------------------
# 票 07 之後網站不再顯示產生器畫好的 SVG，而是自己讀這份 JSON 把圖畫出來。
# 少一個欄位的後果因此換了一種：從前是「圖面過期、而畫面上看不出來」，
# 現在是**整個 next build 死在 renderer 裡**——而那個 TypeError 不會說是哪一份檔案、
# 哪一間房。所以這裡把 renderer 會直接取用的欄位擋在建置之前，訊息裡帶上檔名與 id。
GEOMETRY = ["x", "y", "width", "height"]
POINT = ["x", "y"]
# 檢視器靠 rotation 決定傢俱哪一邊是背面。資料裡只有 90 的倍數，產生器的碰撞規則也是
# （hotspot 的 coords 本來就是軸向矩形），所以這裡照實擋住，不留一個會被默默吸附的角度。
ROTATIONS = {0, 90, 180, 270}


def require(what, obj, fields):
    for field in fields:
        check(isinstance(obj, dict) and obj.get(field) is not None,
              "%s 缺 %s——檢視器渲染時直接取用這個欄位，缺了建置會死在 renderer 裡，"
              "而那個錯誤訊息不會告訴你是哪一份檔案、哪一個 id" % (what, field))


for path, plan in zip(floorplan_paths, floorplans):
    src = os.path.basename(path)
    require("%s 的 bounds" % src, plan.get("bounds"), ["width", "height"])

    for rm in plan.get("rooms") or []:
        what = "%s 的 room %s" % (src, rm.get("id"))
        require(what, rm, ["id", "type", "name", "area_ping"])
        require(what + " 的 geometry", rm.get("geometry"), GEOMETRY)

    wall_ids = set(w.get("id") for w in plan.get("walls") or [])
    for w in plan.get("walls") or []:
        what = "%s 的 wall %s" % (src, w.get("id"))
        require(what, w, ["id", "orientation", "thickness"])
        require(what + " 的 start", w.get("start"), POINT)
        require(what + " 的 end", w.get("end"), POINT)

    openings = [("door", d) for d in plan.get("doors") or []]
    openings += [("window", w) for w in plan.get("windows") or []]
    for kind, op in openings:
        what = "%s 的 %s %s" % (src, kind, op.get("id"))
        require(what, op, ["id", "type", "wall_id", "offset", "width"])
        check(op.get("wall_id") in wall_ids,
              "%s 掛在不存在的 wall_id %r 上——檢視器畫不出這個開口，"
              "牆上就少一個洞，而那件事在圖上看起來只像牆比較長" % (what, op.get("wall_id")))

    for fn in plan.get("furniture") or []:
        what = "%s 的 furniture %s" % (src, fn.get("id"))
        require(what, fn, ["id", "type", "room_id", "rotation"])
        require(what + " 的 geometry", fn.get("geometry"), GEOMETRY)
        check(fn.get("rotation") in ROTATIONS,
              "%s 的 rotation 是 %r，檢視器只認得 %s——它靠這個值決定哪一邊是背面"
              "（馬桶的水箱、床的枕頭側、洗臉盆的牆線都畫在背面）。"
              "認不得的角度會被當成 0，圖上的朝向就錯了，而且不會報錯"
              % (what, fn.get("rotation"), sorted(ROTATIONS)))

    for col in plan.get("columns") or []:
        require("%s 的 column %s 的 geometry" % (src, col.get("id")), col.get("geometry"), GEOMETRY)
    for cp in plan.get("canopies") or []:
        require("%s 的 canopy %s 的 geometry" % (src, cp.get("id")), cp.get("geometry"), GEOMETRY)
    for an in plan.get("annotations") or []:
        what = "%s 的 annotation %s" % (src, an.get("id"))
        require(what, an, ["id", "type", "label"])
        require(what + " 的 start", an.get("start"), POINT)
        require(what + " 的 end", an.get("end"), POINT)


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

# --- related_layouts 指到的格局都存在（M3 票 08）---
# 符號頁底部的轉換點由它決定帶讀者去哪張圖（/layouts/<id>?symbol=<symbol>）。對不到的 id 就是
# 一顆通往 404 的按鈕，而那顆按鈕是把搜尋流量帶進平面圖的唯一入口（PRD §6.2.1）——壞掉的那一天
# 符號頁看起來完全正常，所以是 error，不是下面那一種 warning。
#
# 「存在」以 floorplan 為準，不以 *.layout.json：網站的 /layouts/<id> 由 floorplan 的檔名決定
# （lib/floorplan/data.ts 的 listLayoutIds），只有 layout spec 沒有 floorplan 的格局沒有頁面。
known_layouts = set(floorplan_ids)
for s in symbols:
    for lid in s.get("related_layouts") or []:
        check(lid in known_layouts,
              "%s: related_layouts 裡的 %r 對不到任何格局——符號頁的轉換點由它決定帶讀者去哪張圖，"
              "對不到就是一顆通往 404 的按鈕，而那是把搜尋流量帶進平面圖的唯一入口（PRD §6.2.1）。"
              "現有的格局：%s" % (s["id"], lid, "、".join(sorted(known_layouts))))

# --- 雙向一致性: symbol.related_layouts vs 實際 hotspot ---
# related_layouts 存的是 layout.id，而 floorplan.id 與 layout.id 相同，故可直接比對。
actual = {}
for f in floorplans:
    for h in f["hotspots"]:
        if h["symbol_id"] is None:
            continue  # 還沒指向任何符號，不算任何 symbol 的一次出現
        actual.setdefault(h["symbol_id"], set()).add(f["id"])
for s in symbols:
    # 對不到任何格局的 id 上面已經報成 error，這裡不再多報一條「該圖沒有對應 hotspot」——根本沒有那張圖。
    declared = set(s.get("related_layouts") or []) & known_layouts
    real = actual.get(s["id"], set())
    # 刻意的那一種（樑）在網站上有自己的樣子（M3 票 09）：符號頁的按鈕改說「這張圖上看不到」，
    # 平面圖上跳一條橫幅說明為什麼。那條橫幅的說明是**為樑寫的**（施工圖與結構圖），所以訊息把這件事說出來——
    # 第二個這樣的符號出現時，這條 warning 是唯一會提醒人回頭改那一句的地方。
    for lid in declared - real:
        warnings.append("%s 宣稱出現在 %s，但該圖沒有對應 hotspot——"
                        "若是刻意的（例如「樑」：建案平面圖不畫樑），這條警告就是預期行為："
                        "符號頁的按鈕會改說這張圖上看不到它，平面圖上會跳一條橫幅說明為什麼。"
                        "但那條橫幅的說明是為樑寫的（lib/ui/copy.ts 裡橫幅的那一句），不是樑的話要回頭改。"
                        "若不是刻意的，代表圖或清單少了東西" % (s["id"], lid))

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
    print("  ✓ hotspot.symbol_id 指到的 symbol 都存在（null = 查證未完成，合法）")
    print("  ✓ hotspot.source 合法")
    print("  ✓ confused_with 雙向一致")
    print("  ✓ enum 值合法（category 只收階段一三類，設備類已在 v0.4 砍出範圍）")
    print("  ✓ 符號的必填內容欄位非空（符號頁渲染得出一頁）")
    print("  ✓ risk_flags 已移除")
    print("  ✓ verified 符號的查證紀錄完整（caution 不綁在查證完備性上，它要的是法規來源）")
    print("  ✓ svg_ref 全部存在於 sprite")
    print("  ✓ related_layouts 指到的格局都存在（符號頁的轉換點不會通往 404）")
    print("  ✓ floorplan 的欄位齊全、傢俱朝向認得（檢視器畫得出來）")
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
