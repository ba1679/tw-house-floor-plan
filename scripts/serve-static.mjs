#!/usr/bin/env node
// 靜態託管 `next build`（output: "export"）產出的 out/。
// 用意不是做一台伺服器，而是讓「這個站跑起來不需要伺服器」這件事在測試裡被真的驗證：
// 這裡只會回傳磁碟上已經存在的檔案，任何需要執行期運算的頁面在這裡都會是 404。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const root = join(process.cwd(), process.argv[2] ?? "out");
const port = Number(process.env.PORT ?? 3000);

// out/ 目前只有這五種副檔名。多的等站上真的有那種檔案再加，不先列。
// 表外的一律當二進位檔送，瀏覽器會把它下載下來而不是顯示——`.xml` 是 sitemap 那一份（票 10）。
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function resolveFile(pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [join(root, rel), join(root, rel, "index.html"), join(root, `${rel}.html`)]) {
    if (!candidate.startsWith(root)) continue;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // 找下一個候選
    }
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = await resolveFile(pathname === "/" ? "/index.html" : pathname);
  if (!file) {
    const notFound = await resolveFile("/404.html");
    res.writeHead(404, { "content-type": MIME[".html"] });
    res.end(notFound ? await readFile(notFound) : "404");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
