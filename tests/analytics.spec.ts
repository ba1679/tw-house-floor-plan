import { expect, test, type Page } from "@playwright/test";
import { analyticsSearchTerm, type AnalyticsEvent } from "@/lib/analytics";
import { loadSearchIndex } from "@/lib/symbols/data";
import {
  answerByTwoTaps,
  cleanHotspotsOf,
  currentTarget,
  otherThan,
  playToResults,
  startRound,
} from "./quiz-play";
import { blankSpot, dragLeft, selectByTwoTaps } from "./viewer-page";

const PLAN = "/layouts/3b2l_standard";

async function events(page: Page): Promise<AnalyticsEvent[]> {
  return page.evaluate(() =>
    ((window as unknown as { __fpAnalyticsEvents?: AnalyticsEvent[] }).__fpAnalyticsEvents ?? []).slice(),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __fpAnalyticsEvents?: unknown[] }).__fpAnalyticsEvents = [];
  });
});

test("搜尋只送白名單字，未知自由輸入一律是 other", () => {
  const index = loadSearchIndex();
  expect(analyticsSearchTerm(index, "樑")).toBe("樑");
  expect(analyticsSearchTerm(index, "梁")).toBe("梁");
  expect(analyticsSearchTerm(index, "樑柱選擇")).toBe("other");
  expect(analyticsSearchTerm(index, "buyer@example.test")).toBe("other");
  expect(analyticsSearchTerm(index, "0912-345-678")).toBe("other");
});

test("符號頁、搜尋與入口都寫入記憶體 sink，不連 Google", async ({ page }) => {
  const requests: string[] = [];
  await page.goto("/symbols/window");
  await expect.poll(async () => events(page)).toContainEqual({
    name: "symbol_view",
    symbol_id: "window",
    surface: "symbol_page",
  });

  await page.goto("/");
  page.on("request", (request) => requests.push(request.url()));
  const search = page.getByRole("search").getByRole("searchbox");
  await search.fill("樑");
  await page.waitForTimeout(800);
  await expect.poll(async () => events(page)).toContainEqual({
    name: "search",
    search_term: "樑",
    result_count: 3,
    search_surface: "home",
  });

  await search.fill("buyer@example.test");
  await page.waitForTimeout(800);
  const searches = (await events(page)).filter((event) => event.name === "search");
  expect(searches).toContainEqual({
    name: "search",
    search_term: "other",
    result_count: 0,
    search_surface: "home",
  });
  expect(JSON.stringify(searches)).not.toContain("buyer@example.test");
  expect(requests.filter((url) => url.includes("google"))).toEqual([]);
});

test("兩段式確認與說明卡操作只各送一個語意事件", async ({ page }) => {
  await page.goto(PLAN);
  await selectByTwoTaps(page, "hs-door-entry");
  await expect.poll(async () => events(page)).toContainEqual({
    name: "layout_interaction",
    layout_id: "3b2l_standard",
    action: "symbol_confirmed",
    symbol_id: "door_double_swing",
    hotspot_id: "hs-door-entry",
    input_method: "pointer",
  });
  await expect.poll(async () => events(page)).toContainEqual({
    name: "symbol_view",
    symbol_id: "door_double_swing",
    surface: "layout_sheet",
    layout_id: "3b2l_standard",
    hotspot_id: "hs-door-entry",
  });
  expect(
    (await events(page)).filter(
      (event) => event.name === "layout_interaction" && event.action === "symbol_confirmed",
    ),
  ).toHaveLength(1);
  expect(
    (await events(page)).filter((event) => event.name === "symbol_view" && event.surface === "layout_sheet"),
  ).toHaveLength(1);

  await page.locator("#info-sheet").getByRole("button", { name: "關閉說明" }).click();
  await expect.poll(async () => events(page)).toContainEqual({
    name: "info_sheet_action",
    layout_id: "3b2l_standard",
    symbol_id: "door_double_swing",
    context: "layout",
    action: "close",
  });
});

