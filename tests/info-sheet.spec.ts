import { test, expect } from "@playwright/test";
import { selectByTwoTaps } from "./viewer-page";

// 說明卡是使用者確認符號之後拿到的東西：這是什麼、要注意什麼，
// **以及這個說法是從哪份文件來的**（PRD §6.5，本產品的核心差異化）。
//
// 這裡只測外部行為：卡片上出現什麼字、控制元件量得出多大、圖還看不看得見。
// 卡片內容全部來自 data/symbols.sample.json，所以斷言用的字串是拿資料裡的原句去對——
// 元件裡若哪天把文案抄成硬字串，資料改了測試就會抓到。

const PLAN = "/layouts/3b2l_standard";
const SHEET = "#info-sheet";

for (const size of [{ width: 375, height: 812 }, { width: 320, height: 568 }]) {
  test(`${size.width} × ${size.height}：展開說明仍保留圖面可視帶，卡片底部與控制不被裁切`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PLAN);
    const canopy = page.locator("#hs-canopy-master");
    await canopy.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(SHEET)).toBeFocused();
    await page.getByRole("button", { name: "展開完整內容" }).click();
    await expect(page.locator(SHEET)).toHaveAttribute("data-expanded", "true");

    const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
    // ADR-0003 的展開態仍需留出辨認位置的圖面帶，不能只剩非零的幾個 px。
    expect(frame.height).toBeGreaterThanOrEqual(84);
    const sheet = (await page.locator(SHEET).boundingBox())!;
    expect(frame.y + frame.height).toBeLessThanOrEqual(sheet.y);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(size.height + 1);
    for (const name of ["關閉說明", "收合看平面圖", /其他位置/]) {
      await expect(page.getByRole("button", { name })).toBeInViewport({ ratio: 1 });
    }
    await expect(page.locator(SHEET).getByText(/實際請以個案圖說或現場人員說明為準/)).toBeInViewport({ ratio: 1 });
  });
}

test("選到符號之後，說明卡帶著這個符號的白話意思升起來", async ({ page }) => {
  await page.goto(PLAN);
  await expect(page.locator(SHEET)).toBeHidden();

  await selectByTwoTaps(page, "hs-door-entry");

  const sheet = page.locator(SHEET);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "雙開門" })).toBeVisible();
  // 分類的中文名不在資料裡（資料只有 enum），來自集中的 UI 文案模組。
  await expect(sheet).toContainText("門窗");
  // 白話意思逐字取自 symbols.sample.json。
  await expect(sheet).toContainText("兩片等寬的門扇、各自往兩側開的門");
  // 來源徽章：只給結論，不給出處（法規名稱與連結留給 M3 符號頁）。
  await expect(sheet).toContainText("業界慣例");
  // 免責固定在最底（PRD §6.4 的完整一句）。
  await expect(sheet).toContainText("實際請以個案圖說或現場人員說明為準");
});

test("控制元件量得出 44px：關閉鍵與「其他位置」列", async ({ page }) => {
  await page.goto(PLAN);
  await selectByTwoTaps(page, "hs-win-living");

  // 37/37 熱區永遠達不到 44px（兩段式就是那個替代方案）；
  // M2 完成定義裡的 44px 指的是說明卡上這兩個控制元件（PRD §13，v0.6 修正）。
  const close = (await page.locator(SHEET).getByRole("button", { name: "關閉說明" }).boundingBox())!;
  expect(close.width).toBeGreaterThanOrEqual(44);
  expect(close.height).toBeGreaterThanOrEqual(44);

  const row = (await page.getByRole("button", { name: /其他位置/ }).boundingBox())!;
  expect(row.width).toBeGreaterThanOrEqual(44);
  expect(row.height).toBeGreaterThanOrEqual(44);
});

