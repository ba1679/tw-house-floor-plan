import type { FloorPlan, FloorPlanArtwork } from "@/lib/floorplan/types";

// PRD §10.1 的分層：Layout Data → SVG Renderer → Hotspot Layer → Interaction State → Info Panel。
// 這個元件是其中的 SVG Renderer：只負責把圖面放進一個座標系正確、手機上不溢出的 <svg>。
// 熱區層與互動狀態是另外的東西，不會長進這裡。

type Props = {
  floorplan: FloorPlan;
  artwork: FloorPlanArtwork;
};

export function FloorPlanView({ floorplan, artwork }: Props) {
  const { x, y, width, height } = artwork.viewBox;

  return (
    <svg
      id={`floorplan-${floorplan.id}`}
      className="floorplan"
      viewBox={`${x} ${y} ${width} ${height}`}
      role="img"
      aria-label={`${floorplan.name} 平面配置圖`}
      // 圖面內容來自 data/layouts/*.svg：build 時讀進來的自家產物，不是使用者輸入。
      dangerouslySetInnerHTML={{ __html: artwork.markup }}
    />
  );
}
