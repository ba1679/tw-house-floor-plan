## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Code graph

`codegraph` 已經替這個 repo 建好符號索引。**查事實先問它，不要一開場就 grep + Read。**

- MCP：`.mcp.json` 已接好 `codegraph`，用 `codegraph_explore` 一次拿到「逐字原始碼 + 呼叫路徑 + 影響範圍」。
- CLI（手上沒有 MCP 時）：`codegraph explore "<問題>"`、`codegraph impact <symbol>`、`codegraph callers <symbol>`、`codegraph query <name>`。
- 索引跟著存檔自動更新（watcher，約 1 秒延遲）；覺得它落後就 `codegraph sync`。

**索引涵蓋**：`app/ components/ lib/ scripts/ tests/`，外加 `.claude/skills/floorplan-generator/scripts/*.py`。
產生 layout JSON 與 SVG 的那條線也在圖裡，所以「這張 SVG 從哪來」問得到答案（ADR 0002）。

**索引不涵蓋**：`data/**.json`（layout 與 hotspot 資料本身）、CSS Modules、`design/*.dc.html`、PRD 與 `docs/`。
這些照樣要自己讀——**不要因為 codegraph 查不到就當成不存在**。

**新 checkout／新 worktree 第一件事**：跑一次 `codegraph init`。`.codegraph/` 是本機產物，不跟著 git 過來。

## Workflow

規格 → 架構 → 實作 → 測試 → knowledge update，走 mattpocock skills。`/ask-matt` 是這套流程的地圖。

**前置**：`/setup-matt-pocock-skills` 已跑過（`docs/agents/` 就是它的產出），不要再跑。

**規格**：`平面圖教學網站-PRD-Phase1.md` 是**產品規格，不是 build 單位**。
`/to-spec` 每個里程碑跑一次（M2、M3…），不要把整份 PRD 一次餵進去；再 `/to-tickets` 切票到 `.scratch/<feature>/issues/`。

**架構**：這套 skill 沒有「架構設計」那支，靠兩者湊：
- `/codebase-design` 定模組邊界。PRD §10.1 的 `Layout Data → SVG Renderer → Hotspot Layer → Interaction State → Info Panel` 就是要落實的 seam。
- `/prototype` 回答紙上定不下來的互動問題（兩段式點擊、pan/zoom、熱區小面積優先）。prototype 留在 `prototype/<name>` branch 當 primary source，從實作票指過去。

**不要用**：
- `/wayfinder` —— 霧已經散了。PRD §10 定死 Next.js + TS + SSG，§10.1 定好分層。它是給看不見路的大工程用的。
- `/triage` 用在 `/to-tickets` 產出的票 —— triage 只給外來的 bug 回報與需求。

**實作／測試**：一張票一次 `/implement`，**票與票之間 `/clear`**。`/implement` 內部驅動 `/tdd`、結尾跑 `/code-review`。
`/diagnosing-bugs` 只留給難查的（間歇、回歸）；成因已知的直接開票。
PRD §10.1 的 build-time validation 清單是天然的 TDD 標的。

**Context 衛生**：`/grill-with-docs` → `/to-spec` → `/to-tickets` 要在同一個 context window 跑完，中間不 compact 不 clear，讓三者建立在同一份思考上。接近 smart zone（~150k）時在階段交界 `/compact`。

**Knowledge update**：詞彙進 `CONTEXT.md`、不可逆決策進 `docs/adr/`、`/research` 的引用報告進 `docs/reference/`。內容查證（M1 補交叉來源）用 `/research` 派背景 agent，與程式線並行。
