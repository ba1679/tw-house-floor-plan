import { memo, type ReactNode } from "react";
import {
  FIXED_FURNITURE,
  LAYER,
  TALL_FURNITURE,
  WALL_MOUNTED_FURNITURE,
  arcSweep,
  baseFontSize,
  fixtureFrame,
  lineWidth,
  openingBox,
  openingFrame,
  planFrame,
  planViewBox,
  roomCode,
  wallRect,
  exteriorSign,
  type FixtureFrame,
  type OpeningFrame,
  type PlanFrame,
} from "@/lib/floorplan/drawing";
import type {
  Annotation,
  Door,
  FloorPlan,
  Furniture,
  PlanPoint,
  PlanRect,
  Room,
  Wall,
  Window as PlanWindow,
} from "@/lib/floorplan/types";
import styles from "./FloorPlanRenderer.module.css";

// PRD §10.1 分層裡的 SVG Renderer。它讀 floorplan JSON 把圖畫出來，並把一個座標單位
// 就是圖面公分的 <svg> 交出去——熱區層以 children 疊在上面，疊上去不需要換算。
//
// **它只讀 JSON，不寫 JSON**：圖面是 floorplan 的投影，不是資料（CONTEXT.md）。
// 這一層知道怎麼畫，不知道熱區、不知道互動；唯一的例外是 `roomStates`，
// 而那正是這個 renderer 存在的理由（`docs/adr/0005`）。
//
// **圖上每個東西的 id 就是資料裡的 id**（`room-master`、`wall-001`、`f-bathtub-m`），
// 不加 floorplan 的前綴。M4 找找看要點名一個房間或一個符號時，手上有的就是資料裡那個 id；
// 中間再隔一層對照表，等於把「圖是資料的投影」這句話打折。
// 代價寫在這裡：**一份文件只放得下一張圖。** 兩張圖同頁時 `#room-master` 會有兩個，
// 而 `getElementById` 只會回第一個、不會抱怨。真要那樣做的那天，這裡要先長出前綴。
// （遮罩的 id 例外，它帶著 floorplan id——`url(#…)` 的參照是全文件的，
// 撞到不是選錯元素而是整片牆用了別張圖的遮罩，那個錯得更難看出來。）

/** 座標取到 0.1cm（1mm）。再細下去只是把浮點數的尾巴印進 DOM。 */
const r = (value: number) => Math.round(value * 10) / 10;

/**
 * 一間房此刻的畫法。
 *
 * `muted`（暗下去）是目前唯一的一種：說明卡開著時，沒有標記的房間用它暗下去（M2 票 07、M4 票 02）。
 * 長什麼樣由 CSS 決定，這裡只說是哪一種。
 */
export type RoomState = "muted";

type Props = {
  floorplan: FloorPlan;
  /** 房間 id → 此刻的畫法。沒列到的房間照常畫。 */
  roomStates?: Record<string, RoomState>;
  /** 靜態局部教學圖的觀察範圍；省略時維持完整圖面，不參與 ViewerState。 */
  region?: PlanRect;
  /** 疊在圖面上的東西（熱區層、容錯圈）。座標同為圖面公分。 */
  children?: ReactNode;
};

export function FloorPlanRenderer({ floorplan, roomStates, region, children }: Props) {
  const viewBox = region ?? planViewBox(floorplan);

  return (
    <svg
      id={`floorplan-${floorplan.id}`}
      className={styles.plan}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      // 不是 `img`：`img` 的子樹在 ARIA 裡是裝飾性的，而票 06 之後這底下有 37 個可聚焦的熱區，
      // 掛在 `img` 底下等於宣告它們不存在。這裡要的語意是「一個有名字的容器」。
      role="group"
      aria-label={`${floorplan.name} 平面配置圖`}
    >
      <PlanArtwork floorplan={floorplan} roomStates={roomStates} />
      {children}
    </svg>
  );
}

/**
 * 圖面本身，**memo 過**。
 *
 * 平移的每一次 pointermove 都會讓 `FloorPlanViewer` 重畫一輪（票 04），而圖面有近三百個
 * 元素、只跟 floorplan 與 roomStates 有關，跟視野無關——視野走的是 CSS transform。
 * 沒有這一層 memo，手指每動一下 React 就把整張圖重新 reconcile 一次。
 * （換掉產生器的產物之前，這裡是一個 `dangerouslySetInnerHTML` 的 `<g>`，React 從來不碰它。）
 *
 * 熱區層留在外面當 children：它每一輪都在變，而且本來就該變。
 */
