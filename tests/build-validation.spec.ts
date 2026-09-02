import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// scripts/validate_data.py 掛在 prebuild：非零退出即中斷建置，壞資料進不了正式站。
// 這裡不改動 repo 裡的資料——複製一份到 tmp 再改壞，才不會讓一次測試把真資料留在壞掉的狀態。
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "floorplan-validate-"));
  cpSync("data", join(dir, "data"), { recursive: true });
  cpSync("scripts", join(dir, "scripts"), { recursive: true });
  // 驗證會重跑 floorplan-generator 來比對圖面，所以產生器也要在沙箱裡。
  cpSync(".claude", join(dir, ".claude"), { recursive: true });
  return dir;
}

function runValidator(cwd: string): { code: number; output: string } {
  try {
    const output = execFileSync("python3", ["scripts/validate_data.py"], { cwd, encoding: "utf8" });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

const FLOORPLAN = "data/layouts/3b2l_standard.floorplan.json";
const ARTWORK = "data/layouts/3b2l_standard.svg";

test.describe("build 時的資料驗證", () => {
  test("資料完好時通過", () => {
    expect(runValidator(sandbox()).code).toBe(0);
  });

  test("hotspot 指向不存在的 symbol 時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.hotspots[0].symbol_id = "symbol_that_does_not_exist";
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("symbol_that_does_not_exist");
  });

  test("hotspot.id 重複時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.hotspots[1].id = plan.hotspots[0].id;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    expect(runValidator(dir).code).not.toBe(0);
  });

  // 網址由檔名決定（data/layouts/<id>.floorplan.json → /layouts/<id>）。
  test("檔名與 floorplan.id 對不上時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.id = "3b2l_renamed";
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("3b2l_renamed");
  });
});

// 網站顯示的是 data/layouts/*.svg 這個產物，熱區卻讀 floorplan JSON（docs/adr/0002）。
// 兩者一旦不同步，使用者就會看著一張畫錯的圖、點在錯的位置——而畫面上看不出來，
// 所以驗證會把 floorplan-generator 重跑一次，逐字比對產物。以下兩條是它擋的兩個方向。
test.describe("圖面產物與 floorplan 的同步", () => {
  test("有人手改了圖面 SVG 時，建置失敗", () => {
    const dir = sandbox();
    const before = readFileSync(join(dir, ARTWORK), "utf8");
    const after = before.replace(/(<rect id="room-master"[^>]*?)x="[-\d.]+"/, '$1x="300"');
    expect(after, "fixture 沒改到 room-master，這條測試等於沒測").not.toBe(before);
    writeFileSync(join(dir, ARTWORK), after);

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("重跑產生器");
  });

  test("改了 floorplan 卻沒重跑產生器時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.rooms[0].geometry.width = 300;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan, null, 2));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("3b2l_standard.svg");
  });
});
