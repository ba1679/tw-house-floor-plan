import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MARK_PX } from "../lib/viewer/marks";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const cssModuleFiles = (directory: string): string[] =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) return cssModuleFiles(relative);
    return entry.name.endsWith(".module.css") ? [relative] : [];
  });
const globals = read("app/globals.css");
const renderer = read("components/FloorPlanRenderer.module.css");
const viewer = read("components/FloorPlanViewer.module.css");
const sprite = read("data/symbols.sprite.svg");

function token(css: string, name: string) {
  const match = css.match(new RegExp(`${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`));
  expect(match, `找不到 ${name}`).not.toBeNull();
  return match![1].trim();
}

type Rgb = [number, number, number];

function oklchToRgb(value: string): Rgb {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`不支援的顏色：${value}`);
  const [, l, chroma, hue] = match.map(Number);
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const linear: Rgb = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
  return linear.map((channel) => {
    const clamped = Math.max(0, Math.min(1, channel));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  }) as Rgb;
}

function hexToRgb(value: string): Rgb {
  const hex = value.slice(1);
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255) as Rgb;
}

function rgb(value: string): Rgb {
  if (value.startsWith("#")) return hexToRgb(value);
  return oklchToRgb(value);
}

function luminance(value: string) {
  return rgb(value).reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrast(foreground: string, background: string) {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test.describe("介面設計語言", () => {
  test("介面 token 與定案值一致，且移除舊的彩色／字體 token", () => {
    expect(token(globals, "--paper")).toBe("oklch(1 0 0)");
    expect(token(globals, "--paper2")).toBe("oklch(0.962 0.002 265)");
    expect(token(globals, "--ink")).toBe("oklch(0.21 0.006 265)");
    expect(token(globals, "--ink2")).toBe("oklch(0.47 0.008 265)");
    expect(token(globals, "--ink3")).toBe("oklch(0.62 0.006 265)");
    expect(token(globals, "--rule")).toBe("oklch(0.89 0.003 265)");
    expect(token(globals, "--rule2")).toBe("oklch(0.935 0.002 265)");
    expect(token(globals, "--control-h")).toBe("48px");
    expect(token(globals, "--touch-min")).toBe("44px");
    expect(token(globals, "--focus-ring-light-width")).toBe("6px");
    expect(token(globals, "--focus-ring-dark-width")).toBe("2px");
    expect(globals).toContain("color-scheme: light");
    expect(globals).toContain("0 0 0 2px var(--focus-light)");
    expect(globals).toContain("0 0 0 4px var(--focus-dark)");
    expect(globals).not.toMatch(/^\s*--(?:accent|serif|mono)\s*:/m);

    const css = [globals, ...[...cssModuleFiles("app"), ...cssModuleFiles("components")].map((path) => read(path))].join("\\n");
    expect(css).not.toMatch(/var\(--(?:accent|serif|mono)\b/);
    expect(css).not.toMatch(/color:\s*var\(--ink3\b/);
  });

  test("介面文字至少 12px，墨色文字與紙色表面達到 AA", () => {
    const files = [...cssModuleFiles("app"), ...cssModuleFiles("components")].filter(
      (path) => !path.endsWith("FloorPlanRenderer.module.css") && !path.endsWith("FloorPlanViewer.module.css"),
    );
    for (const path of files) {
      const css = read(path);
      for (const match of css.matchAll(/font-size:\s*([\d.]+)px/g)) {
        expect(Number(match[1]), `${path} 有小於 12px 的介面字`).toBeGreaterThanOrEqual(12);
      }
    }

    const paper = token(globals, "--paper");
    const paper2 = token(globals, "--paper2");
    const ink = token(globals, "--ink");
    const ink2 = token(globals, "--ink2");
    for (const foreground of [ink, ink2]) {
      for (const background of [paper, paper2]) {
        expect(contrast(foreground, background), `${foreground} / ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // 主要按鈕是墨色底、紙色字；滑過時底色換成 --ink2（app/reading.module.css 的 primaryAction）。
    for (const background of [ink, ink2]) {
      expect(contrast(paper, background), `${paper} / ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("焦點雙環的兩色彼此至少 9:1（WCAG C40）", () => {
    expect(contrast(token(globals, "--focus-dark"), token(globals, "--focus-light"))).toBeGreaterThanOrEqual(9);
  });

  test("介面只用 400、600、700 三種字重", () => {
    const files = [...cssModuleFiles("app"), ...cssModuleFiles("components")];
    for (const path of files) {
      for (const match of read(path).matchAll(/font-weight:\s*(\d+)/g)) {
        expect(["400", "600", "700"], `${path} 用了 ${match[1]}`).toContain(match[1]);
      }
    }
  });
});

test.describe("圖面與熱區設計語言", () => {
  test("圖面 token 與 sprite 共用同一組定案值", () => {
    const values: Record<string, string> = {
      "--fp-paper": "#ffffff",
      "--fp-room": "oklch(0.967 0 0)",
      "--fp-room-wet": "oklch(0.935 0 0)",
      "--fp-room-balcony": "oklch(0.985 0 0)",
      "--fp-wall": "#a8a8a8",
      "--fp-column": "#585858",
      "--fp-structure": "#2b2b2b",
      "--fp-line": "#4a4a4a",
      "--fp-text": "#2b2b2b",
      "--fp-muted": "#767676",
      "--fp-furn": "#ffffff",
      "--fp-furn-line": "#8a8a8a",
    };
    for (const [name, expected] of Object.entries(values)) {
      expect(token(globals, name)).toBe(expected);
      expect(renderer).toContain("var(" + name + ")");
      if (sprite.includes("var(" + name + ",")) {
        expect(sprite).toContain("var(" + name + "," + expected + ")");
      }
    }
  });

  test("狀態線與記號使用語意 token，並保留灰階可辨識的形狀通道", () => {
    for (const name of [
      "--state-blue",
      "--state-warm",
      "--state-normal-fill",
      "--state-candidate-fill",
      "--state-selected-fill",
      "--state-highlighted-fill",
      "--state-revealed-stroke",
      "--mark-circle-stroke",
      "--mark-check-stroke",
    ]) {
      expect(token(globals, name), `缺少 ${name}`).toBeTruthy();
    }
    expect(viewer).not.toMatch(/stroke-dasharray/);
    expect(viewer).toContain("mix-blend-mode: multiply");
    expect(viewer).toContain("data-state=\"revealed\"");
    expect(viewer).toContain(".revealedMark");
    expect(viewer).toContain(".checkMark");

    const paper = token(globals, "--fp-paper");
    const wall = token(globals, "--fp-wall");
    // 坪數、尺寸標註也是字，對圖紙要達 4.5:1（DESIGN.md「--fp-muted 也畫字」）。
    expect(contrast(token(globals, "--fp-muted"), paper)).toBeGreaterThanOrEqual(4.5);
    for (const name of ["--state-blue", "--state-warm", "--mark-check-stroke"]) {
      const color = token(globals, name);
      expect(contrast(color, paper), `${name} / paper`).toBeGreaterThanOrEqual(3);
      expect(contrast(color, wall), `${name} / wall`).toBeGreaterThanOrEqual(3);
    }
  });

  // 記號的線寬在 CSS（non-scaling stroke），偏移量在 TS（SVG 的路徑幾何讀不到 CSS 變數）。
  // 線要畫在熱區外側，偏移量就是線寬的一半：兩邊的數字一旦分岔，線就壓回熱區裡，或與熱區之間多出一條縫。
  test("記號的幾何常數與 CSS token 同值", () => {
    const px = (name: string) => Number.parseFloat(token(globals, name));
    expect(MARK_PX.selectedWidth).toBe(px("--state-selected-width"));
    expect(MARK_PX.selectedCasing).toBe(px("--state-selected-mark"));
    expect(MARK_PX.revealedWidth).toBe(px("--state-revealed-width"));
    expect(MARK_PX.revealedArm).toBe(px("--state-revealed-mark"));
    expect(MARK_PX.focusWidth).toBe(px("--focus-ring-light-width"));
    expect(MARK_PX.checkSize).toBe(px("--mark-check-size"));
    expect(MARK_PX.checkWidth).toBe(px("--mark-check-width"));
    expect(MARK_PX.checkCasing).toBe(px("--mark-check-casing"));
  });
});
