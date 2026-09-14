import { hasSymbol, rectOf } from "./hotspots";
import type { FloorPlan, Hotspot, PlanRect, Room } from "./types";
import type { SymbolCategory, SymbolRecord } from "@/lib/symbols/types";

// 鍵盤使用者走過這張圖的順序（票 06，解掉 PRD §9 標為「v0.5 未決、實作前必須先定」的問題）：
// **依房間，房間內依符號類別**。這件事在 build 時算完，執行期不再重算。
//
// 為什麼是房間而不是座標掃描：使用者的心智模型是「看屋時一間一間看」，不是「由上到下掃過一張圖」。
// 一間房走完才走下一間，順序就可預期；照座標掃會在客廳與餐廳之間來回跳。
//
// 房間歸屬**由 floorplan.rooms 的幾何算出，不進 floorplan schema**——floorplan 由程式產生、
// 不得手改（CONTEXT.md），加一個 `room_id` 欄位就要動 `expand_layout.py` 與所有既有產物，
// 而那個欄位存的是這裡三行就能算出來的東西。

/** 一間房與它的熱區，依閱讀順序排好。沒有熱區的房間不會出現。 */
export type RoomHotspots = {
  roomId: string;
  roomName: string;
  hotspots: Hotspot[];
};

/**
 * 私密區的順位，也是**沒列進動線表裡的房間型態**的預設（書房、和室、更衣室…）。
 * 那些房間跟臥室一樣是走道旁的一扇門，跟著私密區走幾何是安全的預設；
 * 唯一明確排到最後的是管道間——那不是一個走得進去的空間。
 */
const PRIVATE_RANK = 7;

/**
 * 看屋的動線：進門 → 公共區 → 私密區 → 服務空間。
 *
 * 公共區的先後**不是幾何**：玄關在圖的東邊、客廳在最西邊，照座標排會從客廳開始，
 * 而沒有人是從客廳開始看房子的。所以公共區照機能給順位。
 *
 * 私密區（主臥、次臥、衛浴…）反過來共用同一個順位，區內**依幾何**：
 * 它們的門一扇一扇開在同一條走道上（主浴那扇開在主臥裡），走過去的先後就是門的先後，
 * 那是幾何決定的，不是房間型態決定的。照型態排會把客浴排到次臥前面，變成走過頭再走回來。
 */
const ROOM_TOUR_RANK: Record<string, number> = {
  entrance: 1,
  living_room: 2,
  dining_room: 3,
  kitchen: 4,
  balcony: 5,
  hallway: 6,
  master_bedroom: PRIVATE_RANK,
  bedroom: PRIVATE_RANK,
  bathroom: PRIVATE_RANK,
  pipe_shaft: 8,
};

const CATEGORY_RANK: Record<SymbolCategory, number> = {
  structure: 0,
  door_window: 1,
  furniture: 2,
};

/** symbol 查不到分類時排在最後。前台的字會落回 symbol id，順序也不該讓它插隊。 */
const UNKNOWN_CATEGORY_RANK = 3;

const right = (r: PlanRect) => r.x + r.width;
const bottom = (r: PlanRect) => r.y + r.height;
const area = (r: PlanRect) => r.width * r.height;

const overlapArea = (a: PlanRect, b: PlanRect) =>
  Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y));

/** 兩個矩形之間的最短距離；碰在一起是 0。 */
const gap = (a: PlanRect, b: PlanRect) =>
  Math.hypot(Math.max(a.x - right(b), b.x - right(a), 0), Math.max(a.y - bottom(b), b.y - bottom(a), 0));

const centerGap = (a: PlanRect, b: PlanRect) =>
  Math.hypot((a.x + right(a) - b.x - right(b)) / 2, (a.y + bottom(a) - b.y - bottom(b)) / 2);

/**
 * 這個熱區屬於哪一間房。
 *
 * 主要規則是**重疊面積最大者**。門窗、柱、外牆都畫在牆上，而 `geometry` 含牆厚，
 * 所以它們多半有一半落在房間裡——「窗屬於它照亮的那間房」因此是算出來的，不是猜的。
 *
 * 兩間房各佔一半時（走道通客廳的開口、臥室的門）取**面積小的那一間**：
 * 開口與門要跟它服務的那個空間一起被讀到，而不是全部堆在走道那一段裡，
 * 讓使用者連聽五次「一般單開門」卻不知道分別是哪一間的門。
 *
 * 完全落在所有房間之外的（雨遮），取貼得最近的那一間；一樣近時取重心較近的——
 * 主臥的雨遮與主浴的距離同為 12cm，少了這一條它會被歸到主浴去。
 */