const PlanArtwork = memo(function PlanArtwork({
  floorplan,
  roomStates,
}: {
  floorplan: FloorPlan;
  roomStates?: Record<string, RoomState>;
}) {
  const frame = planFrame(floorplan);
  const { viewBox } = frame;
  const wallById = new Map(floorplan.walls.map((wall) => [wall.id, wall]));
  const roomById = new Map(floorplan.rooms.map((room) => [room.id, room]));
  const fontSize = baseFontSize(floorplan.bounds);
  // 牆在門窗處要斷開。用遮罩而不是「拿紙色的矩形蓋掉」：蓋掉會在開口留下一道白條，
  // 而真實平面圖上地板是**穿過門口連續的**。遮罩讓底下的房間地板照樣露出來。
  const openingMaskId = `wall-openings-${floorplan.id}`;

  return (
    /* 圖面對輔助技術隱藏：它是一堆線與填色，念出來只會是「圖片」兩個字。
       同一份內容**讀得出來**的那一版是疊在它上面的熱區層——每個熱區有自己的名字、
       依房間排好（票 06）。 */
    <g aria-hidden="true">
      <defs>
        <mask
          id={openingMaskId}
          maskUnits="userSpaceOnUse"
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.width}
          height={viewBox.height}
        >
          <rect {...viewBox} fill="var(--fp-paper)" />
          {[...floorplan.doors, ...floorplan.windows].map((opening) => {
            const wall = wallById.get(opening.wall_id);
            if (!wall) return null;
            const box = openingBox(opening, wall);
            return (
              <rect
                key={opening.id}
                x={r(box.x)}
                y={r(box.y)}
                width={r(box.width)}
                height={r(box.height)}
                fill="#000"
              />
            );
          })}
        </mask>
      </defs>

      <rect
        className={styles.paper}
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.width}
        height={viewBox.height}
      />

      <Canopies floorplan={floorplan} />
      <Rooms floorplan={floorplan} roomStates={roomStates} />
      <Walls floorplan={floorplan} maskId={openingMaskId} />
      <Columns floorplan={floorplan} />
      <Doors floorplan={floorplan} wallById={wallById} roomById={roomById} />
      <Windows floorplan={floorplan} wallById={wallById} />
      <FurnitureLayer floorplan={floorplan} />
      <RoomLabels floorplan={floorplan} fontSize={fontSize} />
      <Dimensions floorplan={floorplan} frame={frame} fontSize={fontSize} />
      <NorthArrow frame={frame} fontSize={fontSize} />
      <TitleBlock floorplan={floorplan} frame={frame} fontSize={fontSize} />
    </g>
  );
});

/* --- 雨遮：外牆之外的外挑構造 ------------------------------------------- */

function Canopies({ floorplan }: { floorplan: FloorPlan }) {
  if (!floorplan.canopies?.length) return null;
  return (
    <g id="canopies" className={styles.canopy} strokeWidth={lineWidth("frame")}>
      {floorplan.canopies.map((canopy) => (
        <rect key={canopy.id} id={canopy.id} {...canopy.geometry} />
      ))}
    </g>
  );
}

/* --- 房間（圖層 06 地板）------------------------------------------------ */

const roomKind = (room: Room) => {
  switch (room.type) {
    case "master_bedroom": return "master";
    case "living_room": return "living";
    case "dining_room":
    case "kitchen": return "dining-kitchen";
    case "bathroom":
    case "balcony": return "wet-balcony";
    default: return "neutral";
  }
};

function Rooms({
  floorplan,
  roomStates,
}: {
  floorplan: FloorPlan;
  roomStates?: Record<string, RoomState>;
}) {
  return (
    <g id="rooms" data-layer={LAYER.floor}>
      {floorplan.rooms.map((room) => (
        <rect
          key={room.id}
          id={room.id}
          className={styles.room}
          data-room-type={room.type}
          data-room-kind={roomKind(room)}
          // 沒有狀態時**不放這個屬性**，而不是放一個 "normal"：畫面上兩者一樣，
          // 但測試問「這間房現在是不是暗的」時，前者答得乾脆。
          data-state={roomStates?.[room.id]}
          {...room.geometry}
        />
      ))}
    </g>
  );
}

