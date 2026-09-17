#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""2D concept screening, NOT compliance. Exit 0: reviewed (may be unknown); 1: blockers; 2: input error."""

import argparse
import json
import math
import sys
from pathlib import Path

SIDES = {"n", "e", "s", "w"}
FACING = {0: "s", 90: "e", 180: "n", 270: "w"}


def positive(v):
    return (
        isinstance(v, (int, float))
        and not isinstance(v, bool)
        and math.isfinite(v)
        and v > 0
    )


def check_rect(rect):
    if not isinstance(rect, dict) or not all(
        isinstance(rect.get(k), (int, float))
        and not isinstance(rect[k], bool)
        and math.isfinite(rect[k])
        for k in ("x", "y", "width", "height")
    ):
        raise ValueError("geometry / inner 必須是有限數值的矩形")
    if not positive(rect["width"]) or not positive(rect["height"]):
        raise ValueError("矩形寬高必須大於零")


def center(rect):
    return rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2


def distance(a, b):
    return math.dist(center(a), center(b))


def front_gap(rect, side, inner, obstacles):
    """Minimum depth across full front edge to wall/solid obstacle. Touching is allowed."""
    axis, cross, size, span = (
        ("x", "y", "width", "height")
        if side in {"e", "w"}
        else ("y", "x", "height", "width")
    )
    forward = side in {"e", "s"}
    edge = rect[axis] + (rect[size] if forward else 0)
    bound = inner[axis] + (inner[size] if forward else 0)
    gap, blocker = (bound - edge if forward else edge - bound), "room_boundary"
    for oid, other in obstacles:
        if (
            min(rect[cross] + rect[span], other[cross] + other[span])
            - max(rect[cross], other[cross])
            <= 1e-6
        ):
            continue
        lo, hi = other[axis], other[axis] + other[size]
        if forward and hi > edge:
            candidate = max(0, lo - edge)
        elif not forward and lo < edge:
            candidate = max(0, edge - hi)
        else:
            continue
        if candidate < gap:
            gap, blocker = candidate, oid
    # Do not round before acceptance: 59.999 cm must not become a 60 cm pass.
    return max(0, gap), blocker


