import { notFound } from "next/navigation";
import { FloorPlanViewer } from "@/components/FloorPlanViewer";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { readingOrder } from "@/lib/floorplan/reading-order";
import { loadSymbols } from "@/lib/symbols/data";
import styles from "./page.module.css";

// 網址以 layout（格局）id 定址，頁面渲染的是該 layout 展開出的 floorplan（PRD §8）。
export const dynamicParams = false;

export function generateStaticParams() {
  return listLayoutIds().map((id) => ({ id }));
}

export default async function LayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!listLayoutIds().includes(id)) notFound();

  const floorplan = loadFloorPlan(id);
  const symbols = loadSymbols();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{floorplan.name}</h1>
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