/* --- 牆（圖層 02）------------------------------------------------------- */

function Walls({ floorplan, maskId }: { floorplan: FloorPlan; maskId: string }) {
  const rects = floorplan.walls.map((wall) => ({ wall, rect: wallRect(wall) }));
  const xs = rects.flatMap(({ rect }) => [rect.x, rect.x + rect.width]);
  const ys = rects.flatMap(({ rect }) => [rect.y, rect.y + rect.height]);

  return (
    <g id="walls" data-layer={LAYER.wall} mask={`url(#${maskId})`}>
      {rects.map(({ wall, rect }) => (
        <rect
          key={wall.id}
          id={wall.id}
          className={styles.wall}
          data-wall-type={wall.type}
          x={r(rect.x)}
          y={r(rect.y)}
          width={r(rect.width)}
          height={r(rect.height)}
        />
      ))}
      {xs.length > 0 && (
        <rect
          className={styles.outline}
          strokeWidth={lineWidth("structure_cut")}
          x={r(Math.min(...xs))}
          y={r(Math.min(...ys))}
          width={r(Math.max(...xs) - Math.min(...xs))}
          height={r(Math.max(...ys) - Math.min(...ys))}
        />
      )}
    </g>
  );
}

/* --- 柱（圖層 02，與牆同層）-------------------------------------------- */

function Columns({ floorplan }: { floorplan: FloorPlan }) {
  if (!floorplan.columns?.length) return null;
  return (
    <g id="columns" data-layer={LAYER.wall}>
      {floorplan.columns.map((column) => (
        <rect key={column.id} id={column.id} className={styles.column} {...column.geometry} />
      ))}
    </g>
  );
}

/* --- 門（圖層 04）------------------------------------------------------- */

function Doors({
  floorplan,
  wallById,
  roomById,
}: {
  floorplan: FloorPlan;
  wallById: Map<string, Wall>;
  roomById: Map<string, Room>;
}) {
  return (
    <g id="doors" data-layer={LAYER.door} className={styles.opening}>
      {floorplan.doors.map((door) => {
        const wall = wallById.get(door.wall_id);
        if (!wall) return null;
        return (
          <g key={door.id} id={door.id} data-door-type={door.type}>
            <Jambs opening={door} wall={wall} />
            <DoorLeaves door={door} wall={wall} roomById={roomById} />
          </g>
        );
      })}
    </g>
  );
}

/** 門樘／窗樘：牆在開口處斷開後的兩個端面。門與窗共用。 */
function Jambs({ opening, wall }: { opening: { offset: number; width: number }; wall: Wall }) {
  const frame = openingFrame(opening, wall);
  const t = wall.thickness;
  return (
    <>
      {[0, opening.width].map((a) => {
        const p0 = frame.at(a, -t / 2);
        const p1 = frame.at(a, t / 2);
        return (
          <line
            key={a}
            x1={r(p0.x)}
            y1={r(p0.y)}
            x2={r(p1.x)}
            y2={r(p1.y)}
            strokeWidth={lineWidth("frame")}
          />
        );
      })}
    </>
  );
}

