import type { ReactNode } from "react";
import type { FloorPlan, FloorPlanArtwork } from "@/lib/floorplan/types";

// PRD §10.1 分層裡的 SVG Renderer：只負責把圖面放進一個座標系正確的 <svg>，
// 座標單位就是圖面的公分。它不知道熱區、不知道互動——那些以 children 疊在它上面，
// 疊上去不需要換算，因為疊的東西跟圖面用同一個座標系。
//
// 這一層現在顯示的是 floorplan-generator 的產物（docs/adr/0002）。票 07 會把它換成
// 自己讀 JSON 畫的 React renderer；換的時候只有這個檔會動，介面不變。

type Props = {
  floorplan: FloorPlan;
  artwork: FloorPlanArtwork;
  /** 疊在圖面上的東西（熱區層、容錯圈）。座標同為圖面公分。 */
  children?: ReactNode;
};

export function FloorPlanView({ floorplan, artwork, children }: Props) {
  const { x, y, width, height } = artwork.viewBox;

  return (
    <svg
      id={`floorplan-${floorplan.id}`}
      className="floorplan"
      viewBox={`${x} ${y} ${width} ${height}`}
      // 不是 `img`：`img` 的子樹在 ARIA 裡是裝飾性的，而票 06 之後這底下有 37 個可聚焦的熱區，
      // 掛在 `img` 底下等於宣告它們不存在。這裡要的語意是「一個有名字的容器」。
      role="group"
      aria-label={`${floorplan.name} 平面配置圖`}
    >
      {/* 圖面內容來自 data/layouts/*.svg：build 時讀進來的自家產物，不是使用者輸入。

          對輔助技術隱藏：它是一堆線與填色，念出來只會是「圖片」兩個字。同一份內容**讀得出來**
          的那一版是疊在它上面的熱區層——每個熱區有自己的名字、依房間排好（票 06）。 */}
      <g aria-hidden="true" dangerouslySetInnerHTML={{ __html: artwork.markup }} />
      {children}
    </svg>
  );
}
