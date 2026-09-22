# 07: 啟用 80% 內容發布 gate

**What to build:** 讓「至少 80% Symbol 已完成本站查證流程」成為真正會阻擋 build 的發布條件，使未達門檻的內容不能只帶著一行警告進入 production。

**Blocked by:** 03 / 擴充 Source Tier 查證規則；04 / 完成四筆 CNS 轉載查證；05 / 完成結構類 convention 交叉查證；06 / 完成門窗類 convention 交叉查證

**Status:** done

- [x] 查證率以 `verification_status=verified` 的筆數除以全部 Symbol 筆數計算，並在低於 0.8 時加入 error、非零結束
- [x] 14 筆資料必須至少 12 筆才通過；不得用顯示用四捨五入讓 11/14 = 78.6% 通過
- [x] 暫存資料案例證明 11/14 失敗、12/14 通過，錯誤輸出含實際分子、分母、百分比與門檻
- [x] Tier-specific 規則先於或同時於比例判斷生效；把不合格資料硬改成 `verified` 不能灌高查證率
- [x] 空 Symbol 清單或分母異常時明確失敗，不以 0/0 或空迴圈通過
- [x] 真資料至少達 12/14，且每一筆 counted-as-verified 都通過自己的 Source Tier 條件
- [x] Validator 成功輸出清楚顯示查證率已達標；警告不會掩蓋 error exit code
- [x] Prebuild 與完整 production build 都會走到這道 gate
