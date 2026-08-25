#!/usr/bin/env python3
"""
資料完整性驗證（PRD v0.3 §10.1 ③ 的原型）

這是 Python 原型，用來在 Next.js 專案建起來之前先驗證資料檔。
正式版應以 zod 實作並掛進 build，任一項失敗即中斷建置。

用法: python3 scripts/validate_data.py
"""
import json, io, sys
from collections import Counter

REQUIRED_WHEN_VERIFIED = ["plain_meaning", "caution", "source_refs", "verified_at", "verified_by"]
VALID_TIERS = {"cns", "regulation", "convention", "varies"}
VALID_STATUS = {"verified", "partial", "pending_purchase", "blocked"}
VALID_CATEGORIES = {"structure", "door_window", "plumbing_electric", "fire_safety", "furniture"}

errors, warnings = [], []


def check(cond, msg, bucket=errors):
    if not cond:
        bucket.append(msg)
    return cond


symbols = json.load(io.open("data/symbols.sample.json", encoding="utf-8"))["symbols"]
layouts = json.load(io.open("data/layouts.sample.json", encoding="utf-8"))["layouts"]

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

# --- layout / hotspot ---
layout_ids = [l["id"] for l in layouts]
for lid, n in Counter(layout_ids).items():
    check(n == 1, "layout.id 重複: %s" % lid)

hotspot_ids, broken_refs = [], 0
for l in layouts:
    for h in l["hotspots"]:
        hotspot_ids.append(h["id"])
        if h["symbol_id"] not in symbol_ids:
            broken_refs += 1
            errors.append("hotspot %s 指向不存在的 symbol_id: %s" % (h["id"], h["symbol_id"]))
for hid, n in Counter(hotspot_ids).items():
    check(n == 1, "hotspot.id 重複: %s" % hid)

# --- 雙向一致性: symbol.related_layouts vs 實際 hotspot ---
actual = {}
for l in layouts:
    for h in l["hotspots"]:
        actual.setdefault(h["symbol_id"], set()).add(l["id"])
for s in symbols:
    declared = set(s.get("related_layouts") or [])
    real = actual.get(s["id"], set())
    for lid in declared - real:
        warnings.append("%s 宣稱出現在 %s，但該圖沒有對應 hotspot" % (s["id"], lid))

# --- 報告 ---
verified = sum(1 for s in symbols if s["verification_status"] == "verified")
rate = verified / len(symbols) if symbols else 0

print("\n資料驗證報告 (PRD v0.3)")
print("=" * 46)
for w in warnings:
    print("  ⚠  %s" % w)
for e in errors:
    print("  ✗  %s" % e)
if not errors:
    print("  ✓ symbol.id unique")
    print("  ✓ hotspot.id unique")
    print("  ✓ hotspot.symbol_id 全部存在")
    print("  ✓ enum 值合法")
    print("  ✓ risk_flags 已移除")
    print("  ✓ verified 符號內容完整")
print("-" * 46)
print("  %d symbols validated" % len(symbols))
print("  %d layouts validated" % len(layouts))
print("  %d hotspots validated" % len(hotspot_ids))
print("  %d broken references" % broken_refs)
print("  查證率 %d/%d = %.0f%%  (上線門檻 80%%) %s"
      % (verified, len(symbols), rate * 100, "✓" if rate >= 0.8 else "← 未達標"))
print("=" * 46)
print("  %d errors, %d warnings\n" % (len(errors), len(warnings)))
sys.exit(1 if errors else 0)
