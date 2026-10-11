# 社群分享圖使用可解析的 PNG

Status: implemented — pending production verification

## 問題與重現

2026-10-11 使用者回報 Threads 分享連結沒有 OG 圖片。依既有 release ticket 的 production host 檢查 `https://tw-house-floor-plan.vercel.app/`：一般 UA 與 `facebookexternalhit/1.1` 均取得 HTTP 200，HTML 宣告 `/brand/og-home.svg`，圖片 HTTP 200 但 MIME 為 `image/svg+xml`。robots 允許全部爬蟲。圖片格式是目前最明確的相容性問題；尚未取得 Threads 實際抓取紀錄，不能排除平台快取或來源 IP 限制。

## 實作與驗收

- 沿用 BrandMark、CSS tokens、集中文案與現有 SVG 版面，產生 1200 × 630 PNG。
- 全站共用 metadata 宣告 PNG 的絕對 URL 與 `image/png`。
- 保留 SVG 作為可讀取文字的品牌來源資產。
- 測試 build HTML 的 metadata，並以 crawler UA 下載其指定的本機圖片，驗證 HTTP、MIME、真實 PNG 編碼及尺寸。
- 檢查 raster 中文文字在建置環境可呈現，不依賴讀者或爬蟲的字型。
- 部署後需重新檢查 production；本機測試無法證明 Threads 已更新預覽或快取。

## Comments

- 排查來源：`lib/site-metadata.ts` → `scripts/generate-brand-assets.tsx` → `public/brand/og-home.svg`。原測試只驗證 SVG 存在與文字可讀，未驗證社群可用的 raster 圖片。
- 回歸先紅：`PORT=3114 npm test -- tests/home-metadata.spec.ts -g "分享爬蟲" --workers=1`，Expected `og-home.png`、Received `og-home.svg`，1 failed。
- 修正後：`PORT=3114 npm test -- tests/home-metadata.spec.ts tests/page-metadata.spec.ts --workers=4`，10 passed；webServer 重新跑完整 build 與 build-time validation。`npm run typecheck`、`git diff --check` 通過。
- 目視 PNG 確认中文、羅馬字、品牌標記與既有版面正確，尺寸 1200 × 630，約 42 KB。字型子集與授權隨 repo 保留；正常 build 不連網。
- code-review 以 `ded10b516381a2dd5b3670be61e3cd00d6e33674` 為本次未提交改動的 baseline，Standards／Spec 兩軸獨立唯讀複核，沒有程式 blocker。Spec 註明 production 驗收尚未完成。
- 本次沒有 commit、push 或部署；正式站仍是 SVG。部署後需用實際分享網址重新檢查 HTTP、圖片與 Threads 預覽。Threads 快取及來源 IP 限制尚未取得平台端證據。
