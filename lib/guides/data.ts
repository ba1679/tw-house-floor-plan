import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadFloorPlan } from "@/lib/floorplan/data";
import type { Annotation, FloorPlan } from "@/lib/floorplan/types";

export type GuideEvidence = {
  id: string;
  label: string;
  explanation: string;
  assumptions: string[];
};

export type GuideQuestion = {
  id: string;
  question: string;
  reason: string;
};

type TeachingFigureBase = {
  floorplan: FloorPlan;
  caption: string;
  description: string;
};

export type TeachingFigure = TeachingFigureBase & (
  | { view: "room"; roomId: string }
  | { view: "overall"; dimensions: Annotation[] }
);

export type GuideStep = {
  id: string;
  topic: string;
  title: string;
  layoutActionLabel: string;
  paragraphs: string[];
  figure: TeachingFigure;
  evidence: GuideEvidence[];
  questions: GuideQuestion[];
};

export type InterpretationOption = { id: string; label: string; reason: string };

export type InterpretationPracticeContent = {
  title: string;
  figure: TeachingFigure;
  conditions: string[];
  question: {
    id: string;
    prompt: string;
    correctOptionId: string;
    options: InterpretationOption[];
  };
};

type PracticeRecord = {
  title: string;
  figure: { floorplan_id: string; room_id: string; caption: string; description: string };
  conditions: string[];
  question: {
    id: string;
    prompt: string;
    correct_option_id: string;
    options: (InterpretationOption & { evidence_ids: string[] })[];
  };
};

export function loadFirstInterpretationPractice(): InterpretationPracticeContent {
  const record = JSON.parse(readFileSync(join(process.cwd(), "data/practice/first-interpretation-question.json"), "utf8")) as PracticeRecord;
  const floorplan = JSON.parse(readFileSync(join(process.cwd(), `data/practice/${record.figure.floorplan_id}.floorplan.json`), "utf8")) as FloorPlan;
  return {
    title: record.title,
    // 全片段尺寸屬於生成資料，不是房間局部已標示的條件。
    figure: {
      view: "room",
      floorplan: { ...floorplan, annotations: [] },
      roomId: record.figure.room_id,
      caption: record.figure.caption,
      description: record.figure.description,
    },
    conditions: record.conditions,
    question: {
      id: record.question.id,
      prompt: record.question.prompt,
      correctOptionId: record.question.correct_option_id,
      options: record.question.options.map(({ id, label, reason }) => ({ id, label, reason })),
    },
  };
}

type GuideRecord = {
  id: string;
  title: string;
  description: string;
  layout_id: string;
  checklist: {
    title: string;
    scope: string;
    questions: (GuideQuestion & { evidence_ids: string[] })[];
  };
  steps: {
    id: string;
    topic: string;
    title: string;
    layout_action_label: string;
    paragraphs: string[];
    evidence_ids: string[];
    question_ids?: string[];
    figure: { view: "room" | "overall"; room_id?: string; dimension_ids?: string[]; caption: string; description: string };
  }[];
  evidence: (GuideEvidence & {
    basis: { document: string; locator: string; reasoning: string };
    review: { date: string; report: string; notes: string };
  })[];
};

function readGuideRecord(): GuideRecord {
  return JSON.parse(
    readFileSync(join(process.cwd(), "data/guides/furniture-dimensions.json"), "utf8"),
  ) as GuideRecord;
}

function readerQuestion(question: GuideQuestion): GuideQuestion {
  return { id: question.id, question: question.question, reason: question.reason };
}

export function loadFurnitureDimensionsChecklist() {
  const { checklist } = readGuideRecord();
  return {
    title: checklist.title,
    scope: checklist.scope,
    questions: checklist.questions.map(readerQuestion),
  };
}

// 建置時投影；查證定位及工作備註留在內容資料，不傳給頁面或 client 元件。
export function loadFurnitureDimensionsGuide() {
  const record = readGuideRecord();
  const floorplan = loadFloorPlan(record.layout_id);

  return {
    title: record.title,
    description: record.description,
    layoutHref: `/layouts/${floorplan.id}`,
    checklistHref: "/guides/furniture-dimensions/questions",
    practiceHref: "/guides/furniture-dimensions/practice",
    steps: record.steps.map((step): GuideStep => ({
      id: step.id,
      topic: step.topic,
      title: step.title,
      layoutActionLabel: step.layout_action_label,
      paragraphs: step.paragraphs,
      figure: step.figure.view === "room"
        ? {
            view: "room",
            floorplan,
            roomId: step.figure.room_id!,
            caption: step.figure.caption,
            description: step.figure.description,
          }
        : {
            view: "overall",
            floorplan,
            dimensions: step.figure.dimension_ids!.map((id) => floorplan.annotations!.find((item) => item.id === id)!),
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
      questions: (step.question_ids ?? []).map((id) => readerQuestion(record.checklist.questions.find((item) => item.id === id)!)),
    })),
  };
}