function DoorLeaves({
  door,
  wall,
  roomById,
}: {
  door: Door;
  wall: Wall;
  roomById: Map<string, Room>;
}) {
  const frame = openingFrame(door, wall);
  const t = wall.thickness;

  // 出入口（p23 表 8 第一項）：牆斷開留空、**不畫門扇**，開口中央一個小三角記號。
  // 走道通客廳、開放式廚房這種寬開口用它——用加寬的拉門代替會畫出兩片不存在的門扇。
  // 規範沒有規定三角形的朝向，這裡朝 opens_to 那一側，讓它順帶帶一點資訊。
  if (door.type === "opening") {
    const room = door.opens_to ? roomById.get(door.opens_to) : undefined;
    let sign = 1;
    if (room) {
      const mid = frame.at(door.width / 2, 0);
      const toRoom = {
        x: room.geometry.x + room.geometry.width / 2 - mid.x,
        y: room.geometry.y + room.geometry.height / 2 - mid.y,
      };
      sign = toRoom.x * frame.normal.x + toRoom.y * frame.normal.y > 0 ? 1 : -1;
    }
    const c = door.width / 2;
    const points = [
      frame.at(c - t * 0.62, 0),
      frame.at(c + t * 0.62, 0),
      frame.at(c, sign * t * 0.52),
    ];
    return (
      <polygon
        className={styles.openingMark}
        points={points.map((p) => `${r(p.x)},${r(p.y)}`).join(" ")}
      />
    );
  }

  // 雙拉門（p23 表 8）：兩片門扇分別偏向兩端，中央一個小圓點表示交會。
  if (door.type === "sliding") {
    return <SlidingLeaves frame={frame} width={door.width} offset={t * 0.55} dot={t * 0.16} />;
  }

  // 平開門：一片門扇一道弧。幾何由 expand_layout.py 算好放在 swing_arcs，這裡不重算——
  // 三邊各自推導遲早會漂移。單開門一片；雙開門兩片等寬，各自從兩側門樘向中央開（p23 表 8）。
  return (
    <>
      {(door.swing_arcs ?? []).map((arc, index) => {
        const hinge = arc.hinge;
        const R = arc.radius;
        const tip = { x: hinge.x + arc.open.x * R, y: hinge.y + arc.open.y * R };
        const far = { x: hinge.x + arc.along.x * R, y: hinge.y + arc.along.y * R };
        // 弧鼓離鉸鏈，所以鼓的方向是兩個端點方向的和。取錯 sweep-flag 不會報錯，
        // 只會畫出一道凹向鉸鏈的弧——看起來像門往牆裡凹。
        const bulge = { x: arc.open.x + arc.along.x, y: arc.open.y + arc.along.y };
        return (
          <g key={index}>
            <line
              x1={r(hinge.x)}
              y1={r(hinge.y)}
              x2={r(tip.x)}
              y2={r(tip.y)}
              strokeWidth={lineWidth("frame")}
            />
            {/* 弧畫虛線是**語意**，不是美術選擇。p23 表 8 備考：「門扇之軌跡線如以實線表示，
                則可遮蔽地板材質線；如以虛線表示，則不可遮蔽之。」這張圖之後要疊地板鋪面
                與熱區，選虛線＝宣告「這道弧不遮蔽底下的東西」。 */}
            <path
              d={`M ${r(tip.x)} ${r(tip.y)} A ${R} ${R} 0 0 ${arcSweep(tip, far, bulge)} ${r(far.x)} ${r(far.y)}`}
              strokeDasharray="14 10"
              strokeWidth={lineWidth("minor")}
            />
          </g>
        );
      })}
    </>
  );
}

/** 兩片錯開的扇／窗扇加中央交會點。拉門與橫拉窗差的只是偏移量與點的大小。 */
function SlidingLeaves({
  frame,
  width,
  offset,
  dot,
  strokeWidth = lineWidth("major"),
}: {
  frame: OpeningFrame;
  width: number;
  offset: number;
  dot: number;
  strokeWidth?: number;
}) {
  const leaves: [PlanPoint, PlanPoint][] = [
    [frame.at(0, -offset), frame.at(width * 0.55, -offset)],
    [frame.at(width * 0.45, offset), frame.at(width, offset)],
  ];
  const center = frame.at(width * 0.5, 0);
  return (
    <>
      {leaves.map(([a, b], index) => (
        <line
          key={index}
          x1={r(a.x)}
          y1={r(a.y)}
          x2={r(b.x)}
          y2={r(b.y)}
          strokeWidth={strokeWidth}
        />
      ))}
      <circle className={styles.openingMark} cx={r(center.x)} cy={r(center.y)} r={r(dot)} />
    </>
  );
}

/* --- 窗（圖層 03）------------------------------------------------------- */

// 共同構造（p24 表 9）：牆在開口處斷開，開口以一條窗框帶橫跨，兩端有窗樘記號。
// 三種 type 的差別在框帶裡面畫幾條線、是實是虛、有沒有開啟弧。
function Windows({
  floorplan,
  wallById,
}: {
  floorplan: FloorPlan;
  wallById: Map<string, Wall>;
}) {
  return (
    <g id="windows" data-layer={LAYER.window} className={styles.opening}>
      {floorplan.windows.map((window) => {
        const wall = wallById.get(window.wall_id);
        if (!wall) return null;
        return (
          <g key={window.id} id={window.id} data-window-type={window.type}>
            <WindowBand window={window} wall={wall} />
            <Jambs opening={window} wall={wall} />
            <WindowLeaves window={window} wall={wall} bounds={floorplan.bounds} />
          </g>
        );
      })}
    </g>
  );
}

