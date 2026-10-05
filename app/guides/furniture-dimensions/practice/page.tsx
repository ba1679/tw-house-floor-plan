import { InterpretationPractice } from "@/components/InterpretationPractice";
import { loadInterpretationPractice } from "@/lib/guides/data";
import { pageMetadata } from "@/lib/site-metadata";

export function generateMetadata() {
  return pageMetadata({
    title: "判讀練習｜學看家具與尺寸｜拼厝",
    description: "換一張臥室局部圖，練習分辨有依據的結論、尚缺的資訊與有效追問。",
    path: "/guides/furniture-dimensions/practice",
  });
}

export default function InterpretationPracticePage() {
  return <InterpretationPractice practice={loadInterpretationPractice()} />;
}
