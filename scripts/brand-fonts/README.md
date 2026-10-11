# OG raster 字型

分享 PNG 使用 Noto Sans TC 的兩個字重子集，讓沒有繁中字型的 Linux／Vercel 建置也能呈現文字。字型只在建置程序使用，不放入 `public/`，不載入網站；頁面與來源 SVG 保留 `--sans` 系統字體堆疊。

來源：[Google Fonts API](https://developers.google.com/fonts/docs/getting_started#optimizing_your_font_requests)。API 的 `text=` 只取目前 `SITE_NAME`、`SITE_ROMANIZATION`、`BRAND_PROMISE`、`SITE_PURPOSE` 使用的字集；授權為相鄰的 [OFL.txt](OFL.txt)，原始授權來自 [Google Fonts Noto Sans TC](https://github.com/google/fonts/tree/main/ofl/notosanstc)。

一般 `npm run generate:brand` 不連網。當文案增加字元，產生器會停止並要求執行：

```sh
npm run generate:brand -- --refresh-fonts
```

將字型、`characters.txt` 與重新產生的品牌資產一起提交。`fonts.conf` 僅載入此目錄的字型，供 Linux Fontconfig 後端使用。Mac 的 renderer 仍可能採用系統字體，因此不同平台不要求逐像素一致；中文、羅馬字、尺寸與版面須保持可讀。
