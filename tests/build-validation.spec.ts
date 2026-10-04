import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// scripts/validate_data.py 掛在 prebuild：非零退出即中斷建置，壞資料進不了正式站。
// 這裡不改動 repo 裡的資料——複製一份到 tmp 再改壞，才不會讓一次測試把真資料留在壞掉的狀態。
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "floorplan-validate-"));
  cpSync("data", join(dir, "data"), { recursive: true });
  cpSync("scripts", join(dir, "scripts"), { recursive: true });
  cpSync("docs/reference", join(dir, "docs/reference"), { recursive: true });
  return dir;
}

function runValidator(cwd: string): { code: number; output: string } {
  try {
    const output = execFileSync("python3", ["scripts/validate_data.py"], { cwd, encoding: "utf8" });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

const FLOORPLAN = "data/layouts/3b2l_standard.floorplan.json";
const SYMBOLS = "data/symbols.sample.json";
const FURNITURE_GUIDE = "data/guides/furniture-dimensions.json";

test("家具導讀參照不存在的房間時，建置失敗並指出參照", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.steps[0].figure.room_id = "room-missing";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));

  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("room-missing");
  expect(output).not.toContain("Traceback");
});

test("家具導讀主張缺少原始依據的定位時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.evidence[0].basis.locator = " ";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));

  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("master-bedroom-example");
  expect(output).toContain("locator");
});

test("家具導讀主張沒有有效依據參照時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.steps[0].evidence_ids = ["missing-evidence"];
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));

  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("missing-evidence");
  expect(output).not.toContain("Traceback");
});

test("教學圖誤用另一間房的家具參照時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.steps[0].figure.feature_ids[0] = "f-bed-2";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));

  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("f-bed-2");
  expect(output).not.toContain("Traceback");
});

test("使用空間步驟參照不存在的主臥門時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.steps[2].figure.feature_ids[1] = "door-missing";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));

  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("door-missing");
  expect(output).not.toContain("Traceback");
});

test("使用空間主張缺少查證定位時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.evidence[2].basis.locator = " ";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));

  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("master-bedroom-usable-space");
  expect(output).toContain("locator");
});

test("尺寸步驟參照不存在的標註時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.steps[1].figure.dimension_ids[0] = "dim-missing";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));
  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("dim-missing");
});

test("尺寸標註文字和端點距離不一致時，建置失敗", () => {
  const dir = sandbox();
  const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
  plan.annotations[0].label = "978 cm";
  writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));
  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("dim-overall-w");
  expect(output).toContain("978 cm");
});

test("尺寸標註端點沒有落在外牆牆心線範圍時，建置失敗", () => {
  const dir = sandbox();
  const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
  plan.annotations[0].end.x = 900;
  writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));
  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("dim-overall-w");
  expect(output).toContain("端點不是外牆牆心線範圍");
});

test("尺寸依據的查證報告不存在時，建置失敗", () => {
  const dir = sandbox();
  const guide = JSON.parse(readFileSync(join(dir, FURNITURE_GUIDE), "utf8"));
  guide.evidence[1].review.report = "docs/reference/not-found.md";
  writeFileSync(join(dir, FURNITURE_GUIDE), JSON.stringify(guide));
  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("not-found.md");
});

test("完整教學圖新增未納入導讀的尺寸標註時，建置失敗", () => {
  const dir = sandbox();
  const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
  plan.annotations.push({ id: "dim-unreviewed", type: "dimension", start: { x: 0, y: 100 }, end: { x: 100, y: 100 }, label: "100 cm" });
  writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));
  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("dim-unreviewed");
});

test("外牆牆心線偏離尺寸標註端點時，建置失敗", () => {
  const dir = sandbox();
  const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
  plan.walls.find((wall: { id: string }) => wall.id === "wall-001").start.y = 10;
  writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));
  const { code, output } = runValidator(dir);
  expect(code).not.toBe(0);
  expect(output).toContain("外牆牆心線");
});