test("「共 N 處」由 floorplan 算出來，與資料一致", async ({ page }) => {
  await page.goto(PLAN);

  // 窗 9 處、單扇門 5 處、柱 5 處。數字不得寫死——加減 hotspot 時不必回頭改文案。
  await selectByTwoTaps(page, "hs-win-living");
  await expect(page.locator(SHEET)).toContainText("這張圖上共 9 處 · 目前第 1 處");

  await page.reload();
  await selectByTwoTaps(page, "hs-door-master");
  await expect(page.locator(SHEET)).toContainText("這張圖上共 5 處");

  await page.reload();
  await selectByTwoTaps(page, "hs-col-sw");
  await expect(page.locator(SHEET)).toContainText("這張圖上共 5 處");

  // 只有一處的符號沒有「其他位置」可看，整列不出現（決議 2）。
  await page.reload();
  await selectByTwoTaps(page, "hs-door-entry");
  await expect(page.getByRole("button", { name: /其他位置/ })).toBeHidden();
});

test("沒有注意事項的符號，卡片上不留空的區塊", async ({ page }) => {
  await page.goto(PLAN);

  // 14 個符號裡只有雨遮有 caution——另外 13 張卡若留一個空標題，看起來像壞掉。
  await selectByTwoTaps(page, "hs-win-living");
  await expect(page.locator(`${SHEET} [data-section="caution"]`)).toBeHidden();
  await expect(page.locator(SHEET)).not.toContainText("注意事項");

  await page.reload();
  await selectByTwoTaps(page, "hs-canopy-master");
  await expect(page.locator(`${SHEET} [data-section="caution"]`)).toBeVisible();
  await expect(page.locator(SHEET)).toContainText("這是買房最容易被灌水的坪數項目");
});

