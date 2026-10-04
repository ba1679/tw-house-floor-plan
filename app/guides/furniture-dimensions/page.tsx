import { GuideReader } from "@/components/GuideReader";
import { loadFurnitureDimensionsGuide } from "@/lib/guides/data";
import { pageMetadata } from "@/lib/site-metadata";

export function generateMetadata() {
  const guide = loadFurnitureDimensionsGuide();
  return pageMetadata({
    title: `${guide.title}｜拼厝`,
    description: guide.description,
    path: "/guides/furniture-dimensions",
  });
}

export default function FurnitureDimensionsPage() {
  const guide = loadFurnitureDimensionsGuide();
  return <GuideReader guide={guide} />;
}