test.describe("build 時的資料驗證", () => {
  test("資料完好時通過", () => {
    expect(runValidator(sandbox()).code).toBe(0);
  });

  test("hotspot 指向不存在的 symbol 時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.hotspots[0].symbol_id = "symbol_that_does_not_exist";
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("symbol_that_does_not_exist");
  });

  test("hotspot.id 重複時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.hotspots[1].id = plan.hotspots[0].id;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    expect(runValidator(dir).code).not.toBe(0);
  });

  // schema 明寫 symbol_id 可以是 null：「這個開口目前沒有對應的已查證符號（M1 未完成），
  // viewer 應略過」。M1 的內容查證與 M2 並行，不互相阻塞——查證還沒做完也要能先上線看圖。
  test("hotspot 的 symbol_id 為 null 時，建置照樣過", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.hotspots[0].symbol_id = null;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).toBe(0);
  });

  // 網址由檔名決定（data/layouts/<id>.floorplan.json → /layouts/<id>）。
  test("檔名與 floorplan.id 對不上時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.id = "3b2l_renamed";
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("3b2l_renamed");
  });
});

// 票 07 之後圖面由檢視器自己畫（docs/adr/0005），少一個欄位的後果從「圖面過期」
// 變成「build 死在 renderer 裡」——而那個 TypeError 不會說是哪一份檔案、哪一間房。
// 驗證因此接手把 renderer 會直接取用的東西擋在建置之前。
test.describe("floorplan 畫得出來", () => {
  test("房間少了 area_ping 時，建置失敗，而且說得出是哪一間", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    delete plan.rooms[0].area_ping;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain(plan.rooms[0].id);
    expect(output).toContain("area_ping");
  });

  // 檢視器靠 rotation 決定傢俱哪一邊是背面——馬桶的水箱、床的枕頭側、洗臉盆的牆線
  // 都畫在背面。認不得的角度不會報錯，只會把朝向畫反，所以擋在建置之前。
  test("傢俱的 rotation 不是 90 的倍數時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.furniture[0].rotation = 45;
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("rotation");
  });

  test("開口掛在不存在的牆上時，建置失敗", () => {
    const dir = sandbox();
    const plan = JSON.parse(readFileSync(join(dir, FLOORPLAN), "utf8"));
    plan.doors[0].wall_id = "wall-999";
    writeFileSync(join(dir, FLOORPLAN), JSON.stringify(plan));

    const { code, output } = runValidator(dir);
    expect(code).not.toBe(0);
    expect(output).toContain("wall-999");
  });
});

