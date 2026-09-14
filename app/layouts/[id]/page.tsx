import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloorPlanViewer } from "@/components/FloorPlanViewer";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { readingOrder } from "@/lib/floorplan/reading-order";
import { hasQuiz } from "@/lib/quiz/questions";
import { loadSymbolsForViewer } from "@/lib/symbols/data";
import { LAYOUT_QUIZ_LINK, layoutPageDescription, layoutPageTitle } from "@/lib/ui/copy";
import styles from "./page.module.css";

// 網址以 layout（格局）id 定址，頁面渲染的是該 layout 展開出的 floorplan（PRD §8）。
export const dynamicParams = false;

export function generateStaticParams() {
  return listLayoutIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!listLayoutIds().includes(id)) return {};

  // 每一張圖自己的標題與描述，由它自己的 `floorplan.name` 生成。沿用根版面那一句「平面圖教學」的話，
  // 這一頁在搜尋結果上與首頁同名；寫死三房兩廳的話，M6 加第 2 張圖時兩頁又同名（spec「路由」）。
  //
  // **只改 `<title>` 與 meta，不動 `<h1>`**——與符號頁、分類頁「兩者同一句」的規矩刻意不同。
  // 這一頁的 `<h1>` 是 100dvh 版面裡的一列（ADR-0003）：換成這一句，它在 375px 上會折成兩行，
  // 檢視器的框就跟著變矮——說明卡升起時與矮螢幕上，正是票 04 的頁尾驗過的那一類風險。
  const { name } = loadFloorPlan(id);
  return {
    title: layoutPageTitle(name),
    description: layoutPageDescription(name),
  };
}

export default async function LayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!listLayoutIds().includes(id)) notFound();

  const floorplan = loadFloorPlan(id);
  const symbols = loadSymbolsForViewer();

  return (
    <main className={styles.page}>
      {/* 找找看的入口與 `<h1>` 同一列（M4 票 06），**不另起一列**：同一個 ADR-0003 的理由，每多一列就從圖框挖一列。
          入口只替有找找看頁的圖放——與找找看頁產不產生問的是同一句 `hasQuiz`。 */}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{floorplan.name}</h1>
        {hasQuiz(floorplan.hotspots) && (
          <Link className={styles.quizLink} href={`/layouts/${id}/quiz`}>
            {LAYOUT_QUIZ_LINK}
          </Link>
        )}
      </div>
      {/* 鍵盤的閱讀順序在這裡算完（票 06）：頁面是 SSG，這一行只在 build 時跑一次，
          瀏覽器拿到的是排好的結果。房間歸屬因此不必寫進 floorplan schema。 */}
      <FloorPlanViewer
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder(floorplan, symbols)}
      />
    </main>
  );
}