def validate(plan, rules, catalog, context=None):
    context = context or {}
    if plan.get("unit") != "cm" or not plan.get("rooms"):
        raise ValueError("需要非空 rooms 與明確 unit=cm；不可猜測單位")
    rooms, ids = {}, set()
    for group in ("rooms", "furniture", "columns"):
        for item in plan.get(group, []):
            if not isinstance(item.get("id"), str) or item["id"] in ids:
                raise ValueError("rooms / furniture / columns id 必須存在且唯一")
            ids.add(item["id"])
            check_rect(item["geometry"])
            if group == "rooms":
                check_rect(item["inner"])
                rooms[item["id"]] = item
    furniture = plan.get("furniture", [])
    for item in furniture:
        if item.get("room_id") not in rooms:
            raise ValueError(f"{item['id']} room_id 不存在")
        inner, rect = rooms[item["room_id"]]["inner"], item["geometry"]
        if any(
            rect[axis] < inner[axis]
            or rect[axis] + rect[size] > inner[axis] + inner[size]
            for axis, size in (("x", "width"), ("y", "height"))
        ):
            raise ValueError(f"{item['id']} 超出房間內緣；先修正 geometry")
    if set(context) - {"note", "fixtures"}:
        raise ValueError("context 只接受 note / fixtures")
    for fid, detail in context.get("fixtures", {}).items():
        if set(detail) - {"entrance_side", "seating_sides"}:
            raise ValueError("context fixture 含未支援欄位")
        if fid not in {f["id"] for f in furniture}:
            raise ValueError(f"context fixture 不存在：{fid}")
        if "entrance_side" in detail and detail["entrance_side"] not in SIDES:
            raise ValueError("entrance_side 必須為 n/e/s/w")
        if "seating_sides" in detail and (
            not isinstance(detail["seating_sides"], list)
            or not detail["seating_sides"]
            or not set(detail["seating_sides"]) <= SIDES
            or len(set(detail["seating_sides"])) != len(detail["seating_sides"])
        ):
            raise ValueError("seating_sides 不可空白，且必須為 n/e/s/w")
    references = {}
    for ref in catalog["fixtures"]:
        if ref["type"] in references or not positive(ref["front_clearance_mm"]):
            raise ValueError("fixture type 不可重複，front_clearance_mm 必須大於零")
        for key in ("source", "knowledge_level", "confidence", "applicability"):
            if key not in ref:
                raise ValueError(f"fixture {ref['type']} 缺少 {key}")
        references[ref["type"]] = ref
    findings, checks = [], []

    def unknown(key, category, message, objects):
        findings.append(
            dict(
                id=key,
                category=category,
                severity="warning",
                status="unknown",
                message=message,
                objects=objects,
                confidence="low",
                blocking=False,
            )
        )

    for rule in rules["rules"]:
        if rule.get("validation", {}).get("type") != "distance_to_service":
            unknown(
                rule["id"] + "_manual",
                rule["category"],
                "尚未自動化，須人工檢查：" + rule["description"],
                [],
            )
            continue
        limit = rule["validation"]["max_preferred_distance_cm"]
        if not positive(limit):
            raise ValueError("max_preferred_distance_cm 必須大於零")
        shafts = [
            r for r in rooms.values() if r["type"] in {"pipe_shaft", "service_core"}
        ]
        for room in rooms.values():
            if room["type"] not in rule["spaces"]:
                continue
            if not shafts:
                unknown(
                    room["id"] + "_service_unknown",
                    "plumbing",
                    "缺少立管／管道間位置。",
                    [room["id"]],
                )
                continue
            shaft = min(shafts, key=lambda s: distance(room["geometry"], s["geometry"]))
            measured = round(distance(room["geometry"], shaft["geometry"]), 2)
            checks.append(
                dict(
                    id=room["id"] + "_service_distance",
                    objects=[room["id"], shaft["id"]],
                    measured_cm=measured,
                    target_cm=limit,
                    status="warning" if measured > limit else "pass",
                    method="center_distance_only",
                )
            )
            if measured > limit:
                findings.append(
                    dict(
                        id=room["id"] + "_far_from_service",
                        category="plumbing",
                        severity="warning",
                        status="warning",
                        blocking=False,
                        message=f"管道間中心距離 {measured:.0f} cm 超過篩查偏好 {limit} cm；不是實際管長或法定上限。",
                        objects=[room["id"], shaft["id"]],
                        rule_id=rule["id"],
                        rule_type="SOFT_CONSTRAINT",
                        confidence=rule["confidence"],
                        source=rule["source"],
                        recommendation="檢查接管點、實際路徑、坡度、樓板及檢修方式。",
                    )
                )

    if not furniture:
        unknown(
            "fixtures_missing",
            "human_factors",
            "缺少設備／家具，無法檢查使用空間。",
            [],
        )
    for item in furniture:
        fid, kind = item["id"], item["type"]
        ref = references.get(kind)
        detail = context.get("fixtures", {}).get(fid, {})
        if ref is None:
            if kind != "tv":
                unknown(
                    fid + "_unsupported",
                    "human_factors",
                    "尚無此家具的使用淨空規則。",
                    [fid],
                )
            continue
        side = detail.get("entrance_side") if kind == "shower" else item.get("facing")
        if kind == "dining_table":
            sides = detail.get("seating_sides", [])
            if not sides:
                unknown(
                    fid + "_seating_unknown",
                    "human_factors",
                    "缺少用餐側／座位安排，不能從桌面推定椅子可用。",
                    [fid],
                )
                continue
        elif side in SIDES:
            if kind != "shower" and FACING.get(item.get("rotation")) != side:
                raise ValueError(f"{fid} facing 與 rotation 不一致")
            sides = [side]
        else:
            unknown(
                fid + "_direction_unknown",
                "human_factors",
                "缺少明確使用方向／淋浴入口。",
                [fid],
            )
            continue
        if kind in {"wardrobe", "kitchen_counter", "refrigerator"}:
            unknown(
                fid + "_operation_unknown",
                "human_factors",
                "只檢查站立區；櫃門、抽屜／冰箱門型式與開啟包絡尚未驗證。",
                [fid],
            )
        obstacles = [
            (o["id"], o["geometry"])
            for o in furniture
            if o["id"] != fid and o["room_id"] == item["room_id"] and o["type"] != "tv"
        ]
        obstacles += [(o["id"], o["geometry"]) for o in plan.get("columns", [])]
        for side in sides:
            measured, blocker = front_gap(
                item["geometry"], side, rooms[item["room_id"]]["inner"], obstacles
            )
            target = ref["front_clearance_mm"] / 10
            check = dict(
                id=fid + "_front_" + side,
                objects=[fid],
                side=side,
                measured_cm=measured,
                target_cm=target,
                blocker=blocker,
                status="pass" if measured >= target else "fail",
                knowledge_level=ref["knowledge_level"],
                source=ref["source"],
                applicability=ref["applicability"],
                confidence=ref["confidence"],
            )
            checks.append(check)
            if measured < target:
                findings.append(
                    dict(
                        id=check["id"],
                        category="human_factors",
                        severity="warning",
                        status="fail",
                        blocking=True,
                        message=f"{fid} {side} 向淨空 {measured:g} cm，小於概念設計採用目標 {target:g} cm（非法律判定）。",
                        objects=[fid, blocker],
                        rule_id="fixture_front_clearance",
                        rule_type="SOFT_CONSTRAINT",
                        confidence=ref["confidence"],
                        source=ref["source"],
                        measurement=check,
                        recommendation="移動／轉向家具或調整房間比例；不得僅縮小目標值讓測試通過。",
                    )
                )

    for room in rooms.values():
        if room["type"] in {"bathroom", "toilet", "kitchen"}:
            openable = [
                w["id"]
                for w in plan.get("windows", [])
                if w.get("room") == room["id"]
                and w.get("type") in {"sliding", "casement"}
            ]
            unknown(
                room["id"] + "_ventilation_unknown",
                "ventilation_lighting",
                "圖示有可開窗；有效面積、外部條件及設備待確認。"
                if openable
                else "未見可開啟外窗；固定窗不代表自然通風，須補通風設備／外部條件。",
                [room["id"]] + openable,
            )
    unknown(
        "systems_unverified",
        "plumbing",
        "實際立管接點、坡度、通氣、防水、結構可變性及檢修通道未驗證。",
        [],
    )
    unknown(
        "coverage_unverified",
        "human_factors",
        "側向淨空、連續通行、床側上下床、門扇與使用區及維修包絡仍須人工檢查；門與本體碰撞另跑 geometry validator。",
        [],
    )
    status = (
        "needs_revision"
        if any(f["blocking"] for f in findings)
        else "unknown"
        if any(f["status"] == "unknown" for f in findings)
        else "pass_with_warnings"
        if findings
        else "pass"
    )
    return dict(
        plan_id=plan.get("id", "unnamed"),
        status=status,
        findings=findings,
        checks=checks,
        scope="2D 概念設計篩查；unknown 不代表通過",
        assumptions=[
            "cm 圖面；mm 參考尺寸除以 10。沿設備整條前緣量至牆內緣或實體障礙。",
            "blocking 是本專案的概念設計驗收阻擋，不代表法規違規。",
            "不同使用區可共用；未模擬同時使用、椅子實體、櫃門與設備維修。",
        ],
        professional_review_required=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("plan", "rules", "fixtures"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument(
        "--context",
        help="Optional concept-use assumptions JSON, not field verification",
    )
    parser.add_argument("--output", help="Full report path; omit for stdout")
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print compact status (unknown is not pass)",
    )
    args = parser.parse_args()
    try:

        def read(path):
            return json.loads(Path(path).read_text(encoding="utf-8"))

        report = validate(
            read(args.plan),
            read(args.rules),
            read(args.fixtures),
            read(args.context) if args.context else None,
        )
        encoded = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            Path(args.output).write_text(encoded, encoding="utf-8")
        if args.output or args.summary:
            print(
                json.dumps(
                    dict(
                        status=report["status"],
                        blockers=sum(f["blocking"] for f in report["findings"]),
                        unknown=sum(
                            f["status"] == "unknown" for f in report["findings"]
                        ),
                        findings=len(report["findings"]),
                        output=args.output,
                    ),
                    ensure_ascii=False,
                )
            )
        else:
            print(encoded, end="")
        return 1 if report["status"] == "needs_revision" else 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        print(f"domain input error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