// M1（內容查證）與 M3 並行，而這條閘門是兩線唯一會互相弄壞的接觸面：
// REQUIRED_WHEN_VERIFIED 曾經含 caution，而 14 筆裡只有雨遮有 caution——M1 一把任何
// 其他符號翻成 verified，prebuild 就失敗、build 斷掉，連帶弄掛所有頁面測試。
test.describe("verified 的閘門", () => {
  type SourceRef = {
    doc?: string;
    clause?: string;
    url?: string;
    via?: string;
  };
  type MutableSymbol = {
    id: string;
    caution: string | null;
    source_tier: string;
    verification_status: string;
    verified_at: string | null;
    verified_by: string | null;
    source_refs: SourceRef[];
    [key: string]: unknown;
  };

  const SOURCE_REFS = {
    cnsWithVia: [
      {
        doc: "CNS 11567 建築製圖（類號 A1042）",
        clause: "p32 表 14 坐式馬桶",
        via: "室內設計裝修製圖規範 p32 表 14（該表註明引用 CNS11567；本專案未核對標準原文）",
      },
    ],
    cnsWithoutVia: [
      {
        doc: "CNS 11567 建築製圖（類號 A1042）",
        clause: "p32 表 14 坐式馬桶",
      },
    ],
    conventionTwoDocs: [
      {
        doc: "室內設計裝修製圖規範（中華民國室內設計裝修商業同業公會全國聯合會）",
        clause: "p23 表 8 單開門",
      },
      {
        doc: "住宅設計平面圖繪製手冊",
        clause: "門窗符號章節",
      },
    ],
    conventionOneDoc: [
      {
        doc: "室內設計裝修製圖規範（中華民國室內設計裝修商業同業公會全國聯合會）",
        clause: "p23 表 8 單開門",
      },
    ],
    conventionSameDocTwice: [
      {
        doc: "室內設計裝修製圖規範（中華民國室內設計裝修商業同業公會全國聯合會）",
        clause: "p23 表 8 單開門",
      },
      {
        doc: "室內設計裝修製圖規範（中華民國室內設計裝修商業同業公會全國聯合會）",
        clause: "p24 表 9 窗",
      },
    ],
    regulationComplete: [
      {
        doc: "建築技術規則建築設計施工編",
        clause: "第 162 條",
        url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162",
      },
    ],
    regulationNoUrl: [
      {
        doc: "建築技術規則建築設計施工編",
        clause: "第 162 條",
      },
    ],
    regulationNoLocator: [
      {
        doc: "建築技術規則建築設計施工編",
        url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162",
      },
    ],
  } satisfies Record<string, SourceRef[]>;

  function markVerified(symbol: MutableSymbol, tier: string, sourceRefs: SourceRef[]) {
    symbol.source_tier = tier;
    symbol.verification_status = "verified";
    symbol.verified_at = "2026-01-01";
    symbol.verified_by = "build-validation-fixture";
    symbol.source_refs = sourceRefs.map((ref) => ({ ...ref }));
  }

  // 不寫死符號 id：M1 哪天替牆補了 caution，寫死的那條測試會默默變成在測「有 caution 的
  // 符號能不能 verified」——還是綠的，但守的已經不是原來那件事。找不到就帶訊息失敗。
  // 只改記憶體裡的那份，寫檔留給呼叫的人，跟這個檔案其餘九條測試同一個手法。
  function verifiedWithoutCaution(
    dir: string,
    tier = "convention",
    sourceRefs: SourceRef[] = SOURCE_REFS.conventionTwoDocs,
  ) {
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8")) as { symbols: MutableSymbol[] };
    const symbol = data.symbols.find((s) => s.caution === null);
    expect(symbol, "資料裡找不到 caution 為 null 的符號，這個測試的前提已經不成立").toBeTruthy();
    const verifiedSymbol = symbol!;
    markVerified(verifiedSymbol, tier, sourceRefs);
    return { path, data, symbol: verifiedSymbol };
  }

  // caution（買房時要注意什麼）要的是法規來源，與畫法來源是兩條軸。綁在一起等於宣告
  // 「沒有法規注意事項的符號就不算查證完成」，而那會把查證率上限壓到 1/14 = 7%。
  test("caution 為 null 的符號填齊查證紀錄後標成 verified，建置照樣過", () => {
    const dir = sandbox();
    const { path, data } = verifiedWithoutCaution(dir);
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).toBe(0);
  });

  // 拆掉 caution 不是把整條檢查放掉：verified_at 與 verified_by 記錄這筆查證是誰在什麼時候
  // 做的，那正是查證這件事本身。訊息斷言釘的是各自那一句理由而不是共用的半句——只釘共用的
  // 那半句，等於允許訊息退回「這些欄位就是要填」，而那是 caution 當初混進來的原因。
  const WHY_EACH_FIELD_IS_REQUIRED = {
    verified_at: "缺了日期就看不出它有多舊",
    verified_by: "缺了人就沒有人能被問起它",
  };

  for (const [missing, why] of Object.entries(WHY_EACH_FIELD_IS_REQUIRED)) {
    test(`verified 卻缺 ${missing} 時，建置仍然失敗，而且說得出為什麼要有`, () => {
      const dir = sandbox();
      const { path, data, symbol } = verifiedWithoutCaution(dir);
      // 只蓋掉一個欄位，另一個留著填好的值——才證明是「缺這一個」擋下來的，
      // 不是兩個一起缺才擋。
      symbol[missing] = null;
      writeFileSync(path, JSON.stringify(data, null, 2));

      const { code, output } = runValidator(dir);
      expect(code, output).not.toBe(0);
      expect(output).toContain(symbol.id);
      expect(output).toContain(missing);
      expect(output).toContain(why);
    });
  }

  test("CNS verified 缺 via 時，建置失敗，而且說得出要揭露轉載鏈", () => {
    const dir = sandbox();
    const { path, data, symbol } = verifiedWithoutCaution(dir, "cns", SOURCE_REFS.cnsWithoutVia);
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol!.id);
    expect(output).toContain("cns");
    expect(output).toContain("via");
    expect(output).toContain("未核對標準原文");
  });

  test("convention verified 只有一份出處時，建置失敗，而且說得出要兩份不同文件", () => {
    const dir = sandbox();
    const { path, data, symbol } = verifiedWithoutCaution(dir, "convention", SOURCE_REFS.conventionOneDoc);
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol!.id);
    expect(output).toContain("convention");
    expect(output).toContain("兩筆 doc 不同的出處");
  });

  test("convention verified 兩筆同名文件時，建置失敗，而且說得出同名文件不算交叉來源", () => {
    const dir = sandbox();
    const { path, data, symbol } = verifiedWithoutCaution(dir, "convention", SOURCE_REFS.conventionSameDocTwice);
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol!.id);
    expect(output).toContain("convention");
    expect(output).toContain("同名文件不得冒充交叉來源");
  });

  test("regulation verified 缺 HTTPS URL 時，建置失敗，而且說得出官方性由查證者負責", () => {
    const dir = sandbox();
    const { path, data, symbol } = verifiedWithoutCaution(dir, "regulation", SOURCE_REFS.regulationNoUrl);
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol!.id);
    expect(output).toContain("regulation");
    expect(output).toContain("HTTPS URL");
    expect(output).toContain("官方性仍由查證者人工負責");
  });

  test("regulation verified 缺定位資訊時，建置失敗，而且說得出要能定位條文或頁碼", () => {
    const dir = sandbox();
    const { path, data, symbol } = verifiedWithoutCaution(dir, "regulation", SOURCE_REFS.regulationNoLocator);
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol!.id);
    expect(output).toContain("regulation");
    expect(output).toContain("定位資訊");
  });

  for (const [tier, sourceRefs] of [
    ["cns", SOURCE_REFS.cnsWithVia],
    ["convention", SOURCE_REFS.conventionTwoDocs],
    ["regulation", SOURCE_REFS.regulationComplete],
  ] as const) {
    test(`${tier} verified 的 tier-specific 查證條件齊全時，建置通過`, () => {
      const dir = sandbox();
      const { path, data } = verifiedWithoutCaution(dir, tier, sourceRefs);
      writeFileSync(path, JSON.stringify(data, null, 2));

      const { code, output } = runValidator(dir);
      expect(code, output).toBe(0);
    });
  }
});

