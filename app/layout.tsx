import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "平面圖教學",
  description: "點圖上的符號，就知道那是什麼、以及該注意什麼。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
