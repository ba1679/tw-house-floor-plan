import type { TeachingFigure as TeachingFigureContent } from "@/lib/guides/data";
import { lineWidth } from "@/lib/floorplan/drawing";
import { FloorPlanRenderer } from "./FloorPlanRenderer";
import styles from "./TeachingFigure.module.css";

// 完整圖縮至 320px 螢幕時，標註文字仍需達 12px；只影響教學圖。
const TEACHING_DIMENSION_SCALE = 3.5;

export function TeachingFigure({ figure }: { figure: TeachingFigureContent }) {
  const room = figure.view === "room" ? figure.floorplan.rooms.find((item) => item.id === figure.roomId)! : null;
  // 房間外框含牆；留到最厚牆及製圖線的外緣，避免裁掉門窗描邊。
  const allowance = Math.max(...figure.floorplan.walls.map((wall) => wall.thickness)) / 2 + lineWidth("frame");
  const region = room ? {
    x: room.geometry.x - allowance,
    y: room.geometry.y - allowance,
    width: room.geometry.width + allowance * 2,
    height: room.geometry.height + allowance * 2,
  } : undefined;
  const dimensionDescriptions = figure.view === "overall" ? figure.dimensions.map((dimension) => {
    const horizontal = dimension.start.y === dimension.end.y;
    return `${horizontal ? "橫向" : "縱向"} ${dimension.label}：從${horizontal ? "左側外牆的牆心線到右側外牆的牆心線" : "上側外牆的牆心線到下側外牆的牆心線"}。`;
  }) : undefined;

  return (
    <figure className={styles.figure}>
      <div className={styles.drawing} aria-hidden="true">
        <FloorPlanRenderer floorplan={figure.floorplan} region={region} teachingDimensionScale={figure.view === "overall" ? TEACHING_DIMENSION_SCALE : undefined} />
      </div>
      <figcaption className={styles.caption}>{figure.caption}</figcaption>
      {dimensionDescriptions && <ul className={styles.dimensionList}>{dimensionDescriptions.map((description) => <li key={description}>{description}</li>)}</ul>}
      <details className={styles.description}>
        <summary>圖面文字說明</summary>
        <p>{figure.description}</p>
      </details>
    </figure>
  );
}