test.describe("verification rate 發布 gate", () => {
  function writeSymbols(dir: string, mutate: (symbols: { verification_status: string }[]) => void) {
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8")) as {
      symbols: { verification_status: string }[];
    };
    mutate(data.symbols);
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  test("11/14 verified 時建置失敗，而且說出實際比例與至少需要 12 筆", () => {
    const dir = sandbox();
    writeSymbols(dir, (symbols) => {
      for (const symbol of symbols.slice(0, 3)) symbol.verification_status = "partial";
    });

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain("查證率 11/14 = 78.6% 未達 80% 上線門檻");
    expect(output).toContain("至少需要 12 筆 verified");
  });

  test("12/14 verified 時通過 80% gate，不用四捨五入偷渡", () => {
    const dir = sandbox();
    writeSymbols(dir, (symbols) => {
      for (const symbol of symbols.slice(0, 2)) symbol.verification_status = "partial";
    });

    const { code, output } = runValidator(dir);
    expect(code, output).toBe(0);
    expect(output).toContain("查證率 12/14 = 85.7%");
    expect(output).toContain("✓");
  });

  test("空 symbol 清單不能以 0/0 通過發布 gate", () => {
    const dir = sandbox();
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8"));
    data.symbols = [];
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain("沒有任何 symbol");
    expect(output).toContain("分母不可為 0");
  });
});

// 符號頁是搜尋落地頁（M3 票 02）：缺一個內容欄位的後果不是報錯，而是頁面上**靜默少一塊**
// ——標題少一半、圖形留白、徽章不見。那看起來像設計沒做完，不像資料出問題，
// 所以擋在建置之前，而且訊息要說得出少了它那一頁會缺什麼。
test.describe("符號的必填內容欄位", () => {
  const WHY_EACH_CONTENT_FIELD_IS_REQUIRED = {
    name: "沒有名字就沒有標題",
    plain_meaning: "讀者三秒內要的那句答案",
    svg_ref: "缺了它頁面上就是一塊空白",
    category: "哪一頁都不會列到它",
    source_tier: "這個答案硬到什麼程度",
  };

  for (const [missing, why] of Object.entries(WHY_EACH_CONTENT_FIELD_IS_REQUIRED)) {
    test(`符號少了 ${missing} 時，建置失敗，而且說得出少了它那一頁會缺什麼`, () => {
      const dir = sandbox();
      const path = join(dir, SYMBOLS);
      const data = JSON.parse(readFileSync(path, "utf8"));
      // 每一輪只清掉一個欄位，其餘留著——才證明是「缺這一個」擋下來的。
      const symbol = data.symbols[0];
      symbol[missing] = null;
      writeFileSync(path, JSON.stringify(data, null, 2));

      const { code, output } = runValidator(dir);
      expect(code, output).not.toBe(0);
      expect(output).toContain(symbol.id);
      expect(output).toContain(missing);
      expect(output).toContain(why);
    });
  }

  // 空字串與「沒有這個欄位」是同一件事：頁面上都是一塊空白。
  test("內容欄位是空字串時也擋下來", () => {
    const dir = sandbox();
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8"));
    data.symbols[0].plain_meaning = "";
    writeFileSync(path, JSON.stringify(data, null, 2));

    expect(runValidator(dir).code).not.toBe(0);
  });
});

