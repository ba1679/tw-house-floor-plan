"""Run: python3 -m unittest discover -s <skill>/tests -v (stdlib only)."""

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
ROOT = SKILL.parents[2]
SCRIPT = SKILL / "scripts/validate_domain_rules.py"
spec = importlib.util.spec_from_file_location("domain_validator", SCRIPT)
domain = importlib.util.module_from_spec(spec)
spec.loader.exec_module(domain)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


class DomainTests(unittest.TestCase):
    def setUp(self):
        self.before = read(SKILL / "tests/fixtures/3b2l_before.floorplan.json")
        self.rules = read(SKILL / "knowledge/adjacency-rules.json")
        self.catalog = read(SKILL / "knowledge/fixture-dimensions.json")

    def report(self, plan=None, context=None):
        return domain.validate(plan or self.before, self.rules, self.catalog, context)

    def test_original_regression_measurements(self):
        report = self.report()
        checks = {c["id"]: c for c in report["checks"]}
        expected = {
            "f-wardrobe-m_front_e": 8,
            "f-desk-2_front_s": 26,
            "f-toilet-g_front_w": 35,
            "f-sink-g_front_e": 55,
            "f-toilet-m_front_s": 0,
            "f-sink-m_front_n": 9,
            "f-bed-2_front_w": 25,
        }
        for key, measured in expected.items():
            with self.subTest(key=key):
                self.assertEqual(checks[key]["measured_cm"], measured)
                self.assertEqual(checks[key]["status"], "fail")
        self.assertEqual(report["status"], "needs_revision")
        self.assertEqual(sum(f["blocking"] for f in report["findings"]), 7)
        self.assertTrue(
            all(f.get("rule_type") != "HARD_CONSTRAINT" for f in report["findings"])
        )

    def test_revised_plan_has_no_known_blockers_but_remains_unknown(self):
        plan = read(ROOT / "data/layouts/3b2l_standard.floorplan.json")
        context = read(ROOT / "data/layouts/3b2l_standard.domain-context.json")
        report = self.report(plan, context)
        self.assertFalse(any(f["blocking"] for f in report["findings"]))
        self.assertEqual(report["status"], "unknown")
        self.assertTrue(report["professional_review_required"])
        checks = {c["id"]: c for c in report["checks"]}
        self.assertGreaterEqual(checks["f-wardrobe-m_front_s"]["measured_cm"], 60)
        self.assertGreaterEqual(checks["f-desk-2_front_s"]["measured_cm"], 60)
        self.assertEqual(
            {
                c["side"]
                for c in report["checks"]
                if c["id"].startswith("f-dining_front")
            },
            {"n", "s"},
        )

    def test_all_four_directions_and_mm_conversion(self):
        for rotation, side in domain.FACING.items():
            with self.subTest(rotation=rotation):
                item = dict(
                    id="fixture",
                    type="toilet",
                    room_id="room",
                    rotation=rotation,
                    facing=side,
                    geometry=dict(x=70, y=70, width=60, height=60),
                )
                room = dict(
                    id="room",
                    type="bathroom",
                    geometry=dict(x=0, y=0, width=200, height=200),
                    inner=dict(x=0, y=0, width=200, height=200),
                )
                report = self.report(dict(unit="cm", rooms=[room], furniture=[item]))
                check = next(
                    c for c in report["checks"] if c["id"].startswith("fixture_front")
                )
                self.assertEqual((check["measured_cm"], check["target_cm"]), (70, 60))

    def test_gap_uses_full_edge_columns_and_touching(self):
        rect = dict(x=20, y=20, width=40, height=40)
        inner = dict(x=0, y=0, width=200, height=200)
        column = dict(x=120, y=59, width=20, height=20)
        self.assertEqual(
            domain.front_gap(rect, "e", inner, [("column", column)]), (60, "column")
        )
        column["y"] = 60  # tangential only; no overlap
        self.assertEqual(
            domain.front_gap(rect, "e", inner, [("column", column)]),
            (140, "room_boundary"),
        )

    def test_gap_does_not_round_a_failure_up_to_target(self):
        rect = dict(x=0, y=0, width=40, height=70)
        inner = dict(x=0, y=0, width=99.999, height=200)
        gap, _ = domain.front_gap(rect, "e", inner, [])
        self.assertLess(gap, 60)

    def test_nearest_shaft_object_is_actually_nearest(self):
        shaft = copy.deepcopy(self.before["rooms"][0])
        shaft.update(id="closest-shaft", type="pipe_shaft")
        shaft["geometry"] = copy.deepcopy(
            next(r for r in self.before["rooms"] if r["id"] == "room-kitchen")[
                "geometry"
            ]
        )
        self.before["rooms"].append(shaft)
        check = next(
            c
            for c in self.report()["checks"]
            if c["id"] == "room-kitchen_service_distance"
        )
        self.assertEqual(check["objects"][1], "closest-shaft")
        self.assertEqual(check["measured_cm"], 0)

    def test_missing_information_is_not_pass(self):
        findings = {f["id"]: f for f in self.report()["findings"]}
        for key in (
            "f-dining_seating_unknown",
            "f-shower-g_direction_unknown",
            "f-wardrobe-m_operation_unknown",
            "room-bath-g_ventilation_unknown",
            "wet_area_cluster_manual",
        ):
            self.assertEqual(findings[key]["status"], "unknown")
        self.assertIn("固定窗", findings["room-bath-g_ventilation_unknown"]["message"])

    def test_missing_furniture_and_service_have_distinct_findings(self):
        self.before["furniture"] = []
        self.before["rooms"] = [
            r for r in self.before["rooms"] if r["type"] != "pipe_shaft"
        ]
        report = self.report()
        ids = [f["id"] for f in report["findings"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn("fixtures_missing", ids)
        self.assertEqual(report["status"], "unknown")

    def test_bad_units_nonfinite_and_room_references_are_rejected(self):
        for defect in (
            "unit",
            "nan",
            "zero",
            "reference",
            "duplicate",
            "rotation",
            "outside",
        ):
            with self.subTest(defect=defect):
                plan = copy.deepcopy(self.before)
                if defect == "unit":
                    plan["unit"] = "mm"
                if defect == "nan":
                    plan["rooms"][0]["inner"]["width"] = float("nan")
                if defect == "zero":
                    plan["furniture"][0]["geometry"]["width"] = 0
                if defect == "reference":
                    plan["furniture"][0]["room_id"] = "missing"
                if defect == "duplicate":
                    plan["furniture"].append(copy.deepcopy(plan["furniture"][0]))
                if defect == "rotation":
                    plan["furniture"][0]["rotation"] = 0
                if defect == "outside":
                    plan["furniture"][0]["geometry"]["x"] = -100
                with self.assertRaises(ValueError):
                    self.report(plan)

    def test_invalid_catalog_and_context_are_rejected(self):
        self.catalog["fixtures"][0]["front_clearance_mm"] = -1
        with self.assertRaises(ValueError):
            self.report()
        self.catalog["fixtures"][0]["front_clearance_mm"] = 600
        for context in (
            {"fixtures": {"typo": {}}},
            {"fixtures": {"f-dining": {"seating_sides": []}}},
            {"fixtures": {"f-shower-g": {"entrance_side": "z"}}},
            {"fixtures": {"f-dining": {"seatng_sides": ["n"]}}},
        ):
            with self.subTest(context=context), self.assertRaises(ValueError):
                self.report(context=context)

    def test_cli_exit_codes_and_errors(self):
        command = [
            sys.executable,
            str(SCRIPT),
            "--rules",
            str(SKILL / "knowledge/adjacency-rules.json"),
            "--fixtures",
            str(SKILL / "knowledge/fixture-dimensions.json"),
            "--summary",
            "--plan",
        ]
        self.assertEqual(
            subprocess.run(
                command + [str(SKILL / "tests/fixtures/3b2l_before.floorplan.json")],
                capture_output=True,
            ).returncode,
            1,
        )
        self.assertEqual(
            subprocess.run(
                command + [str(ROOT / "data/layouts/3b2l_standard.floorplan.json")],
                capture_output=True,
            ).returncode,
            0,
        )
        with tempfile.TemporaryDirectory() as folder:
            bad = Path(folder) / "invalid.json"
            bad.write_text("{", encoding="utf-8")
            for path in (bad, Path(folder) / "missing.json"):
                result = subprocess.run(
                    command + [str(path)], capture_output=True, text=True
                )
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("Traceback", result.stderr)

    def test_outer_frame_and_columns_are_preserved(self):
        after = read(ROOT / "data/layouts/3b2l_standard.floorplan.json")
        self.assertEqual(self.before["bounds"], after["bounds"])
        self.assertEqual(
            {c["id"]: c["geometry"] for c in self.before["columns"]},
            {c["id"]: c["geometry"] for c in after["columns"]},
        )

    def test_committed_plan_is_reproducible_from_layout(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "plan.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(
                        ROOT
                        / ".claude/skills/floorplan-generator/scripts/expand_layout.py"
                    ),
                    str(ROOT / "data/layouts/3b2l_standard.layout.json"),
                    "-o",
                    str(target),
                ],
                capture_output=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            actual = read(ROOT / "data/layouts/3b2l_standard.floorplan.json")
            expected = read(target)
            actual.pop("generated_at")
            expected.pop("generated_at")
            self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
