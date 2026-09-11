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

  // schema 明寫 symbol_id 可以是 null：「這個開口目前沒有對應的已查證符號（M1 未完成），
  // viewer 應略過」。M1 的內容查證與 M2 並行，不互相阻塞——查證還沒做完也要能先上線看圖。
  test("hotspot 的 symbol_id 為 null 時，建置照樣過", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.hotspots[0].symbol_id = null;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).toBe(0);
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

// 票 07 之後圖面由檢視器自己畫（docs/adr/0005），少一個欄位的後果從「圖面過期」
// 變成「build 死在 renderer 裡」——而那個 TypeError 不會說是哪一份檔案、哪一間房。
// 驗證因此接手把 renderer 會直接取用的東西擋在建置之前。
test.describe("floorplan 畫得出來", () => {
  test("房間少了 area_ping 時，建置失敗，而且說得出是哪一間", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    delete plan.rooms[0].area_ping;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain(plan.rooms[0].id);
    expect(output).toContain("area_ping");
  });

  // 檢視器靠 rotation 決定傢俱哪一邊是背面——馬桶的水箱、床的枕頭側、洗臉盆的牆線
  // 都畫在背面。認不得的角度不會報錯，只會把朝向畫反，所以擋在建置之前。
  test("傢俱的 rotation 不是 90 的倍數時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.furniture[0].rotation = 45;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("rotation");
  });

  test("開口掛在不存在的牆上時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.doors[0].wall_id = "wall-999";
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("wall-999");
  });
});
