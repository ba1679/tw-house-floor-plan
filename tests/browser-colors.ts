import type { Page } from "@playwright/test";

/** 由瀏覽器解析 CSS 顏色／變數，再取 sRGB 像素供跨 renderer 配對與對比檢查。 */
export async function browserColors(page: Page, values: string[]): Promise<string[]> {
  return page.evaluate((colors) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const result = colors.map((color) => {
      probe.style.color = color;
      ctx.fillStyle = getComputedStyle(probe).color;
      ctx.fillRect(0, 0, 1, 1);
      return "#" + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
        .map((channel) => channel.toString(16).padStart(2, "0")).join("");
    });
    probe.remove();
    return result;
  }, values);
}
