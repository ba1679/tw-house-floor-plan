# 01 — 拼厝 identity contract 與雙尺度品牌資產

Status: resolved

## Goal

讓所有第一方識別一致稱為「拼厝（Phin-Chhù）」；以一個品牌標記 Module 供應完整島嶼拼圖與 compact mark，而非在各個 surface 複製 SVG。

## Scope

- 在 `lib/ui/copy.ts` 集中站名、羅馬字、品牌承諾與仍含「建案平面圖／格局」的搜尋說明；更新使用該 copy 的 metadata、JSON-LD 與標題。
- 建立品牌標記 Module，最小 Interface 為完整／compact variant 與淺／深表面。Module 擁有 SVG 幾何、色塊、外框與 aria label。
- 以 compact mark 產生或更新 `public/brand/favicon.svg`、`public/brand/apple-touch-icon.png`；以 full mark 更新 `public/brand/og-home.svg`。保留 `lib/site-metadata.ts` 的集中路徑。
- 更新 `SiteHeader` 的品牌文字與任何舊站名／舊標記 reference；中文與羅馬字必須保持真文字。

## Constraints

- 完整 mark 不得縮小冒充 favicon／header icon；compact mark 不是任意裁切的完整台灣輪廓。
- 所有品牌色只來自命名 brand token；不得動 `--fp-*`／`--state-*` token 或把品牌色帶進圖面。
- metadata、canonical、JSON-LD、sitemap、quiz noindex 與 Analytics event name／payload contract 不變。
- 不加入房子屋頂、聊天泡泡或任何 AI iconography。

## Acceptance criteria

- [x] header、首頁、page title／description、OpenGraph `siteName`、WebSite JSON-LD 與 favicon 都表達「拼厝」；搜尋說明仍可理解為建案平面圖工具。
- [x] 一處改 BrandMark 能同步影響 full／compact usage；不存在第二份手寫 logo SVG。
- [x] full mark 在 desktop hero／OG 清楚辨認拼塊與台灣意象；compact mark 在 16／32px、header 尺寸仍清楚。
- [x] 圖片替代文字有意義、中文與羅馬字可選取，沒有把文字轉為 SVG path。
- [x] `npm run build` 與 metadata／header 相關 tests 通過。

## Validation

檢查 `tests/site-header.spec.ts`、`tests/home-metadata.spec.ts`、`tests/page-metadata.spec.ts`、`tests/robots.spec.ts`、`tests/sitemap.spec.ts`；以真瀏覽器目視 header、favicon 與 OG asset。 


## Comments

### 2026-09-30 — 實作與驗證

- `lib/ui/copy.ts` 集中拼厝、Phin-Chhù、品牌承諾、用途與品牌圖片替代文字；metadata 與 JSON-LD 共用這份識別。
- `components/BrandMark.tsx` 是唯一手寫標記來源：full 依使用者提供的 `design/reference/pin-chhu-logo.png` 重畫輪廓與內部分隔；compact 提煉矩形拼塊與開口，提供淺／深表面及小尺寸 fallback。
- `app/brand-tokens.css` 保存唯一手寫品牌色值；後續票 02 可使用這組 token 建立全站外殼。`--fp-*`、`--state-*` 與圖面資料未改動。
- `npm run generate:brand` 由同一個元件產生 favicon、180 × 180 Apple icon 與 1200 × 630 OG SVG；`prebuild` 自動執行。產物請勿手改。路徑仍由 `lib/site-metadata.ts` 提供。
- 補齊靜態預覽伺服器的 SVG／PNG MIME type，避免品牌資產被當成下載檔。
- TDD：metadata、header 羅馬字／標記、獨立品牌資產依序確認失敗後實作。`npm run typecheck` 通過；完整 `PORT=3107 npm test -- --workers=4` 共 272 tests 通過，含 production build、資料／FloorPlan validation、metadata、header、robots、sitemap、Analytics 與既有互動回歸。
- Chromium 目視確認：full 與 compact 的淺／深底、compact 16／32／44／180px、375 × 812 首頁、1200 × 630 OG。320 × 568 layout／quiz 無 document scroll 的既有驗收通過。完整 mark 的首頁品牌欄編排依交付順序留在票 03。
- 重新產生品牌資產後 `git diff --exit-code -- public/brand` 通過，確認產生流程可重現。
- 使用者追加指定完整台灣標記：已保留參考圖並先更新 `DESIGN.md`／spec，再重畫 SVG；忽略下方 TW FloorPlan 文案與棋盤背景，沿用既定品牌色票。更新後 build、typecheck 及 18 個品牌／SEO 測試通過。
- 最終版本再次通過完整 272 tests（含 build 與 validation）；Standards review：0 項，Spec review：0 項。使用者指定幾何的追加變更也經兩軸複查，均無發現。
