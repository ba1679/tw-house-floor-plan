import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { FloorPlan } from "./types";

// 資料在 build 時讀入，執行期不打 API、不連資料庫（PRD §10）。
// 圖面資料只有這個模組讀得到檔案系統；頁面與元件只看得到 FloorPlan。
// （symbol 是內容、與任何一張圖無關，它自己的載入器在 lib/symbols/data.ts。）
//
// 票 07 之前這裡還會讀一份 `data/layouts/<id>.svg`——floorplan-generator 畫好的圖面產物，
// 網站直接顯示它。現在圖由檢視器自己從這份 JSON 畫（`docs/adr/0005`），那個檔案沒有讀者了。

const LAYOUTS_DIR = join(process.cwd(), "data", "layouts");
const FLOORPLAN_SUFFIX = ".floorplan.json";

/**
 * 站上有哪些格局，由 data/layouts/ 裡有哪些檔案決定。
 * 第二張圖只要放資料檔進來就會有頁面，不必回頭改程式。
 */
export function listLayoutIds(): string[] {
  return readdirSync(LAYOUTS_DIR)
    .filter((name) => name.endsWith(FLOORPLAN_SUFFIX))
    .map((name) => name.slice(0, -FLOORPLAN_SUFFIX.length))
    .sort();
}

/** 檔名與內容是否對得上，由 scripts/validate_data.py 在 build 前擋掉。 */
export function loadFloorPlan(id: string): FloorPlan {
  return JSON.parse(
    readFileSync(join(LAYOUTS_DIR, `${id}${FLOORPLAN_SUFFIX}`), "utf8"),
  ) as FloorPlan;
}
