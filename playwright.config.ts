import { defineConfig, devices } from "@playwright/test";

// 測試必須跑在有真實版面尺寸的瀏覽器裡：jsdom 的 getBoundingClientRect 回傳全零，
// 量不出「44px」或「圖有沒有溢出 375px」這種本專案真正會壞掉的東西（spec §Testing Decisions）。
// 埠號可由 PORT 覆寫：同一個 repo 開兩份 worktree 平行實作時，兩邊各跑一次
// `npm run build && npm run start`，寫死 3000 的話後跑的那一份會靜靜地重用前一份的
// 伺服器（`reuseExistingServer`），測到的是別人的建置產物。`scripts/serve-static.mjs`
// 本來就讀 PORT，這裡只是讓測試端跟著它走。
const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${port}`;
const testSiteURL = process.env.SITE_URL ?? "https://floorplan.example.test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
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
    command: `SITE_URL=${testSiteURL} NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST12345 npm run build && npm run start`,
    url: `${baseURL}/layouts/3b2l_standard`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
