# Phase 2 第三步：主臥使用空間核對

核對日期：2026-10-04（Asia/Taipei）
範圍：[票 03](../../.scratch/phase2-furniture-dimensions/issues/03-usable-space.md)，本站 `3b2l_standard` 教學範例。

## 第一手依據

本步沿用前兩步的 [FloorPlan JSON](../../data/layouts/3b2l_standard.floorplan.json) 與 [FloorPlanRenderer](../../components/FloorPlanRenderer.tsx)；局部裁切由 [TeachingFigure](../../components/TeachingFigure.tsx) 完成。這是本站生成的讀圖範例，不是特定建案的實測或施工圖。下表的 ID 與欄位是維護者重新查證的定位。

| 圖面觀察 | 來源定位 | 可說到哪裡 |
| --- | --- | --- |
| 主臥局部有床與衣櫃。 | `rooms[id=room-master]`；`furniture[id=f-bed-m/f-wardrobe-m]`，兩件家具的 `room_id` 均為 `room-master`。 | Renderer 依原始幾何畫出床在局部右下、衣櫃在上方；可描述相對位置。家具的內部幾何長寬沒有成為圖上的尺寸標註。 |
| 主臥門畫在房間上方靠右，門扇及開啟弧朝房內。 | `doors[id=door-master]` 的 `opens_to=room-master`、`swing_arcs[0].open` 朝圖面下方；Renderer 的 `DoorLeaves` 依 `swing_arcs` 畫門扇與弧線。 | 可請讀者觀察門扇畫法及其與家具的相對位置；弧線不是特定建案的施工保證。 |
| 沒有標出床邊通道寬度或衣櫃開啟空間。 | FloorPlan JSON 的完整 `annotations` 只有 `dim-overall-w`、`dim-overall-h`，皆為整戶外牆牆心線尺寸；Renderer 的 `Dimensions` 只畫這兩筆。 | 不能用整戶尺寸、主臥面積或目測留白替代主臥淨尺寸、通道寬度、櫃前深度與衣櫃開門方式。 |

這些是對同一張可見範例的觀察與資訊不足推論。局部圖仍會顯示其他門窗；「主臥門」專指 `door-master`，不把所有可見門都說成朝同一方向開。

## 讀者可用的條件與缺口

讀者可見的是圖上的床、衣櫃、主臥門扇與弧線，以及前一步的整戶外牆牆心線尺寸。沒有房間淨長寬、床與衣櫃的已標示長寬、床邊通道尺寸、衣櫃的開門方式或開啟所需空間，也沒有讀者自己的家具尺寸。JSON 中 `geometry`、`inner`、門寬與 `swing_arcs` 的數字用於生成圖形，未標在本步教學圖上，不作為讀者已知尺寸。

即使另取得家具與房間長寬，仍需核對從房門到床邊的通道、門扇開啟時與家具的關係，以及衣櫃前站立、取物與開門所需空間。第三步把這些列為**待確認事項**，沒有宣稱這張圖中的空間足夠或不足，也沒有代替讀者判斷個人適用性。

生成器內建家具尺寸與留空條件只為建立這張示意圖；本步不把它們發佈成一般住宅的舒適或法規門檻。未取得這類普遍數值的原始依據，因此沒有發佈數字。具體追問是：請建商提供主臥淨尺寸、門扇開啟範圍、示意家具尺寸與擺位，以及衣櫃開門方式，再對照讀者自己的家具尺寸與使用需求。這些資料也需核對於實際銷售或施工文件；教學範例本身不提供承諾。

## 呈現核對

步驟、依據與圖面等價文字均從 `data/guides/furniture-dimensions.json` 投影。圖面等價文字描述床、衣櫃、主臥門的可見位置和缺少的標註，不加入隱藏數字。讀者可用「看這一步的依據」核對範例限制，或返回同一個三房兩廳完整格局。真瀏覽器的圖面可見範圍、鍵盤與手機核對記錄在票 03 的驗證結果。
