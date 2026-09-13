import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/ui/copy";
import "./globals.css";

// 沒有宣告自己標題與描述的頁面拿到的後備值。今天只剩 404 頁在用：首頁、平面圖頁、符號頁、分類頁
// 各自有自己的一份，與這一份相同的頁在搜尋結果上分不開。
export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
