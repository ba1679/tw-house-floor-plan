import { defineConfig, devices } from "@playwright/test";

// 測試必須跑在有真實版面尺寸的瀏覽器裡：jsdom 的 getBoundingClientRect 回傳全零，
// 量不出「44px」或「圖有沒有溢出 375px」這種本專案真正會壞掉的東西（spec §Testing Decisions）。
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      // 手機優先：使用情境是在接待中心站著用手機看（PRD §9）。
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // 測的是 build 產物本身：prebuild 的資料驗證、SSG 的靜態輸出，都要在這條路徑上被走過。
    command: "npm run build && npm run start",
    url: "http://localhost:3000/layouts/3b2l_standard",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