function WindowBand({ window, wall }: { window: PlanWindow; wall: Wall }) {
  const frame = openingFrame(window, wall);
  const t = wall.thickness;
  return (
    <>
      {[-t / 2, t / 2].map((b) => {
        const p0 = frame.at(0, b);
        const p1 = frame.at(window.width, b);
        return (
          <line
            key={b}
            x1={r(p0.x)}
            y1={r(p0.y)}
            x2={r(p1.x)}
            y2={r(p1.y)}
            strokeWidth={lineWidth("frame")}
          />
        );
      })}
    </>
  );
}

function WindowLeaves({
  window,
  wall,
  bounds,
}: {
  window: PlanWindow;
  wall: Wall;
  bounds: FloorPlan["bounds"];
}) {
  const frame = openingFrame(window, wall);
  const t = wall.thickness;
  const width = window.width;

  // 固定窗：框帶內 2 條平行細實線（玻璃）。
  if (window.type === "fixed") {
    return (
      <>
        {[-t / 6, t / 6].map((b) => {
          const p0 = frame.at(0, b);
          const p1 = frame.at(width, b);
          return (
            <line
              key={b}
              x1={r(p0.x)}
              y1={r(p0.y)}
              x2={r(p1.x)}
              y2={r(p1.y)}
              strokeWidth={lineWidth("minor")}
            />
          );
        })}
      </>
    );
  }

  // 單開窗：一片窗扇（90° 全開）＋一道弧，向室外側開（p24 表 9）。
  if (window.type === "casement") {
    const sign = exteriorSign(wall, bounds, frame.normal);
    const hinge = frame.at(0, 0);
    const tip = frame.at(0, sign * width);
    const far = frame.at(width, 0);
    const bulge = {
      x: frame.normal.x * sign + frame.along.x,
      y: frame.normal.y * sign + frame.along.y,
    };
    return (
      <>
        <line
          x1={r(hinge.x)}
          y1={r(hinge.y)}
          x2={r(tip.x)}
          y2={r(tip.y)}
          strokeWidth={lineWidth("major")}
        />
        <path
          d={`M ${r(tip.x)} ${r(tip.y)} A ${width} ${width} 0 0 ${arcSweep(tip, far, bulge)} ${r(far.x)} ${r(far.y)}`}
          strokeWidth={lineWidth("minor")}
        />
      </>
    );
  }

  // 雙橫拉窗：框帶內兩段線於中央錯開，交會處一個小接點。
  return (
    <SlidingLeaves
      frame={frame}
      width={width}
      offset={t / 6}
      dot={t * 0.14}
      strokeWidth={lineWidth("minor")}
    />
  );
}

/* --- 傢俱（圖層 07 活動 / 08 固定）-------------------------------------- */

function FurnitureLayer({ floorplan }: { floorplan: FloorPlan }) {
  return (
    <g id="furniture" className={styles.furniture} strokeWidth={lineWidth("minor")}>
      {floorplan.furniture.map((item) => (
        <g
          key={item.id}
          id={item.id}
          data-furniture-type={item.type}
          data-layer={FIXED_FURNITURE.has(item.type) ? LAYER.furnFixed : LAYER.furnMovable}
        >
          <FurniturePiece item={item} />
        </g>
      ))}
    </g>
  );
}

/**
 * 一件傢俱怎麼畫。
 *
 * 衛浴廚具那 4 件（馬桶、洗手台、廚具、浴缸）畫的是 p32 表 14 的形狀，
 * 與 `data/symbols.sprite.svg` 的圖例同一套——PRD §12 記著「圖例與主圖的畫法必須一致」，
 * 而本站的核心承諾是「符號頁認得的形狀，回到平面圖上找得到」。
 * floorplan-generator 的 renderer 把這 4 件簡化成橢圓或矩形，這裡不跟它（`docs/adr/0005`）。
 */