test("塞得下就不出現「展開完整內容」；塞不下才出現，點一下展開", async ({ page }) => {
  // 給短說明足夠的閱讀高度，驗證展開提示取決於內容是否真的溢出。
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(PLAN);
  const hint = page.getByRole("button", { name: /展開完整內容/ });

  // 雙開門：一則容易搞混、沒有注意事項，內容整個塞得進上限。
  // 高度隨內容走——這正是「392 是上限不是初始」要防的那片空白（決議 1）。
  await selectByTwoTaps(page, "hs-door-entry");
  // M6 makes the sheet enter as a structural transition. Measure its final
  // layout rather than the intentional zero-height starting frame.
  await page.waitForTimeout(200);
  const fitted = (await page.locator(SHEET).boundingBox())!;
  await expect(hint).toBeHidden();

  // 雨遮：唯一有 caution 的符號，內容超出上限。
  await page.reload();
  await selectByTwoTaps(page, "hs-canopy-master");
  await page.waitForTimeout(200);
  const initial = (await page.locator(SHEET).boundingBox())!;
  expect(initial.height, "塞不下的卡片應該頂到上限，比塞得下的那張高").toBeGreaterThan(
    fitted.height,
  );
  await expect(hint).toBeVisible();

  // 展開的觸發是點一下那句提示，不是拖曳（拖曳會跟票 04 的 pan/zoom 打架）。
  await hint.click();
  await expect
    .poll(async () => (await page.locator(SHEET).boundingBox())!.height)
    .toBeGreaterThan(initial.height);
  const expanded = (await page.locator(SHEET).boundingBox())!;
  await expect(page.getByRole("button", { name: "收合看平面圖" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  // 展開之後卡片仍然不佔滿螢幕：上緣留給平面圖，位置感才不會斷。
  const plan = (await page.getByRole("group", { name: /三房兩廳/ }).boundingBox())!;
  expect(plan.height).toBeGreaterThan(0);
  expect(plan.y + plan.height).toBeLessThanOrEqual(expanded.y + 1);

  const collapse = page.getByRole("button", { name: "收合看平面圖" });
  const control = page.locator('button[aria-controls="info-sheet-body"]');
  await collapse.focus();
  await collapse.click();
  await expect(control).toBeFocused();
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(async () => (await page.locator(SHEET).boundingBox())!.height)
    .toBeCloseTo(initial.height, 0);
  await expect(page.locator(SHEET)).toBeVisible();
});

test("減少動態時說明卡高度切換不播放過渡", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PLAN);
  await selectByTwoTaps(page, "hs-canopy-master");
  await expect(page.locator(SHEET)).toHaveCSS("transition-duration", "0s");
});

test("說明末段可捲到控制列上方，展開與收合按鈕不蓋住文字", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PLAN);
  await selectByTwoTaps(page, "hs-canopy-master");
  const body = page.locator("#info-sheet-body");
  const control = page.locator('button[aria-controls="info-sheet-body"]');
  for (const expanded of [false, true]) {
    if (expanded) await control.click();
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const last = (await body.locator("dd").last().boundingBox())!;
    const button = (await control.boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(button.y);
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  await control.click();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(control).toBeFocused();
});

test("按「其他位置」換看下一處：M 遞增、標示換到同一個符號的另一處、卡片不關", async ({
  page,
}) => {
  await page.goto(PLAN);
  await selectByTwoTaps(page, "hs-win-living");

  const sheet = page.locator(SHEET);
  await page.waitForTimeout(200);
  await expect(sheet).toContainText("目前第 1 處");
  const before = (await sheet.boundingBox())!;

  await page.getByRole("button", { name: /其他位置/ }).click();

  await expect(sheet).toContainText("目前第 2 處");
  await expect(page.locator("#hs-win-living")).not.toHaveAttribute("data-state", "selected");
  // 順序取 floorplan.hotspots 的檔案順序：程式產生、穩定。
  await expect(page.locator("#hs-win-dining")).toHaveAttribute("data-state", "selected");
  // 卡片不關、視野不動——按這一列是「換看一處」，不是「重新選一個符號」。
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("採光和通風用的開口");
  expect((await sheet.boundingBox())!.y).toBeCloseTo(before.y, 0);
});

test("卡片開啟時，圖面下半部的選中標示仍落在卡片上緣以上", async ({ page }) => {
  await page.goto(PLAN);

  // 主臥外側那片雨遮在圖的最下緣（y 794–884，整張圖 782 高）。
  // 卡片若是浮在圖上的一層，它就會被壓在卡片底下——所以卡片改成把圖收進上方那條可視帶（決議 3）。
  const canopy = await selectByTwoTaps(page, "hs-canopy-master");

  const sheet = (await page.locator(SHEET).boundingBox())!;
  const mark = (await canopy.boundingBox())!;
  expect(mark.height, "標示被壓成 0 就不算看得到").toBeGreaterThan(0);
  expect(mark.y + mark.height, "圖面最下緣的選中標示被卡片蓋住了").toBeLessThanOrEqual(sheet.y);
});

test("關閉鍵就是「重選」：卡片收起、選取清掉、圖回到全圖", async ({ page }) => {
  // 新圖較扁；用較矮螢幕讓說明卡確實改變 fit，而不只吃掉留白。
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(PLAN);

  // 量的是圖本身，不是選中的熱區：熱區選中時會多一圈 3.5px 的框，
  // 拿它跨狀態比大小會把框的粗細算成圖的縮放。
  const plan = page.getByRole("group", { name: /三房兩廳/ });
  const door = page.locator("#hs-door-entry");
  const fullView = (await plan.boundingBox())!;

  await selectByTwoTaps(page, "hs-door-entry");

  // 卡片升起來，圖被擠進上方那條可視帶——但仍然看得見，選中標示也還在。
  await expect.poll(async () => (await plan.boundingBox())!.height).toBeLessThan(fullView.height);
  const withSheet = (await plan.boundingBox())!;
  expect(withSheet.height).toBeLessThan(fullView.height);
  expect(withSheet.height).toBeGreaterThan(0);
  await expect(door).toHaveAttribute("data-state", "selected");

  await page.locator(SHEET).getByRole("button", { name: "關閉說明" }).click();

  await expect(page.locator(SHEET)).toBeHidden();
  await expect(door).toHaveAttribute("data-state", "normal");
  const restored = (await plan.boundingBox())!;
  expect(restored.height).toBeCloseTo(fullView.height, 0);
  expect(restored.y).toBeCloseTo(fullView.y, 0);
});
