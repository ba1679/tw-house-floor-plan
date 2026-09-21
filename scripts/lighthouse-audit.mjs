#!/usr/bin/env node
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

let PORT = Number(process.env.AUDIT_PORT ?? 0);
let BASE_URL = "";
const SITE_URL = process.env.SITE_URL ?? "https://floorplan.example.test";
const RUNS = 3;
const MIN_SCORE = 0.9;

const pages = [
  { label: "home", path: "/", categories: ["performance", "accessibility", "best-practices", "seo"] },
  { label: "floorplan", path: "/layouts/3b2l_standard", categories: ["performance", "accessibility", "best-practices", "seo"] },
  { label: "symbol", path: "/symbols/window", categories: ["performance", "accessibility", "best-practices", "seo"] },
  { label: "category", path: "/categories/door_window", categories: ["performance", "accessibility", "best-practices", "seo"] },
  // 找找看刻意 noindex；SEO 策略由 Playwright 的 noindex / sitemap 測試守，不用 Lighthouse SEO 分數 gate。
  { label: "quiz", path: "/layouts/3b2l_standard/quiz", categories: ["performance", "accessibility", "best-practices"] },
];

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function waitForServer(url, timeoutMs = 20_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.on("error", retry);
      request.setTimeout(1_000, () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
      else setTimeout(ping, 250);
    };
    ping();
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate audit port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function auditPage(page) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    let chrome;
    try {
      chrome = await chromeLauncher.launch({
        chromePath: process.env.CHROME_PATH,
        chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
      });
      const result = await lighthouse(`${BASE_URL}${page.path}`, {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        formFactor: "mobile",
        // DevTools throttling keeps Lighthouse's mobile constraints while avoiding the high
        // render-delay variance of simulated throttling on local static HTML text pages.
        throttlingMethod: "devtools",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 2,
          disabled: false,
        },
      });
      runs.push(result.lhr.categories);
    } finally {
      if (chrome) await chrome.kill();
    }
    await sleep(250);
  }

  const scores = Object.fromEntries(
    page.categories.map((category) => [
      category,
      median(runs.map((run) => run[category].score)),
    ]),
  );
  return scores;
}

function printScore(page, category, score) {
  const pct = Math.round(score * 100);
  const threshold = Math.round(MIN_SCORE * 100);
  const ok = score >= MIN_SCORE ? "✓" : "✗";
  console.log(`${ok} ${page.label.padEnd(9)} ${category.padEnd(14)} ${pct}% (threshold ${threshold}%)`);
}

let server;
try {
  if (PORT === 0) PORT = await getFreePort();
  BASE_URL = `http://127.0.0.1:${PORT}`;

  await run("npm", ["run", "build"], {
    SITE_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
  });

  server = spawn(process.execPath, ["scripts/serve-static.mjs", "out"], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) },
  });
  const serverExited = once(server, "exit").then(([code]) => {
    throw new Error(`static server exited before audit completed (code ${code})`);
  });
  await Promise.race([waitForServer(`${BASE_URL}/`), serverExited]);
  await sleep(1_000);

  const failures = [];
  console.log(`\nLighthouse audit (${RUNS} runs per page, median score)`);
  console.log("=".repeat(60));
  for (const page of pages) {
    const scores = await auditPage(page);
    for (const [category, score] of Object.entries(scores)) {
      printScore(page, category, score);
      if (score < MIN_SCORE) failures.push(`${page.label} ${category}: ${Math.round(score * 100)}%`);
    }
  }
  console.log("=".repeat(60));

  if (failures.length > 0) {
    console.error(`Lighthouse audit failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
    process.exitCode = 1;
  }
} finally {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 1_000))]);
  }
}
