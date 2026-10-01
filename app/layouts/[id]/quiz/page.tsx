import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizGame } from "@/components/QuizGame";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { readingOrder } from "@/lib/floorplan/reading-order";
import { hasQuiz, quizzableSymbols } from "@/lib/quiz/questions";
import { quizMetadata } from "@/lib/site-metadata";
import { loadSymbolsForViewer } from "@/lib/symbols/data";
import { quizHeading } from "@/lib/ui/copy";
// 與平面圖頁同一套「一個螢幕就是一頁」的版面：理由寫在那一份 CSS 上，不抄第二份。
import styles from "../page.module.css";

// 找找看（M4）：在一張圖上照題目把符號找出來。網址以 layout id 定址，與平面圖頁同一個理由（PRD §8）。
export const dynamicParams = false;

/**
 * 有找找看頁的 layout：**有可出題符號的那幾張**（spec「路由與頁面」，取代 PRD 舊 schema 的 `quiz_enabled`）。
 * 一個符號都出不了題的圖**不產生**這一頁：產生了，按下「開始」就是一局 0 題。
 * 可出題與否只問 `hasQuiz`——平面圖頁與首頁要不要放入口也問它（M4 票 06），題數與題目池問的是它底下的 `quizzableSymbols`。
 */
function quizLayoutIds(): string[] {
  return listLayoutIds().filter((id) => hasQuiz(loadFloorPlan(id).hotspots));
}

export function generateStaticParams() {
  return quizLayoutIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!quizLayoutIds().includes(id)) return {};

  // **noindex、不進 sitemap**（spec「路由與頁面」）：一局的題目是隨機的，搜尋結果上沒有東西可以給人看。
  // sitemap 那一側「有哪幾種頁」是手列的（`app/sitemap.ts`），這一種刻意不加。
  return quizMetadata(loadFloorPlan(id));
}

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!quizLayoutIds().includes(id)) notFound();

  const floorplan = loadFloorPlan(id);
  const symbols = loadSymbolsForViewer();

  return (
    <main className={styles.quiz}>
      <h1 className={styles.title}>{quizHeading(floorplan.name)}</h1>
      {/* 閱讀順序與可出題符號都在 build 時算完：頁面是 SSG，瀏覽器拿到的是結果。 */}
      <QuizGame
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder(floorplan, symbols)}
        quizzable={quizzableSymbols(floorplan.hotspots)}
      />
    </main>
  );
}