test("自由看圖量真正的狀態轉移，其他位置與 Esc 不重複讀取或漏掉關閉", async ({ page }) => {
  await page.goto(PLAN);

  const window = page.locator("#hs-win-living");
  const initial = (await window.boundingBox())!;
  await page.mouse.click(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await expect(window).toHaveAttribute("data-state", "candidate");

  const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
  const blank = blankSpot(frame);
  await page.mouse.click(blank.x, blank.y);
  await expect.poll(async () => events(page)).toContainEqual({
    name: "layout_interaction",
    layout_id: "3b2l_standard",
    action: "confirm_missed",
  });

  await page.getByRole("button", { name: "重選" }).click();
  await expect.poll(async () => events(page)).toContainEqual({
    name: "layout_interaction",
    layout_id: "3b2l_standard",
    action: "reselect",
  });

  await selectByTwoTaps(page, "hs-win-living");
  await page.getByRole("button", { name: /其他位置/ }).click();
  const afterNext = await events(page);
  expect(
    afterNext.filter(
      (event) => event.name === "layout_interaction" && event.action === "symbol_confirmed",
    ),
  ).toHaveLength(1);
  expect(afterNext.filter((event) => event.name === "symbol_view" && event.surface === "layout_sheet")).toHaveLength(
    1,
  );

  await page.keyboard.press("Escape");
  await expect.poll(async () => events(page)).toContainEqual({
    name: "info_sheet_action",
    layout_id: "3b2l_standard",
    symbol_id: "window",
    context: "layout",
    action: "close",
  });
});

test("自由看圖的手勢每次掛載最多量一次", async ({ page }) => {
  await page.goto(PLAN);
  const plan = page.getByRole("group", { name: /三房兩廳/ });
  const fit = (await plan.boundingBox())!;
  const anchor = blankSpot(fit);
  await page.mouse.dblclick(anchor.x, anchor.y);

  const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
  await dragLeft(page, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, 80);

  const interactions = (await events(page)).filter((event) => event.name === "layout_interaction");
  expect(interactions.filter((event) => event.action === "manual_zoom")).toHaveLength(1);
  expect(interactions.filter((event) => event.action === "manual_pan")).toHaveLength(1);
});

test("找找看開始與一個真正作答各送一次", async ({ page }) => {
  await startRound(page);
  const target = await currentTarget(page);
  await answerByTwoTaps(page, cleanHotspotsOf(target)[0]);

  const recorded = await events(page);
  expect(recorded).toContainEqual({
    name: "quiz_start",
    layout_id: "3b2l_standard",
    question_count: 7,
    start_type: "first",
  });
  const answers = recorded.filter((event) => event.name === "quiz_answer");
  expect(answers).toHaveLength(1);
  expect(answers[0]).toMatchObject({
    layout_id: "3b2l_standard",
    symbol_id: target,
    picked_symbol_id: target,
    correct: true,
    question_index: 1,
    input_method: "pointer",
  });
});

test("找找看完成與再玩一次各送一次", async ({ page }) => {
  await startRound(page);
  await playToResults(page);

  await expect.poll(async () => events(page)).toContainEqual({
    name: "quiz_complete",
    layout_id: "3b2l_standard",
    question_count: 7,
    correct_count: 7,
  });
  expect((await events(page)).filter((event) => event.name === "quiz_answer")).toHaveLength(7);

  await page.getByRole("button", { name: "再玩一次" }).click();
  await expect.poll(async () => events(page)).toContainEqual({
    name: "quiz_start",
    layout_id: "3b2l_standard",
    question_count: 7,
    start_type: "replay",
  });
});

test("答錯的 reveal 不算閱讀；重開說明與 Esc 都有 quiz 語意", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startRound(page);
  const target = await currentTarget(page);
  const picked = otherThan(target);
  await answerByTwoTaps(page, cleanHotspotsOf(picked)[0]);

  // 答錯時卡片會自動開來，但「答案揭露」不是使用者主動閱讀。
  await expect(page.locator("#info-sheet")).toBeVisible();
  expect((await events(page)).filter((event) => event.name === "symbol_view")).toHaveLength(0);

  await page.getByRole("button", { name: "關閉說明" }).click();
  await expect(page.locator("#info-sheet")).toBeHidden();
  await page.getByRole("button", { name: "看說明" }).click();
  await expect.poll(async () => events(page)).toContainEqual({
    name: "symbol_view",
    symbol_id: target,
    surface: "quiz_sheet",
    layout_id: "3b2l_standard",
  });
  await page.keyboard.press("Escape");
  await expect.poll(async () => events(page)).toContainEqual({
    name: "info_sheet_action",
    layout_id: "3b2l_standard",
    symbol_id: target,
    context: "quiz",
    action: "close",
  });

  const answer = (await events(page)).find((event) => event.name === "quiz_answer");
  expect(answer).toMatchObject({
    symbol_id: target,
    picked_symbol_id: picked,
    correct: false,
    question_index: 1,
  });
});
