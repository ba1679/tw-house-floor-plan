import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFloorPlanArtwork } from "./artwork";
import type { FloorPlan, FloorPlanArtwork } from "./types";

// 資料在 build 時讀入，執行期不打 API、不連資料庫（PRD §10）。
// 這個模組是整個檢視器唯一碰檔案系統的地方；頁面與元件只看得到 FloorPlanBundle。

const LAYOUTS_DIR = join(process.cwd(), "data", "layouts");
const FLOORPLAN_SUFFIX = ".floorplan.json";

export type FloorPlanBundle = {
  floorplan: FloorPlan;
  artwork: FloorPlanArtwork;
};

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

/** 檔名與內容是否對得上、圖面是否還跟資料同步，由 scripts/validate_data.py 在 build 前擋掉。 */
export function loadFloorPlanBundle(id: string): FloorPlanBundle {
  return {
    floorplan: JSON.parse(
      readFileSync(join(LAYOUTS_DIR, `${id}${FLOORPLAN_SUFFIX}`), "utf8"),
    ) as FloorPlan,
    artwork: parseFloorPlanArtwork(readFileSync(join(LAYOUTS_DIR, `${id}.svg`), "utf8")),
  };
}