function FurniturePiece({ item }: { item: Furniture }) {
  const frame = fixtureFrame(item.geometry, item.rotation);
  const g = item.geometry;
  const detail = lineWidth("minor");
  const outline = lineWidth("major");

  switch (item.type) {
    // 表 14 坐式馬桶：便器橢圓＋靠牆那一側的水箱。
    case "toilet": {
      const bowl = frame.at(0.61, 0.5);
      const { rx, ry } = frame.radii(frame.span * 0.42, frame.depth * 0.39);
      const tank = frame.rect(0, 0.16, 0.22, 0.84);
      return (
        <>
          <ellipse cx={r(bowl.x)} cy={r(bowl.y)} rx={r(rx)} ry={r(ry)} strokeWidth={outline} />
          <rect
            x={r(tank.x)}
            y={r(tank.y)}
            width={r(tank.width)}
            height={r(tank.height)}
            rx={2}
            strokeWidth={outline}
          />
        </>
      );
    }

    // 表 14 洗臉盆（掛牆式）：牆線＋半橢圓盆＋落水口十字。
    case "sink": {
      const wall = frame.rect(0, 0, 0.12, 1);
      const left = frame.at(0.12, 0.08);
      const right = frame.at(0.12, 0.92);
      const { rx, ry } = frame.radii(frame.span * 0.42, frame.depth * 0.85);
      const drain = frame.at(0.58, 0.5);
      const cross = Math.min(frame.depth, frame.span) * 0.13;
      return (
        <>
          <path
            d={`M ${r(left.x)} ${r(left.y)} A ${r(rx)} ${r(ry)} 0 0 ${arcSweep(left, right, frame.front)} ${r(right.x)} ${r(right.y)} Z`}
            strokeWidth={outline}
          />
          <rect
            className={styles.fixtureWallLine}
            x={r(wall.x)}
            y={r(wall.y)}
            width={r(wall.width)}
            height={r(wall.height)}
          />
          <g className={styles.furnitureDetail} strokeWidth={detail}>
            <line
              x1={r(drain.x - cross)}
              y1={r(drain.y)}
              x2={r(drain.x + cross)}
              y2={r(drain.y)}
            />
            <line
              x1={r(drain.x)}
              y1={r(drain.y - cross)}
              x2={r(drain.x)}
              y2={r(drain.y + cross)}
            />
          </g>
        </>
      );
    }

    // 表 14 流理檯洗槽：檯面＋洗槽＋水龍頭。
    case "kitchen_counter": {
      const basin = frame.rect(0.22, 0.14, 0.82, 0.5);
      const tap = frame.at(0.14, 0.32);
      return (
        <>
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={2} strokeWidth={outline} />
          <g className={styles.furnitureDetail} strokeWidth={detail}>
            <rect
              x={r(basin.x)}
              y={r(basin.y)}
              width={r(basin.width)}
              height={r(basin.height)}
              rx={3}
            />
            <circle
              cx={r(tap.x)}
              cy={r(tap.y)}
              r={r(Math.min(frame.depth, frame.span) * 0.06)}
            />
          </g>
        </>
      );
    }

    // 表 14 浴缸：外框＋內框（缸body）＋落水口。
    case "bathtub": {
      const inner = frame.rect(0.08, 0.08, 0.92, 0.92);
      const drain = frame.at(0.82, 0.5);
      return (
        <>
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={6} strokeWidth={outline} />
          <g className={styles.furnitureDetail} strokeWidth={detail}>
            <rect
              x={r(inner.x)}
              y={r(inner.y)}
              width={r(inner.width)}
              height={r(inner.height)}
              rx={5}
            />
            <circle
              cx={r(drain.x)}
              cy={r(drain.y)}
              r={r(Math.min(frame.depth, frame.span) * 0.07)}
            />
          </g>
        </>
      );
    }

    // 淋浴間：地坪加對角線。表 14 沒有這一項，本站也沒有對應的 symbol——
    // 它在圖上只需要「這一格是淋浴區」這件事。
    case "shower":
      return (
        <>
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={2} strokeWidth={outline} />
          <Diagonals rect={g} strokeWidth={detail} />
        </>
      );

    default:
      return <GenericFurniture item={item} frame={frame} />;
  }
}

