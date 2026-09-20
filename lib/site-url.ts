// 正式站網址由 build 時的 `SITE_URL` 給；上線時沒設，sitemap 與 robots 會列出 localhost。
export const SITE_URL = process.env.SITE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
