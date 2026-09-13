import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_NAME } from "@/lib/ui/copy";
import "./globals.css";

// 沒有宣告自己標題的頁面拿到的後備值。今天只剩 404 頁在用：首頁、平面圖頁、符號頁、分類頁
// 各自有自己的標題，與這一句同名的頁在搜尋結果上分不開。
export const metadata: Metadata = {
  title: SITE_NAME,
  description: "點圖上的符號，就知道那是什麼、以及該注意什麼。",
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
