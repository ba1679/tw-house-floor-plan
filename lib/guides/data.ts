import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadFloorPlan } from "@/lib/floorplan/data";
import type { FloorPlan } from "@/lib/floorplan/types";

export type GuideEvidence = {
  id: string;
  label: string;
  explanation: string;
  assumptions: string[];
};

export type TeachingFigure = {
  floorplan: FloorPlan;
  roomId: string;
  caption: string;
  description: string;
};

export type GuideStep = {
  id: string;
  topic: string;
  title: string;
  paragraphs: string[];
  figure: TeachingFigure;
  evidence: GuideEvidence[];
};

type GuideRecord = {
  id: string;
  title: string;
  description: string;
  layout_id: string;
  steps: {
    id: string;
    topic: string;
    title: string;
    paragraphs: string[];
    evidence_ids: string[];
    figure: { room_id: string; caption: string; description: string };
  }[];
  evidence: (GuideEvidence & {
    basis: { document: string; locator: string; reasoning: string };
    review: { date: string; report: string; notes: string };
  })[];
};

// 建置時投影；查證定位及工作備註留在內容資料，不傳給頁面或 client 元件。
export function loadFurnitureDimensionsGuide() {
  const record = JSON.parse(
    readFileSync(join(process.cwd(), "data/guides/furniture-dimensions.json"), "utf8"),
  ) as GuideRecord;
  const floorplan = loadFloorPlan(record.layout_id);

  return {
    title: record.title,
    description: record.description,
    layoutHref: `/layouts/${floorplan.id}`,
    steps: record.steps.map((step): GuideStep => ({
      id: step.id,
      topic: step.topic,
      title: step.title,
      paragraphs: step.paragraphs,
      figure: {
        floorplan,
        roomId: step.figure.room_id,
        caption: step.figure.caption,
        description: step.figure.description,
      },
      evidence: step.evidence_ids.map((id) => {
        const evidence = record.evidence.find((item) => item.id === id)!;
        return {
          id: evidence.id,
          label: evidence.label,
          explanation: evidence.explanation,
          assumptions: evidence.assumptions,
        };
      }),
    })),
  };
}