function assignRoom(hotspot: Hotspot, rooms: Room[]): { room: Room; outside: boolean } {
  const rect = rectOf(hotspot);

  const covering = rooms
    .filter((room) => overlapArea(rect, room.geometry) > 0)
    .sort(
      (a, b) =>
        overlapArea(rect, b.geometry) - overlapArea(rect, a.geometry) ||
        area(a.geometry) - area(b.geometry),
    );
  if (covering[0]) return { room: covering[0], outside: false };

  const nearest = [...rooms].sort(
    (a, b) =>
      gap(rect, a.geometry) - gap(rect, b.geometry) ||
      centerGap(rect, a.geometry) - centerGap(rect, b.geometry),
  );
  return { room: nearest[0], outside: true };
}

const tourRank = (room: Room) => ROOM_TOUR_RANK[room.type] ?? PRIVATE_RANK;

/**
 * 這張圖上的熱區，依「依房間、房間內依類別」排好。
 *
 * 每一次排序都以既有順序收尾（`Array.prototype.sort` 是穩定的），所以分不出先後的兩個東西
 * 維持 floorplan 檔案裡的順序——那是程式產生的、穩定的順序，不是隨機的。
 *
 * `symbol_id` 為 null 的熱區不出現，理由與規則本身在 `hotspots.ts` 的 `hasSymbol`。
 */
export function readingOrder(
  floorplan: FloorPlan,
  symbols: Record<string, SymbolRecord>,
): RoomHotspots[] {
  const rooms = [...floorplan.rooms].sort(
    (a, b) =>
      tourRank(a) - tourRank(b) || a.geometry.y - b.geometry.y || a.geometry.x - b.geometry.x,
  );
  if (rooms.length === 0) {
    throw new Error(
      `floorplan ${floorplan.id} 沒有任何 room，算不出鍵盤的閱讀順序。\n` +
        "熱區的房間歸屬是由 rooms 的幾何算出來的（票 06）；沒有 rooms 就只剩一串沒有分段的熱區，" +
        "鍵盤使用者會失去「現在走到哪一間」這件事。寧可讓 build 停下來。",
    );
  }

  const categoryRank = (hotspot: Hotspot) => {
    const category = hotspot.symbol_id ? symbols[hotspot.symbol_id]?.category : undefined;
    return category ? CATEGORY_RANK[category] : UNKNOWN_CATEGORY_RANK;
  };

  const hotspotsByRoom = new Map<string, { hotspot: Hotspot; outside: boolean }[]>();
  for (const hotspot of floorplan.hotspots.filter(hasSymbol)) {
    const { room, outside } = assignRoom(hotspot, rooms);
    hotspotsByRoom.set(room.id, [...(hotspotsByRoom.get(room.id) ?? []), { hotspot, outside }]);
  }

  return rooms.flatMap((room) => {
    const inRoom = hotspotsByRoom.get(room.id);
    if (!inRoom) return [];
    // 掛在房子外緣的（雨遮）排在該房間的最後：房間裡實際有的東西先走完，
    // 走到外緣就知道這一間看完了。同類之間由上而下、由左而右。
    inRoom.sort(
      (a, b) =>
        Number(a.outside) - Number(b.outside) ||
        categoryRank(a.hotspot) - categoryRank(b.hotspot) ||
        a.hotspot.coords[1] - b.hotspot.coords[1] ||
        a.hotspot.coords[0] - b.hotspot.coords[0],
    );
    return [{ roomId: room.id, roomName: room.name, hotspots: inRoom.map((m) => m.hotspot) }];
  });
}

/**
 * 有任何一個熱區符合條件的房間，依閱讀順序。
 *
 * 問的是**已經排好的閱讀順序**，不是把 `assignRoom` 再跑一次：房間歸屬只能有一份答案，
 * 而那份答案在 build 時就算完了。說明卡開著時要把沒有標記的房間畫暗（票 07、M4 票 02），
 * 靠的就是這個對照。
 */
export function roomsWith(order: RoomHotspots[], matches: (hotspot: Hotspot) => boolean): string[] {
  return order.filter((room) => room.hotspots.some(matches)).map((room) => room.roomId);
}
