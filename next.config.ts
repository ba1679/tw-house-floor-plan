import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 平面圖與符號資料在 build 時讀入，執行期不打 API、不連資料庫（PRD §10）。
  // 全站以 SSG 產出，符號頁（M3）的 SEO 依賴這一點。
  output: "export",
  // repo 外面有一份 package-lock.json，不指定的話 Turbopack 會把工作區推到家目錄。
  turbopack: { root: __dirname },
  // next dev 預設會往 CLAUDE.md 塞一段自己的說明。CLAUDE.md 是這個 repo 手寫的工作流文件，
  // 不接受建置工具自動改寫。
  agentRules: false,
};

export default nextConfig;
