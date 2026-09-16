#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Validate residential domain risks on a generated FloorPlan JSON."""

import argparse
import json
import math
import sys
from pathlib import Path


def center(rect):
    return rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2


def distance(a, b):
    ax, ay = center(a)
    bx, by = center(b)
    return math.hypot(ax - bx, ay - by)


def main():
    parser = argparse.ArgumentParser(description="Validate residential domain rules.")
    parser.add_argument("--plan", required=True, help="Generated floorplan JSON")
    parser.add_argument("--rules", required=True, help="Adjacency rules JSON")
    parser.add_argument("--fixtures", required=True, help="Fixture reference JSON")
    parser.add_argument("--output", required=True, help="Validation report JSON")
    args = parser.parse_args()

    plan_path = Path(args.plan)
    if not plan_path.exists():
        print(f"找不到 plan: {plan_path}", file=sys.stderr)
        return 2
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    rules = json.loads(Path(args.rules).read_text(encoding="utf-8"))
    fixtures = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    rooms = {room["id"]: room for room in plan.get("rooms", [])}
    pipe_rooms = [room for room in rooms.values() if room.get("type") in {"pipe_shaft", "service_core"}]
    wet_types = {"bathroom", "toilet", "kitchen", "laundry"}
    findings = []

    proximity = next((r for r in rules.get("rules", []) if r.get("id") == "wet_area_pipe_shaft_proximity"), None)
    if proximity:
        max_cm = proximity.get("validation", {}).get("max_preferred_distance_cm", 300)
        for room in rooms.values():
            if room.get("type") not in wet_types:
                continue
            if not pipe_rooms:
                findings.append({"id":"missing_service_point", "category":"plumbing", "severity":"warning", "message":f"{room.get('name', room['id'])} 沒有可辨識的管道間或服務核心，無法驗證管線距離。", "objects":[room["id"]], "rule_id":proximity["id"], "confidence":"low", "recommendation":"補充 pipe_shaft 或實際立管位置。"})
                continue
            nearest = min(distance(room["geometry"], shaft["geometry"]) for shaft in pipe_rooms)
            if nearest > max_cm:
                findings.append({"id":f"{room['id']}_far_from_service", "category":"plumbing", "severity":"warning", "message":f"{room.get('name', room['id'])} 至最近管道間約 {nearest:.0f}cm，可能增加水平排水與維修複雜度。", "objects":[room["id"], pipe_rooms[0]["id"]], "rule_id":proximity["id"], "confidence":proximity.get("confidence", "medium"), "recommendation":"優先將濕區移近服務核心；若保留，補充樓板、坡度、管徑與立管資料。", "source":proximity.get("source", [])})

    fixture_types = {item["type"] for item in fixtures.get("fixtures", [])}
    for item in plan.get("furniture", []):
        if item.get("type") in {"toilet", "sink", "shower", "kitchen_counter"} and item["type"] not in fixture_types:
            findings.append({"id":f"fixture_{item['id']}_uncatalogued", "category":"human_factors", "severity":"warning", "message":f"設備 {item['id']} 沒有 fixture reference，無法完整檢查使用與維修空間。", "objects":[item["id"]], "confidence":"low", "recommendation":"補充設備尺寸、前方活動空間與來源。"})

    assumptions = ["此 validator 使用圖面中心距離作為初步風險指標，不等同實際排水管路長度。", "未提供樓板、坡度、管徑、通風與結構資料；法規合規性需專業複核。"]
    status = "needs_revision" if any(f["severity"] == "error" for f in findings) else ("pass_with_warnings" if findings else "pass")
    report = {"plan_id": plan.get("id", plan_path.stem), "status": status, "findings": findings, "assumptions": assumptions, "professional_review_required": True}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"plan_id": report["plan_id"], "status": status, "findings": len(findings), "output": args.output}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
