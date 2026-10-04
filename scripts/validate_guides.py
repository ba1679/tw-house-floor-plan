"""家具與尺寸導讀的建置檢查；語意查證仍由內容維護流程完成。"""
import json
from pathlib import Path


def validate_furniture_guide(floorplans):
    path = Path("data/guides/furniture-dimensions.json")
    try:
        guide = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return ["%s: 無法讀取家具導讀：%s" % (path, exc)]
    if not isinstance(guide, dict):
        return ["%s: 家具導讀必須是物件" % path]

    errors = []
    def require_text(record, fields, label):
        if not isinstance(record, dict):
            errors.append("%s: %s 必須是物件" % (path, label))
            return False
        valid = True
        for field in fields:
            value = record.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append("%s: %s 缺少 %s" % (path, label, field))
                valid = False
        return valid

    def text_list(value, label):
        if not isinstance(value, list) or not value or any(not isinstance(v, str) or not v.strip() for v in value):
            errors.append("%s: %s 必須是非空文字清單" % (path, label))
            return []
        return value

    def records(value, label):
        if not isinstance(value, list) or not value or any(not isinstance(v, dict) for v in value):
            errors.append("%s: %s 必須是非空物件清單" % (path, label))
            return []
        ids = [v.get("id") for v in value]
        if any(not isinstance(i, str) or not i.strip() for i in ids) or len(set(str(i) for i in ids)) != len(ids):
            errors.append("%s: %s 的 id 必須非空且不重複" % (path, label))
        return value

    require_text(guide, ["id", "title", "description", "layout_id"], "家具導讀")
    if guide.get("id") != path.stem:
        errors.append("%s: id 必須與檔名一致" % path)

    plan = next((p for p in floorplans if p["id"] == guide.get("layout_id")), None)
    if plan is None:
        return ["%s: layout_id 無效：%s" % (path, guide.get("layout_id"))]
    rooms = {room["id"] for room in plan.get("rooms", [])}
    features = {item["id"]: item for group in ["furniture", "doors", "windows"] for item in plan.get(group, [])}
    evidence_records = records(guide.get("evidence"), "evidence")
    evidence_ids = {str(e.get("id")) for e in evidence_records}
    for step in records(guide.get("steps"), "steps"):
        label = "step %s" % step.get("id")
        require_text(step, ["topic", "title"], label)
        text_list(step.get("paragraphs"), label + " paragraphs")
        for ref in text_list(step.get("evidence_ids"), label + " evidence_ids"):
            if ref not in evidence_ids:
                errors.append("%s: %s 的 evidence_ids 無效：%s" % (path, label, ref))
        figure = step.get("figure", {})
        if require_text(figure, ["room_id", "caption", "description"], label + " figure"):
            if figure.get("room_id") not in rooms:
                errors.append("%s: %s 的 room_id 無效：%s" % (path, label, figure.get("room_id")))
            for ref in text_list(figure.get("feature_ids"), label + " feature_ids"):
                if ref not in features:
                    errors.append("%s: %s 的 feature_ids 無效：%s" % (path, label, ref))
                else:
                    feature = features[ref]
                    room_ids = [feature.get("room_id"), feature.get("room"), feature.get("opens_to")]
                    room_ids.extend(feature.get("connects", []))
                    if figure["room_id"] not in room_ids:
                        errors.append("%s: %s 的 feature_ids %s 不屬於房間 %s" % (path, label, ref, figure["room_id"]))
    for evidence in evidence_records:
        label = "evidence %s" % evidence.get("id")
        require_text(evidence, ["label", "explanation"], label)
        text_list(evidence.get("assumptions"), label + " assumptions")
        if require_text(evidence.get("basis"), ["document", "locator", "reasoning"], label + " basis"):
            expected_document = "data/layouts/%s.floorplan.json" % plan["id"]
            if evidence["basis"].get("document") != expected_document:
                errors.append("%s: %s 的 document 必須對應教學圖 %s" % (path, label, expected_document))
        require_text(evidence.get("review"), ["date", "report", "notes"], label + " review")
    return errors
