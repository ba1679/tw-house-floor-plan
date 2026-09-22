import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloorPlanViewer } from "@/components/FloorPlanViewer";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { readingOrder } from "@/lib/floorplan/reading-order";
import { hasQuiz } from "@/lib/quiz/questions";
import { jsonLd, layoutLearningResourceJsonLd, layoutMetadata } from "@/lib/site-metadata";
import { loadSymbolsForViewer } from "@/lib/symbols/data";
import { LAYOUT_QUIZ_LINK } from "@/lib/ui/copy";
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

  return layoutMetadata(loadFloorPlan(id));
}

export default async function LayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!listLayoutIds().includes(id)) notFound();

  const floorplan = loadFloorPlan(id);
  const symbols = loadSymbolsForViewer();

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(layoutLearningResourceJsonLd(floorplan, symbols)) }}
      />
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
