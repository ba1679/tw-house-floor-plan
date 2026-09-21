const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// 正式站網址：`SITE_URL` 優先，其次 Vercel 的 production 網址；都沒有時退回 localhost，上線前要確認不是這個。
export const SITE_URL =
  process.env.SITE_URL ??
  (vercelUrl ? `https://${vercelUrl}` : `http://localhost:${process.env.PORT ?? 3000}`);

export function absoluteSiteUrl(path: string): string {
  const href = new URL(path, SITE_URL).href;
  return path === "/" ? href.replace(/\/$/, "") : href;
}