function GenericFurniture({ item, frame }: { item: Furniture; frame: FixtureFrame }) {
  const g = item.geometry;
  const soft = ["bed", "single_bed", "sofa"].includes(item.type);
  // 壁掛／吊掛物在 120~150cm 的切面**以上**，是投影下來的，所以外框畫虛線（p25 表 10 備考）。
  const projected = WALL_MOUNTED_FURNITURE.has(item.type);
  // 高櫃被切面切到 → 矩形內畫 X（p25 表 10 備考）。
  const cut = TALL_FURNITURE.has(item.type);
  // 枕頭側與椅背都在「背面」那一端，所以是同一條線，只差位置。
  const backLine = item.type === "sofa" ? 0.25 : soft ? 0.22 : null;

  return (
    <>
      <rect
        x={g.x}
        y={g.y}
        width={g.width}
        height={g.height}
        rx={soft ? 6 : 2}
        strokeWidth={lineWidth("major")}
        strokeDasharray={projected ? "10 8" : undefined}
      />
      {cut && <Diagonals rect={g} strokeWidth={lineWidth("minor")} />}
      {backLine !== null && (
        <line
          className={styles.furnitureDetail}
          strokeWidth={lineWidth("minor")}
          x1={r(frame.at(backLine, 0).x)}
          y1={r(frame.at(backLine, 0).y)}
          x2={r(frame.at(backLine, 1).x)}
          y2={r(frame.at(backLine, 1).y)}
        />
      )}
    </>
  );
}

function Diagonals({
  rect,
  strokeWidth,
}: {
  rect: { x: number; y: number; width: number; height: number };
  strokeWidth: number;
}) {
  return (
    <g className={styles.furnitureDetail} strokeWidth={strokeWidth}>
      <line x1={rect.x} y1={rect.y} x2={rect.x + rect.width} y2={rect.y + rect.height} />
      <line x1={rect.x + rect.width} y1={rect.y} x2={rect.x} y2={rect.y + rect.height} />
    </g>
  );
}

/* --- 房間名稱（圖層 11 文字）-------------------------------------------- */