// 分類頁的清單由資料算出：掃過所有 symbol 的 category，出現過的才產生頁面（M3 票 05）。
// 這條保證因此**刻意拆成兩半**，各自用看得到事實的語言把關：
//
//   Python（下面第一條）    ── 資料裡的分類合不合法
//   TypeScript（下面第二條）── 合法的分類有沒有中文名
//   兩份 id 清單（第三條）── 上面兩半講的是不是同一組分類
//
// 為什麼不寫成一條「每個分類都要有中文名」：中文名在 `lib/ui/copy.ts` 的 `CATEGORY_LABELS`，
// 那是 TypeScript，而掛在 prebuild 的驗證器是 Python——它讀不到那個常數。寫成一條就得在
// Python 裡再抄一份中文名，變成第二份會跟 UI 分岔的清單，正是這張票要防的事。
// 中文名因此只有一份。兩半之間仍然手工同步的，只剩合法分類的 id 清單本身——第三條比對它。
test.describe("分類：兩半各自把關", () => {
  test("category 是 v0.4 砍掉的設備類時，建置失敗，而且說得出那不是打錯字", () => {
    const dir = sandbox();
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8"));
    const symbol = data.symbols[0];
    symbol.category = "plumbing_electric";
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol.id);
    expect(output).toContain("plumbing_electric");
    // 訊息要說得出這是**範圍決定**而不是打錯字——不然下一個撞到它的人會以為是清單漏打了，
    // 把設備類加回去。釘的是那一句理由本身，不只是版本號：只釘「v0.4」的話，
    // 訊息退回「category 非法值」這幾個字，這條測試照樣是綠的。
    expect(output).toContain("v0.4");
    expect(output).toContain("不是打錯字");
  });

  /**
   * TypeScript 那一半：把 `CATEGORY_LABELS` 少一個 key 之後，`tsc --noEmit` 真的會紅。
   *
   * 沿用上面那套 sandbox 的手法（複製到 tmp、改壞、跑檢查、斷言非零退出），只是這次複製的
   * 是 TS 原始碼而不是資料。`node_modules` 用 symlink：沙盒要的只是 `next` 與 `react` 的型別，
   * 為了它們把整個 `node_modules` 複製進 tmp，才是這條測試真正會慢的地方。
   */
  function typecheckSandbox() {
    const dir = mkdtempSync(join(tmpdir(), "floorplan-typecheck-"));
    for (const entry of ["app", "components", "lib", "tsconfig.json"]) {
      cpSync(entry, join(dir, entry), { recursive: true });
    }
    symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
    // `next-env.d.ts` 自己寫一份最小的，不照抄 repo 那一份：那一份還 import 了
    // `.next/types/*`（`next build` 產生的路由型別），沙盒裡沒有建置產物，照抄會讓 tsc
    // 死在找不到那兩個檔案上——而那不是這條測試要問的事。這兩行帶進來的是 CSS Modules
    // 與 next 的全域型別宣告，少了它們 `import styles from "./page.module.css"` 會先報錯。
    writeFileSync(
      join(dir, "next-env.d.ts"),
      '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
    );
    return dir;
  }

  /** 跑 repo 自己那一份 tsc（`npm run typecheck` 跑的同一支），cwd 在沙盒裡。 */
  function runTypecheck(cwd: string): { code: number; output: string } {
    const tsc = resolve("node_modules/typescript/bin/tsc");
    try {
      return { code: 0, output: execFileSync(process.execPath, [tsc, "--noEmit"], { cwd, encoding: "utf8" }) };
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      return { code: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
    }
  }

  test("文案常數少一個分類的中文名時，typecheck 失敗，而且說得出少了哪一類", () => {
    const dir = typecheckSandbox();

    // 先證明沒動過的沙盒是綠的。少了這一步，下面那個「失敗」可能只是沙盒自己搭壞了，
    // 而這條測試會在 `CATEGORY_LABELS` 的保證早就沒了之後繼續保持綠色。
    const clean = runTypecheck(dir);
    expect(clean.code, `沙盒沒動過就已經不過，這條測試證明不了任何事：\n${clean.output}`).toBe(0);

    // 不寫死拿哪一類開刀：從資料算出站上有哪些分類，取第一個。寫死的那一天資料改了，
    // 這條測試會默默變成在守一個不存在的分類。
    const symbols: { category: string }[] = JSON.parse(readFileSync(SYMBOLS, "utf8")).symbols;
    const category = [...new Set(symbols.map((s) => s.category))][0];

    const path = join(dir, "lib/ui/copy.ts");
    const before = readFileSync(path, "utf8");
    const after = before.replace(new RegExp(`\\n[ \\t]*${category}:[^\\n]*\\n`), "\n");
    expect(after, `lib/ui/copy.ts 裡找不到 ${category} 的中文名那一行`).not.toBe(before);
    expect(after.split("\n")).toHaveLength(before.split("\n").length - 1);
    writeFileSync(path, after);

    const { code, output } = runTypecheck(dir);
    expect(code, output).not.toBe(0);
    // 訊息要點名那一類：只說「型別不合」的話，下一個人得自己去比對哪一個 key 不見了。
    expect(output).toContain(category);
    expect(output).toContain("copy.ts");
  });

  // 兩半之間仍然手工同步的那一份：合法分類的 id 清單。Python 那一份（VALID_CATEGORIES）決定資料
  // 可以用哪些分類，TypeScript 那一份（SymbolCategory）決定哪些分類必須有中文名。只放寬 Python
  // 那一邊、再有符號用上那一類，tsc 照樣是綠的（資料是 `as` 進去的），建置會死在分類頁取中文名
  // 的那一行——一個不說是誰跟誰分岔的 TypeError。這條把它換成一句說得清楚的話。
  test("驗證器的合法分類與 TypeScript 的 SymbolCategory 是同一份清單", () => {
    const python = /^VALID_CATEGORIES = \{([^}]*)\}/m.exec(
      readFileSync("scripts/validate_data.py", "utf8"),
    );
    const typescript = /^export type SymbolCategory = ([^;]+);/m.exec(
      readFileSync("lib/symbols/types.ts", "utf8"),
    );
    // 找不到那一行時帶訊息失敗：兩邊都比對成空清單的話，這條會是一個永遠綠的斷言。
    expect(python, "scripts/validate_data.py 裡找不到 VALID_CATEGORIES 那一行").toBeTruthy();
    expect(typescript, "lib/symbols/types.ts 裡找不到 SymbolCategory 那一行").toBeTruthy();

    const ids = (source: string) => [...source.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(ids(python![1]).length).toBeGreaterThan(0);
    expect(
      ids(typescript![1]),
      "lib/symbols/types.ts 的 SymbolCategory 與 scripts/validate_data.py 的 VALID_CATEGORIES 分岔了——改一邊要改另一邊",
    ).toEqual(ids(python![1]));
  });
});

