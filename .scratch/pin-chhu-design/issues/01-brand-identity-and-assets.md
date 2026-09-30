# 01 — 拼厝 identity contract 與雙尺度品牌資產

Status: ready

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

- [ ] header、首頁、page title／description、OpenGraph `siteName`、WebSite JSON-LD 與 favicon 都表達「拼厝」；搜尋說明仍可理解為建案平面圖工具。
- [ ] 一處改 BrandMark 能同步影響 full／compact usage；不存在第二份手寫 logo SVG。
- [ ] full mark 在 desktop hero／OG 清楚辨認拼塊與台灣意象；compact mark 在 16／32px、header 尺寸仍清楚。
- [ ] 圖片替代文字有意義、中文與羅馬字可選取，沒有把文字轉為 SVG path。
- [ ] `npm run build` 與 metadata／header 相關 tests 通過。

## Validation

檢查 `tests/site-header.spec.ts`、`tests/home-metadata.spec.ts`、`tests/page-metadata.spec.ts`、`tests/robots.spec.ts`、`tests/sitemap.spec.ts`；以真瀏覽器目視 header、favicon 與 OG asset。 

