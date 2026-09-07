import { notFound } from "next/navigation";
import { FloorPlanViewer } from "@/components/FloorPlanViewer";
import { listLayoutIds, loadFloorPlanBundle } from "@/lib/floorplan/data";
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

  const { floorplan, artwork } = loadFloorPlanBundle(id);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{floorplan.name}</h1>
      <FloorPlanViewer floorplan={floorplan} artwork={artwork} symbols={loadSymbols()} />
    </main>
  );
}
