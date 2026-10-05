import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { TeachingFigure } from "@/components/TeachingFigure";
import type { TeachingFigure as TeachingFigureContent } from "@/lib/guides/data";
import type { FloorPlan } from "@/lib/floorplan/types";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "另一張局部圖｜家具與尺寸試用｜拼厝",
  description: "教學試用時使用的第二張局部範例。",
  robots: { index: false, follow: false },
};

function loadStudyFigure(): TeachingFigureContent {
  const floorplan = JSON.parse(readFileSync(join(process.cwd(), "data/study/bedroom-transfer.floorplan.json"), "utf8")) as FloorPlan;
  return {
    view: "room",
    // 全片段的外框尺寸不在這張房間局部圖內，不能當作已提供的房間尺寸。
    floorplan: { ...floorplan, annotations: [] },
    roomId: "study-bedroom",
    caption: "臥室乙局部・本站生成的教學示意圖，非實際建案",
    description: "臥室乙局部，圖上有臥室乙與 4.8 坪文字。左側有床、右側有書桌，上方有門，下方有窗。圖中除此之外沒有數值尺寸標註。",
  };
}

export default function FurnitureDimensionsStudyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.content}>
        <p className={styles.eyebrow}>家具與尺寸・教學試用</p>
        <h1>另一張局部圖</h1>
        <p className={styles.intro}>請只根據這張示意圖與圖上文字，依序回答下面三項。可以口頭作答。</p>
        <div className={styles.figure}><TeachingFigure figure={loadStudyFigure()} /></div>
        <ol className={styles.tasks}>
          <li><strong>有圖面依據的觀察</strong><span>請說出一項，並指出你依據的圖上元素或文字。</span></li>
          <li><strong>尚未確認的資訊</strong><span>請說出一項目前無法從這張圖確定的資訊。</span></li>
          <li><strong>能補足這項資訊的問題</strong><span>請提出一個能向建商詢問、對應上一項資訊缺口的具體問題。</span></li>
        </ol>
      </article>
    </main>
  );
}
