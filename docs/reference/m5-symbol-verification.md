# M5 symbol verification notes

Date: 2026-09-21
Verifier: Codex
Scope: `.scratch/m5-launch/issues/04-verify-republished-cns-symbols.md`, `05-cross-check-structure-conventions.md`, `06-cross-check-door-window-conventions.md`

This note records why each M5 symbol was or was not marked `verified`. In this project, `verified` means the site-defined verification flow is complete. It does not mean CNS 11567 was purchased or checked directly.

## Sources Read

- `平面圖符號.pdf` in this repo and the same public PDF at <https://www.idroc.org.tw/upload/20190626094803.pdf>: 《室內設計裝修製圖規範》, 中華民國室內設計裝修商業同業公會全國聯合會. The downloaded public copy matched the local PDF metadata and page count.
- <https://ecampus.nqu.edu.tw/eCampus3P/Learn/common_view_standalone_file.ashx?AttachMediaId=c2405026-f783-40e7-a257-2fcd27a38a47&CourseId=74f2946c-55af-4770-8387-edaaa19256fe>: 國立金門大學建築學系《建築圖學（一）》第六週，影線與線條.
- <https://ecampus.nqu.edu.tw/eCampus3P/Learn/common_view_standalone_file.ashx?AttachMediaId=ca466d91-916c-4d3f-ad6b-f86b5ff9fab7&CourseId=74f2946c-55af-4770-8387-edaaa19256fe>: 國立金門大學建築學系《建築圖學（一）》第八週，平面基礎：門.
- <https://ecampus.nqu.edu.tw/eCampus3P/Learn/common_view_standalone_file.ashx?AttachMediaId=0d8e145b-976c-47ff-839c-78fcca396249&CourseId=74f2946c-55af-4770-8387-edaaa19256fe>: 國立金門大學建築學系《建築圖學（一）》第九週，平面基礎：窗.
- <https://www.water.gov.tw/ch/ServerFile/Get/ae6cdbf6-ea91-4c66-982e-f635514c3dbd?nodeId=812>: 經濟部水利署《建築物給水排水設備設計技術規範（草案）》.

I did not use third-party reposts of CNS 11567 found on the web. They are not official sources and would undermine ADR-0001's "do not purchase or directly verify CNS 11567" boundary.

## CNS Republished Symbols

The NAID PDF's page 31 starts Table 14 and its title explicitly says the table quotes CNS11567, A1042 architectural drawing. Page 32 is the continuation page that contains the four furniture/sanitary fixture drawings below. Because the CNS reference statement is on page 31, the JSON clauses now point to both pages instead of only page 32.

All four remain `source_tier: cns`, have a `via` disclosure, and are marked `verified` only as republished CNS content. The site still has not checked CNS 11567 itself.

| Symbol | Decision | Basis |
|---|---|---|
| `toilet` | verified | Page 32 lists the seated toilet in plan/elevation form; page 31 supplies the CNS republishing statement. |
| `washbasin` | verified | Page 32 lists wall-mounted, counter-mounted, and pedestal washbasin drawings; page 31 supplies the CNS republishing statement. |
| `kitchen_counter` | verified | Page 32 lists the kitchen counter/sink drawing; page 31 supplies the CNS republishing statement. |
| `bathtub` | verified | Page 32 lists bathtub plan/elevation drawings; page 31 supplies the CNS republishing statement. |

Residual limitation: these four can drift from the current CNS text if CNS 11567 has changed after the republished table. The JSON `via` text states this explicitly.

## Structure Convention Symbols

For the four structure symbols, NAID remains the primary Taiwan-specific drafting source. The independent cross-check is used only where it actually supports the drafting meaning.

| Symbol | Decision | Basis |
|---|---|---|
| `wall` | verified | NAID p28-p29 gives wall/material construction examples and p47 assigns light-gray fill to walls. NQU linework notes independently support the broader convention that cut structural elements such as walls use the strongest line hierarchy in plans/sections. The light-gray fill itself remains NAID-specific. |
| `column` | verified | NAID p47 assigns dark-gray fill to columns and p28 includes column/intermediate-column terms in construction examples. NQU independently supports columns as cut structural elements in the strongest line hierarchy. The dark-gray fill itself remains NAID-specific. |
| `beam` | verified | NAID p18 defines long dashed lines as upper structural projection such as beam lines, and p47 repeats the 150 cm plan-cut example for overhead beams. NQU independently supports the underlying drafting distinction: cut structural elements use strong lines, while overhead/non-present plan information is drawn with fine dashed convention. |
| `pipe_shaft` | verified | NAID p48 gives `I.P` as pipe/service space and p51 gives `PS` as Pipe Shaft. The Water Resources Agency draft independently supports the building-services meaning of pipe routes being coordinated through pipe-shaft locations. NAID supplies the drawing abbreviation; the official draft supplies the MEP planning function. |

Residual limitation: for `wall` and `column`, the second source supports the structural linework convention but not the exact gray-fill convention. The exact light/dark fill distinction is still from NAID. For `pipe_shaft`, the second source supports function and planning location, not a graphic symbol.

## Door And Window Convention Symbols

For the five door/window symbols, NAID and NQU are independent and mutually consistent. NAID is the formal industry specification used by this project; NQU is a university architectural drawing handout showing the same plan-symbol family.

| Symbol | Decision | Basis |
|---|---|---|
| `door_single_swing` | verified | NAID p23 Table 8 lists the single swing door. NQU door handout p1 shows the single door plan symbol with swing arc and rotation semantics. |
| `door_double_swing` | verified | NAID p23 Table 8 lists the double swing door. NQU door handout p1 shows the double door plan symbol. |
| `door_sliding` | verified | NAID p23 Table 8 lists single/double/bidirectional/pocket sliding door variants. NQU door handout p1 shows sliding and pocket sliding plan examples. |
| `entrance_opening` | verified | NAID p23 Table 8 lists entrance/opening. NQU door handout p1 also includes an entrance/opening plan symbol without a door swing. |
| `window` | verified | NAID p24 Table 9 lists window drawings. NQU window handout p1 explains the plan-cut method for windows and shows multiple window plan variants. |

Residual limitation: `window` deliberately remains one phase-one symbol even though both sources show many window variants. Splitting variants is a future content-model decision, not an M5 verification requirement.
