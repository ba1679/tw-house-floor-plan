import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PLAN, cleanHotspotsOf, nextOf, startRoundAt, statusOf } from "./quiz-play";

// 拼厝票 07：沿用既有 header／SEO／analytics tests，只補跨房型、資產 variants 與 quiz 可及性缺口。
const palette: Record<string, string> = {
  master_bedroom: "#d4a373",
  living_room: "#dd8b67",
  dining_room: "#faedcd",
  kitchen: "#faedcd",
  bathroom: "#a3b18a",
  balcony: "#a3b18a",
};
type RoomPaint = { id: string; type: string; fill: string; muted: boolean };

async function roomPaint(page: Page): Promise<RoomPaint[]> {
  return page.locator("#rooms > rect").evaluateAll((rooms) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return rooms.map((room) => {
      ctx.fillStyle = getComputedStyle(room).fill;
      ctx.fillRect(0, 0, 1, 1);
      const fill = "#" + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
        .map((channel) => channel.toString(16).padStart(2, "0")).join("");
      return { id: room.id, type: room.getAttribute("data-room-type")!, fill, muted: room.getAttribute("data-state") === "muted" };
    });
  });
}

test("首頁縮圖、自由看圖、找找看的房型色一致，離線 SVG 也遵守核准配對", async ({ page }) => {
  let baseline: RoomPaint[] | undefined;
  for (const path of ["/", PLAN, `${PLAN}/quiz`]) {
    await page.goto(path);
    if (path.endsWith("/quiz")) await page.getByRole("button", { name: "開始", exact: true }).click();
    const rooms = await roomPaint(page);
    expect(rooms.length).toBe(12);
    for (const room of rooms) expect(room.fill, `${path} / ${room.type}`).toBe(palette[room.type] ?? "#f4f4f4");
    if (baseline) expect(rooms).toEqual(baseline);
    else baseline = rooms;
  }

  // 走 CLI 的公開輸出，不 import Python 的 room_fill 再重算它自己。
  const svg = execFileSync("python3", [
    ".claude/skills/floorplan-generator/scripts/render_svg.py", "data/layouts/3b2l_standard.floorplan.json",
  ], { encoding: "utf8" });
  const offline = await page.evaluate((svgText) => {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    return [...doc.querySelectorAll("#rooms > rect")].map((room) => ({
      id: room.id, type: room.getAttribute("data-room-type"), fill: room.getAttribute("fill"), muted: false,
    }));
  }, svg);
  expect(offline).toEqual(baseline);
});

test("每組房型色在說明卡開啟時按房間歸屬暗化，關閉後完整還原", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PLAN);
  const baseline = await roomPaint(page);
  // 主浴裡的浴缸使主臥、客廳、餐廚、其他衛浴／陽台與中性房間都成為背景。
  await page.locator("#hs-f-bathtub-m").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#info-sheet")).toBeFocused();
  const withSheet = await roomPaint(page);
  for (const room of withSheet) {
    const original = baseline.find((before) => before.id === room.id)!;
    if (room.id === "room-bath-m") {
      expect(room.muted).toBe(false);
      expect(room.fill).toBe(original.fill);
    } else {
      expect(room.muted, room.id).toBe(true);
      expect(room.fill, room.id).not.toBe(original.fill);
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#info-sheet")).toBeHidden();
  expect(await roomPaint(page)).toEqual(baseline);
});

test("full／compact 標記支援深淺表面，小尺寸仍用清楚的 compact 外框", async ({ page }) => {
  const css = readFileSync("app/brand-tokens.css", "utf8");
  const variants = [
    { variant: "full" as const, width: 120, height: 220 },
    { variant: "compact" as const, width: 16, height: 16 },
    { variant: "full" as const, width: 16, height: 16 },
  ];
  for (const surface of ["light", "dark"] as const) {
    // Playwright 的 JSX transform 產生測試元件描述；實際 React SSR 透過與資產 generator 相同的 tsx runtime。
    const html = execFileSync(process.execPath, ["--import", "tsx", "--eval", `
      const { createElement } = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { BrandMark } = require('./components/BrandMark.tsx');
      console.log(${JSON.stringify(variants)}.map((props, index) =>
        '<div data-variant="' + index + '">' + renderToStaticMarkup(createElement(BrandMark,
          { ...props, surface: ${JSON.stringify(surface)} })) + '</div>').join(''));
    `], { encoding: "utf8" });
    await page.setContent(`<style>${css} body { background: var(--brand-${surface === "dark" ? "ink" : "cream"}); }</style>${html}`);
    for (const [index, props] of variants.entries()) {
      const mark = page.locator(`[data-variant="${index}"]`).getByRole("img", { name: "拼厝", exact: true });
      await expect(mark).toBeVisible();
      await expect(mark).toHaveAttribute("viewBox", props.width === 16 ? "0 0 32 32" : "410 40 213 357");
      const paint = await mark.locator("path[stroke], g[stroke]").first().evaluate((el) => getComputedStyle(el).stroke);
      expect(paint).toBe(surface === "dark" ? "rgb(250, 237, 205)" : "rgb(61, 64, 91)");
      if (props.width === 16) {
        // 16px 顯示、32 單位 viewBox 的 compact 使用 2 單位外框，即一個螢幕像素。
        await expect(mark.locator("g")).toHaveCSS("stroke-width", "2px");
      }
    }
  }
});

test("最長現有符號名在小螢幕完整回饋，減少動態下可鍵盤讀說明並前進", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startRoundAt(page, "entrance_opening", { notLast: true });
  await page.locator(`#${cleanHotspotsOf("door_sliding")[0]}`).focus();
  await page.keyboard.press("Enter");
  const sheet = page.locator("#info-sheet");
  const result = page.getByRole("region", { name: "作答結果" });
  await expect(result).toContainText("正確答案是「出入口（無門扇）」");
  await expect(result).toBeInViewport({ ratio: 1 });
  await expect(nextOf(page)).toBeInViewport({ ratio: 1 });
  await expect(statusOf(page)).toHaveText("答錯了。你點的是「推拉門」。正確答案是「出入口（無門扇）」。");
  expect(await statusOf(page).ariaSnapshot()).toContain("正確答案是「出入口（無門扇）」");
  await expect(sheet).toBeFocused();
  await expect(sheet).toHaveCSS("transition-duration", "0s");
  await expect(page.locator("#room-master")).toHaveCSS("transition-duration", "0s");
  expect((await page.locator("#floorplan-viewport").boundingBox())!.height).toBeGreaterThanOrEqual(84);
  expect((await sheet.locator("#info-sheet-body").boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await page.keyboard.press("Escape");
  await expect(nextOf(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#quiz-question")).toBeFocused();
  await expect(result).toBeHidden();
  await expect(sheet).toBeHidden();
});