function RoomLabels({ floorplan, fontSize }: { floorplan: FloorPlan; fontSize: number }) {
  const fixturesByRoom = new Map<string, Set<string>>();
  for (const item of floorplan.furniture) {
    const set = fixturesByRoom.get(item.room_id) ?? new Set<string>();
    set.add(item.type);
    fixturesByRoom.set(item.room_id, set);
  }

  return (
    <g id="room-labels" data-layer={LAYER.text} textAnchor="middle">
      {floorplan.rooms.map((room) => {
        const g = room.geometry;
        const cx = g.x + g.width / 2;
        const cy = g.y + g.height / 2;
        const code = roomCode(room, fixturesByRoom.get(room.id) ?? new Set());
        return (
          <g key={room.id}>
            <text
              className={styles.roomLabel}
              strokeWidth={Math.max(8, Math.trunc(fontSize * 0.42))}
              x={r(cx)}
              y={r(cy)}
              fontSize={fontSize}
            >
              {code ? `${room.name} ${code}` : room.name}
            </text>
            <text
              className={styles.roomArea}
              strokeWidth={Math.max(8, Math.trunc(fontSize * 0.42))}
              x={r(cx)}
              y={r(cy + fontSize * 1.2)}
              fontSize={Math.trunc(fontSize * 0.72)}
            >
              {room.area_ping.toFixed(1)} 坪
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* --- 尺寸線（圖層 10）--------------------------------------------------- */

/** 端點的短斜線長度（cm）。 */
const TICK = 12;

/** 標註文字離尺寸線的距離（cm）。 */
const LABEL_GAP = 22;

// 表 24：尺寸標註線用細實線。端點符號 Arrow／Dot／Tick 三選一且**全圖不得混用**，
// 這裡一律用 Tick（短斜線）。
//
// 標哪幾條由資料決定（`floorplan.annotations`），標在哪一條留白裡由這裡決定——
// 資料只說「從這點量到那點」，沒說線要畫在紙的哪一邊。
function Dimensions({
  floorplan,
  frame,
  fontSize,
}: {
  floorplan: FloorPlan;
  frame: PlanFrame;
  fontSize: number;
}) {
  const dimensions = (floorplan.annotations ?? []).filter((a) => a.type === "dimension");
  return (
    <g
      id="annotations"
      data-layer={LAYER.dimension}
      className={styles.dimension}
      strokeWidth={lineWidth("minor")}
    >
      {dimensions.map((dimension) => (
        <Dimension
          key={dimension.id}
          dimension={dimension}
          frame={frame}
          fontSize={Math.trunc(fontSize * 0.78)}
        />
      ))}
    </g>
  );
}

function Dimension({
  dimension,
  frame,
  fontSize,
}: {
  dimension: Annotation;
  frame: PlanFrame;
  fontSize: number;
}) {
  const { start, end, label } = dimension;
  // 量的是水平還是垂直的距離。斜的尺寸線這張圖上沒有，出現了就畫不出來——
  // 與其畫一條位置錯誤的線，不如不畫，讓少掉的那條標註自己說話。
  const horizontal = start.y === end.y;
  const vertical = start.x === end.x;
  if (horizontal === vertical) return null;

  if (horizontal) {
    const y = frame.dimensionTop;
    return (
      <g id={dimension.id}>
        <line x1={start.x} y1={r(y)} x2={end.x} y2={r(y)} />
        {[start.x, end.x].map((x) => (
          <line key={x} x1={x - TICK} y1={r(y + TICK)} x2={x + TICK} y2={r(y - TICK)} />
        ))}
        <text
          className={styles.dimensionText}
          x={r((start.x + end.x) / 2)}
          y={r(y - LABEL_GAP)}
          fontSize={fontSize}
          textAnchor="middle"
        >
          {label}
        </text>
      </g>
    );
  }

  const x = frame.dimensionLeft;
  const textX = r(x - LABEL_GAP);
  const textY = r((start.y + end.y) / 2);
  return (
    <g id={dimension.id}>
      <line x1={r(x)} y1={start.y} x2={r(x)} y2={end.y} />
      {[start.y, end.y].map((y) => (
        <line key={y} x1={r(x - TICK)} y1={y + TICK} x2={r(x + TICK)} y2={y - TICK} />
      ))}
      <text
        className={styles.dimensionText}
        x={textX}
        y={textY}
        fontSize={fontSize}
        textAnchor="middle"
        transform={`rotate(-90 ${textX} ${textY})`}
      >
        {label}
      </text>
    </g>
  );
}

/* --- 指北針（p16 §10(a)：平面配置圖應標示指北針，並以圖之上方為北方）---- */

function NorthArrow({ frame, fontSize }: { frame: PlanFrame; fontSize: number }) {
  const { cx, cy, r: radius } = frame.northArrow;
  const needle = `${r(cx)},${r(cy - radius * 0.78)} ${r(cx - radius * 0.4)},${r(cy + radius * 0.72)} ${r(cx)},${r(cy + radius * 0.34)}`;
  const tail = `${r(cx)},${r(cy - radius * 0.78)} ${r(cx + radius * 0.4)},${r(cy + radius * 0.72)} ${r(cx)},${r(cy + radius * 0.34)}`;

  return (
    <g id="north-arrow" className={styles.north} strokeWidth={lineWidth("minor")}>
      <circle className={styles.paper} cx={r(cx)} cy={r(cy)} r={r(radius)} />
      <polygon className={styles.northNeedle} points={needle} />
      <polygon className={styles.northTail} points={tail} />
      <text
        className={styles.northLabel}
        x={r(cx)}
        y={r(cy - radius - 8)}
        fontSize={Math.trunc(fontSize * 0.62)}
        textAnchor="middle"
      >
        N
      </text>
    </g>
  );
}

/* --- 圖名 / 比例尺 / 面積假設 ------------------------------------------- */

// p8 §5、p14 圖 8：圖名右方標比例尺。規範以 mm 為原則，本專案內部用 cm，
// 所以單位一律寫出來（見產生器的 rules/geometry.md），不留裸數字。
function TitleBlock({
  floorplan,
  frame,
  fontSize,
}: {
  floorplan: FloorPlan;
  frame: PlanFrame;
  fontSize: number;
}) {
  const meta = floorplan.area_meta;
  return (
    <g id="title-block" data-layer={LAYER.text}>
      <text
        className={styles.title}
        x={0}
        y={r(frame.titleBaseline)}
        fontSize={Math.trunc(fontSize * 0.95)}
      >
        {floorplan.name} 平面配置圖
        <tspan className={styles.titleScale} fontSize={Math.trunc(fontSize * 0.68)}>
          　S:1/50　單位：cm
        </tspan>
      </text>
      {meta?.deed_ping !== undefined && (
        <text
          className={styles.subtitle}
          x={0}
          y={r(frame.subtitleBaseline)}
          fontSize={Math.trunc(fontSize * 0.68)}
        >
          權狀 {meta.deed_ping} 坪 ／ 公設比 {Math.round((meta.public_ratio ?? 0) * 100)}% ／ 室內{" "}
          {meta.interior_ping?.toFixed(1)} 坪（{meta.interior_m2?.toFixed(1)} m²）
        </text>
      )}
    </g>
  );
}