// 符號頁底部的轉換點由 related_layouts 決定帶讀者去哪張圖（M3 票 08）。對不到的 id 是一顆通往 404 的
// 按鈕——而那顆按鈕是把搜尋流量帶進平面圖的唯一入口（PRD §6.2.1），壞掉的那一天頁面看起來完全正常。
test.describe("related_layouts", () => {
  test("有一個 id 對不到任何格局時，建置失敗，而且說得出是哪個符號、哪個 id", () => {
    const dir = sandbox();
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8"));
    // 留著原本對得到的那一個，只多塞一個對不到的：才證明擋下來的是「這一個」，不是「清單不能多一筆」。
    const symbol = data.symbols[0];
    symbol.related_layouts = [...symbol.related_layouts, "layout_that_does_not_exist"];
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol.id);
    expect(output).toContain("layout_that_does_not_exist");
    expect(output).toContain("通往 404");
  });

  // 空的 related_layouts 不會讓任何東西報錯，只會讓那一頁**安靜地沒有按鈕**——而那顆按鈕是把搜尋流量帶進平面圖的
  // 唯一入口。所以它是必填（規格主人 2026-09-13 的決定 D3）。連樑都填得出值：它在圖上沒有熱區，我們照樣帶讀者去看。
  test("related_layouts 是空陣列時，建置失敗，而且說得出那一頁會少什麼", () => {
    const dir = sandbox();
    const path = join(dir, SYMBOLS);
    const data = JSON.parse(readFileSync(path, "utf8"));
    const symbol = data.symbols[0];
    symbol.related_layouts = [];
    writeFileSync(path, JSON.stringify(data, null, 2));

    const { code, output } = runValidator(dir);
    expect(code, output).not.toBe(0);
    expect(output).toContain(symbol.id);
    expect(output).toContain("related_layouts");
    expect(output).toContain("安靜地沒有按鈕");
  });
});
