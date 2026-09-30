# 03 — 首頁讀圖桌與既有功能入口

Status: ready
Blocked by: 01, 02

## Goal

把首頁改為原型 C 的讀圖桌：先看懂網站用途，再從真實格局開始，最後提供既有搜尋、分類與找找看的下一步；原型 A 的完整 logo 與原型 B 的格線只提供低密度節奏。

## Scope

- 重編 `app/page.tsx` 與 `app/page.module.css`，不改 Home metadata、JSON-LD、layout data source 或既有連結目標。
- 首屏安排：拼厝引言、明確的建案平面圖用途、目前可讀的真實格局／忠實縮圖、主 CTA「讀這張圖」。
- 讓完整 mark 位於獨立品牌面，格線只存在於這個面或留白節奏；格局與 CTA 的視覺權重必須更高。
- 將既有符號搜尋、分類與找找看入口編排為明確的次要行動；不可發明收藏數、推薦分數或新資料。

## Constraints

- 不使用原型 B 的整片深色 hero、旋轉平面圖、直排品牌欄；不複製 prototype-only switcher 或任何 prototype CSS。
- 不在縮圖上換房間色、不把 brand 色當 State、不改任何 href、Analytics link tracking 或可存取名稱。
- 文字選取、語意 heading、鍵盤順序和搜尋 landing 的清楚度不可退步。

## Acceptance criteria

- [ ] 375 × 812 首屏同時能理解「拼厝教人讀建案平面圖」並看見前往格局的主要入口。
- [ ] 真實格局／縮圖比完整品牌裝飾更突出，且點擊區域清楚、至少 44px。
- [ ] 搜尋、三個分類與找找看皆導向原有 route、保留原有 Analytics contract。
- [ ] desktop 有克制的編輯分欄與低密度格線；手機折成單欄後不留空洞、不水平溢出。

## Validation

更新 `tests/home-page.spec.ts`、必要的 search／analytics tests；Playwright 目視 375 × 812、320 × 568、desktop。

