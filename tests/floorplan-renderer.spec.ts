import { test, expect } from "@playwright/test";

// 圖面由檢視器自己從 floorplan JSON 畫出來（票 07、docs/adr/0005），不再顯示
// floorplan-generator 的產物。這一組測的是那件事換來的兩樣東西：
//   1. 圖上的每一類東西都在 DOM 上定址得到，而且跟熱區在同一個座標系裡；
//   2. **圖面依互動狀態改變畫法**——這是換掉產物的理由，沒有這條就不必換。

const PLAN = "/layouts/3b2l_standard";

test.describe("圖面由 floorplan 資料畫出來", () => {
  test("牆、房間、柱、門窗、傢俱、雨遮、尺寸標註都定址得到", async ({ page }) => {
    await page.goto(PLAN);

    // 資料檔裡的 id 就是 DOM 裡的 id：找找看（M4）要點名某個東西時不必另外建對照表。
    await expect(page.locator("#wall-001")).toBeAttached();
    await expect(page.locator("#room-master")).toBeAttached();
    await expect(page.locator("#col-nw")).toBeAttached();
    await expect(page.locator("#canopy-living")).toBeAttached();
    await expect(page.locator("#f-bathtub-m")).toBeAttached();
    // 尺寸標註標哪幾條、寫什麼字，由資料的 annotations 決定，不是由 bounds 重算——
    // 四捨五入與單位寫法是產生器的事。
    await expect(page.locator("#dim-overall-w")).toContainText("977 cm");
    await expect(page.locator("#dim-overall-h")).toContainText("782 cm");

    // 平開門畫的是一片門扇加一道弧（p23 表 8）。弧是門這個符號最好認的部分，
    // 少了它，圖上就只剩一個跟出入口分不出來的缺口。
    await expect(page.locator("#door-master path")).toHaveCount(1);
    // 雙開門兩片門扇、兩道弧。
    await expect(page.locator("#door-entry path")).toHaveCount(2);
    // 出入口**不畫門扇**，只有中央一個三角記號。
    await expect(page.locator("#door-hall-living path")).toHaveCount(0);
    await expect(page.locator("#door-hall-living polygon")).toHaveCount(1);
  });

  test("圖面與熱區同一個座標系：柱的熱區正好蓋在柱上", async ({ page }) => {
    await page.goto(PLAN);

    // hs-col-nw 的 coords 與 col-nw 的 geometry 在資料裡是同一塊 [0,0,40,40]。
    // 兩者疊起來若要換算，第一個看得出來的症狀就是「點得到卻點不準」。
    const column = await page.locator("#col-nw").boundingBox();
    const hotspot = await page.locator("#hs-col-nw").boundingBox();
    expect(column).not.toBeNull();
    expect(hotspot).not.toBeNull();

    // 比中心點：熱區在 browsing 階段有一條 1px 的可點擊性細邊（票 05），
    // 而 boundingBox 把描邊算進去，所以兩個框的外緣本來就差那條邊的寬度。
    const center = (box: { x: number; y: number; width: number; height: number }) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(Math.abs(center(hotspot!).x - center(column!).x)).toBeLessThan(0.5);
    expect(Math.abs(center(hotspot!).y - center(column!).y)).toBeLessThan(0.5);
    expect(Math.abs(hotspot!.width - column!.width)).toBeLessThanOrEqual(1);
  });

  // PRD §12「圖例與主圖的畫法必須一致」：本站的核心承諾是「符號頁認得的形狀，
  // 回到平面圖上找得到」。浴缸的符號說明白紙黑字寫著「裡面再套一個圓角長方形，
  // 一端的小圓是排水孔」——圖上畫不出這兩樣，那句話就是錯的。
  test("衛浴廚具照 p32 表 14 畫，與 sprite 同一套", async ({ page }) => {
    await page.goto(PLAN);

    // 浴缸：外框 + 內框 + 排水孔
    await expect(page.locator("#f-bathtub-m rect")).toHaveCount(2);
    await expect(page.locator("#f-bathtub-m circle")).toHaveCount(1);
    // 馬桶：便器 + 水箱
    await expect(page.locator("#f-toilet-m ellipse")).toHaveCount(1);
    await expect(page.locator("#f-toilet-m rect")).toHaveCount(1);
    // 洗臉盆：盆 + 牆線 + 落水口十字
    await expect(page.locator("#f-sink-m path")).toHaveCount(1);
    await expect(page.locator("#f-sink-m line")).toHaveCount(2);
    // 流理檯：檯面 + 洗槽 + 水龍頭
    await expect(page.locator("#f-counter rect")).toHaveCount(2);
    await expect(page.locator("#f-counter circle")).toHaveCount(1);
  });
});

// 這一段是票 07 存在的理由。產物是一坨靜態 markup，做不到這件事（docs/adr/0002 就是
// 為了這個理由被推翻的）；換成 React renderer 之後，狀態怎麼變、圖就怎麼跟著變。
test.describe("圖面依互動狀態改變畫法", () => {
  test("說明卡開著時，選到的那間房維持原樣、其餘的暗下去", async ({ page }) => {
    await page.goto(PLAN);

    const master = page.locator("#room-master");
    const bath = page.locator("#room-bath-m");
    const before = await master.evaluate((el) => getComputedStyle(el).fill);
    await expect(master).not.toHaveAttribute("data-state", "muted");

    // 主浴裡的浴缸：兩段式點兩次選到它。鍵盤那條路比較短，而這裡要測的是圖面，不是操作。
    await page.locator("#hs-f-bathtub-m").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#info-sheet")).toBeVisible();

    // 浴缸在主浴裡，所以主浴不暗；主臥跟其他房間退成背景。
    await expect(bath).not.toHaveAttribute("data-state", "muted");
    await expect(master).toHaveAttribute("data-state", "muted");
    const muted = await master.evaluate((el) => getComputedStyle(el).fill);
    expect(muted, "data-state 換了但畫法沒換，等於狀態驅動只做了一半").not.toBe(before);

    // 關掉說明卡就還原：暗下去是說明卡開著時的事，不是一去不回的狀態。
    await page.keyboard.press("Escape");
    await expect(master).not.toHaveAttribute("data-state", "muted");
    await expect
      .poll(() => master.evaluate((el) => getComputedStyle(el).fill))
      .toBe(before);
  });
});
