import type { Metadata } from "next";
import type { FloorPlan } from "@/lib/floorplan/types";
import { absoluteSiteUrl, SITE_URL } from "@/lib/site-url";
import type { SymbolCategoryPage } from "@/lib/symbols/data";
import type { SymbolPageRecord, SymbolRecord } from "@/lib/symbols/types";
import {
  CATEGORY_LABELS,
  BRAND_IMAGE_ALT,
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
  SITE_NAME,
  SITE_IDENTITY,
  SITE_PURPOSE,
  SITE_TAGLINE,
  categoryPageDescription,
  categoryPageTitle,
  layoutPageDescription,
  layoutPageTitle,
  quizPageDescription,
  quizPageTitle,
  symbolPageDescription,
  symbolPageTitle,
} from "@/lib/ui/copy";

export const OG_IMAGE_PATH = "/brand/og-home.svg";
export const FAVICON_PATH = "/brand/favicon.svg";
export const APPLE_TOUCH_ICON_PATH = "/brand/apple-touch-icon.png";

export const siteMetadataBase = new URL(SITE_URL);

export const siteIcons: Metadata["icons"] = {
  icon: [{ url: FAVICON_PATH, type: "image/svg+xml" }],
  apple: [{ url: APPLE_TOUCH_ICON_PATH, type: "image/png", sizes: "180x180" }],
};

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const url = absoluteSiteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "zh_TW",
      images: [
        {
          url: absoluteSiteUrl(OG_IMAGE_PATH),
          width: 1200,
          height: 630,
          alt: BRAND_IMAGE_ALT,
        },
      ],
    },
  };
}

export const homeMetadata = () =>
  pageMetadata({
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
    path: "/",
  });

export const layoutMetadata = (floorplan: FloorPlan) =>
  pageMetadata({
    title: layoutPageTitle(floorplan.name),
    description: layoutPageDescription(floorplan.name),
    path: `/layouts/${floorplan.id}`,
  });

export const quizMetadata = (floorplan: FloorPlan): Metadata => ({
  ...pageMetadata({
    title: quizPageTitle(floorplan.name),
    description: quizPageDescription(floorplan.name),
    path: `/layouts/${floorplan.id}/quiz`,
  }),
  robots: { index: false },
});

export const symbolMetadata = (symbol: SymbolPageRecord) =>
  pageMetadata({
    title: symbolPageTitle(symbol.name),
    description: symbolPageDescription(symbol.plain_meaning),
    path: `/symbols/${symbol.id}`,
  });

export const categoryMetadata = (category: SymbolCategoryPage) => {
  const { zh } = CATEGORY_LABELS[category.id];
  return pageMetadata({
    title: categoryPageTitle(zh),
    description: categoryPageDescription(
      zh,
      category.symbols.map((symbol) => symbol.name),
    ),
    path: `/categories/${category.id}`,
  });
};

export function homeWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: HOME_PAGE_DESCRIPTION,
    url: absoluteSiteUrl("/"),
    inLanguage: "zh-Hant",
  };
}

export function symbolDefinedTermJsonLd(symbol: SymbolPageRecord) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: symbol.name,
    description: symbol.plain_meaning,
    url: absoluteSiteUrl(`/symbols/${symbol.id}`),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: SITE_NAME,
      url: absoluteSiteUrl("/"),
    },
  };
}

export function categoryCollectionJsonLd(category: SymbolCategoryPage) {
  const { zh } = CATEGORY_LABELS[category.id];
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: categoryPageTitle(zh),
    description: categoryPageDescription(
      zh,
      category.symbols.map((symbol) => symbol.name),
    ),
    url: absoluteSiteUrl(`/categories/${category.id}`),
    inLanguage: "zh-Hant",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: category.symbols.map((symbol, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteSiteUrl(`/symbols/${symbol.id}`),
        name: symbol.name,
        description: symbol.plain_meaning,
      })),
    },
  };
}

export function layoutLearningResourceJsonLd(
  floorplan: FloorPlan,
  symbols: Record<string, Pick<SymbolRecord, "name">>,
) {
  const taughtSymbols = [
    ...new Set(
      floorplan.hotspots
        .map((hotspot) => hotspot.symbol_id)
        .filter((symbolId): symbolId is string => symbolId !== null)
        .map((symbolId) => symbols[symbolId]?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: layoutPageTitle(floorplan.name),
    description: layoutPageDescription(floorplan.name),
    url: absoluteSiteUrl(`/layouts/${floorplan.id}`),
    inLanguage: "zh-Hant",
    isAccessibleForFree: true,
    educationalUse: "辨認建案平面圖符號",
    teaches: taughtSymbols,
  };
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const fallbackMetadata: Metadata = {
  metadataBase: siteMetadataBase,
  title: SITE_IDENTITY,
  description: `${SITE_IDENTITY}${SITE_PURPOSE}。${SITE_TAGLINE}`,
  icons: siteIcons,
};
