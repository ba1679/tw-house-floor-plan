import { InterpretationPractice } from "@/components/InterpretationPractice";
import { loadFirstInterpretationPractice } from "@/lib/guides/data";
import { pageMetadata } from "@/lib/site-metadata";

export function generateMetadata() {
  return pageMetadata({
    title: "判讀練習｜學看家具與尺寸｜拼厝",
    description: "換一張臥室局部圖，練習分辨圖面支持的結論與尚缺的尺寸資訊。",
    path: "/guides/furniture-dimensions/practice",
  });
}

export default function FirstInterpretationPracticePage() {
  return <InterpretationPractice practice={loadFirstInterpretationPractice()} />;
}
