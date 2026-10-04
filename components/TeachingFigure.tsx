import type { TeachingFigure as TeachingFigureContent } from "@/lib/guides/data";
import { lineWidth } from "@/lib/floorplan/drawing";
import { FloorPlanRenderer } from "./FloorPlanRenderer";
import styles from "./TeachingFigure.module.css";

export function TeachingFigure({ figure }: { figure: TeachingFigureContent }) {
  const room = figure.floorplan.rooms.find((item) => item.id === figure.roomId)!;
  // 房間外框含牆；留到最厚牆及製圖線的外緣，避免裁掉門窗描邊。
  const allowance = Math.max(...figure.floorplan.walls.map((wall) => wall.thickness)) / 2 + lineWidth("frame");
  const region = {
    x: room.geometry.x - allowance,
    y: room.geometry.y - allowance,
    width: room.geometry.width + allowance * 2,
    height: room.geometry.height + allowance * 2,
  };

  return (
    <figure className={styles.figure}>
      <div className={styles.drawing} aria-hidden="true">
        <FloorPlanRenderer floorplan={figure.floorplan} region={region} />
      </div>
      <figcaption className={styles.caption}>{figure.caption}</figcaption>
      <details className={styles.description}>
        <summary>圖面文字說明</summary>
        <p>{figure.description}</p>
      </details>
    </figure>
  );
}
