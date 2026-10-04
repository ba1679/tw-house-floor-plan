# Phase 2 第四步：資訊缺口與提問清單核對

核對日期：2026-10-04（Asia/Taipei）
範圍：[票 04](../../.scratch/phase2-furniture-dimensions/issues/04-questions-and-print.md)，本站 `3b2l_standard` 教學範例。

## 核對方式與適用範圍

逐題對照 [FloorPlan JSON](../../data/layouts/3b2l_standard.floorplan.json) 的 `rooms[id=room-master]`、`furniture[id=f-bed-m/f-wardrobe-m]`、`doors[id=door-master]` 與完整 `annotations`；再對照前三步正式內容與 [家具示意](phase2-furniture-guide-step1.md)、[尺寸依據](phase2-dimension-evidence.md)、[使用空間](phase2-usable-space.md) 的原始資料核對紀錄。這些是本站生成的範例資料，不是特定建案的實測圖。問題只要求取得未提供的資訊；沒有引用通用淨空門檻或法律效果。

| 清單問題 | 前三步已核對的缺口 | 為什麼這樣問 |
| --- | --- | --- |
| 主臥淨長寬及量測位置、單位 | 第二步的 `dim-overall-w/h` 只標整戶外牆牆心線距離；`rooms[id=room-master]` 的 3.0 坪是面積顯示。 | 不能從整戶尺寸或面積直接得出房間淨長寬。請對方在實際圖面標位置，避免把不同量測範圍混用。 |
| 床與衣櫃的示意長寬、位置及標示尺寸的配置圖 | 第一步局部圖畫有兩件家具，但 `annotations` 沒有其長寬標註。 | 畫出家具不等於知道示意尺寸；與自己的家具比較前，需要取得雙方的尺寸。 |
| 主臥門的開啟方向、範圍及家具放入後的關係 | 第三步 `door-master` 有朝主臥的 `swing_arcs`，但這是生成的教學圖。 | 門扇弧能提示要核對開門關係，不能替實際建案保證門扇不受家具妨礙。 |
| 房門至床邊、衣櫃前的可用空間與櫃門方式 | 第三步局部圖沒有通道寬度、櫃前深度或衣櫃開門方式的標註。 | 圖上的留白不能證明能走動、開櫃或取物；這些都是待建商提供條件後才能比較的資訊。 |

清單的問題和理由只維護在 `data/guides/furniture-dimensions.json` 的 `checklist.questions`。第四步以 `question_ids` 引用同一組條目，螢幕與列印也用同一頁內容。建置驗證檢查四題參照與依據；實際列印呈現另以瀏覽器核對。

## 列印核對

2026-10-04，於 Chrome 實際列印預覽檢視 A4 直向輸出：共一頁，標題、適用範圍、四題及理由均完整；頁首返回／列印控制、站台 header 與 footer 未進入紙面。另以 Chromium print media 的自動化測試確認內容與控制顯示狀態，並在 320、375、1280px 的螢幕版檢查無橫向溢出。

## 沒有推導的結論

- 沒有把生成器內部的家具長寬、留空數字或房間 `inner` 數值當成圖上已標示的條件。
- 沒有判定特定房屋可否放入某件家具、住起來是否舒適，或房屋是否值得購買。
- 沒有推論建商一定提供哪一種圖面、配置是否納入交付內容，或任何法律承諾；這份清單只用來取得待核對資料。
