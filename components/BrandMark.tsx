import { useId } from "react";
import { SITE_NAME } from "@/lib/ui/copy";

type BrandMarkProps = {
  variant: "full" | "compact";
  surface?: "light" | "dark";
  className?: string;
  width?: number;
  height?: number;
};

// 完整輪廓採定案原型 A（prototype/pin-chhu @ 843bf77）。
const island = "M56 4h20l8 9v13l8 8-3 17-9 13-1 21-10 18-4 20v32H45v-31l-12-13-14-15-5-16 3-19 10-18 11-17 3-20 8-16V8h7z";

/** 唯一品牌幾何來源：頁面直接呈現，favicon／app icon／OG 由同一元件產生。 */
export function BrandMark({ variant, surface = "light", className, width, height }: BrandMarkProps) {
  const clipId = useId();
  const dark = surface === "dark";
  const outline = dark ? "var(--brand-cream)" : "var(--brand-outline)";
  const cream = "var(--brand-cream)";
  const wood = dark ? "var(--brand-wood-on-dark)" : "var(--brand-wood)";
  const brick = dark ? "var(--brand-brick-on-dark)" : "var(--brand-brick)";
  const concrete = dark ? "var(--brand-concrete-on-dark)" : "var(--brand-concrete)";
  // 小尺寸不硬縮島嶼細節；已知輸出尺寸不足時也退回 compact。
  const compact = variant === "compact" || (width !== undefined && width < 96) || (height !== undefined && height < 144);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={width}
      height={height}
      viewBox={compact ? "0 0 32 32" : "10 -10 86 170"}
      role="img"
      aria-label={SITE_NAME}
    >
      {compact ? (
        // 從同一套矩形拼塊提煉：三格、錯落拼接與底部開口，16px 仍有完整的線。
        <g stroke={outline} strokeWidth="2" strokeLinejoin="miter">
          <path d="M3 3h14v12H3z" fill={wood} />
          <path d="M17 3h12v22H17z" fill={cream} />
          <path d="M3 15h14v14H3z" fill={brick} />
          <path d="M17 25h12M17 25v4" fill="none" />
        </g>
      ) : (
        <>
          <defs><clipPath id={clipId}><path d={island} /></clipPath></defs>
          <g clipPath={`url(#${clipId})`} stroke={outline} strokeWidth="2.6" strokeLinejoin="round">
            <rect x="6" y="3" width="33" height="30" fill={wood} />
            <rect x="39" y="3" width="28" height="30" fill={cream} />
            <rect x="67" y="3" width="33" height="30" fill={wood} />
            <rect x="6" y="33" width="31" height="31" fill={concrete} />
            <rect x="37" y="33" width="34" height="31" fill={brick} />
            <rect x="71" y="33" width="29" height="31" fill={cream} />
            <rect x="6" y="64" width="28" height="34" fill={cream} />
            <rect x="34" y="64" width="34" height="34" fill={wood} />
            <rect x="68" y="64" width="32" height="34" fill={brick} />
            <rect x="7" y="98" width="34" height="31" fill={brick} />
            <rect x="41" y="98" width="27" height="31" fill={concrete} />
            <rect x="68" y="98" width="32" height="31" fill={cream} />
            <rect x="7" y="129" width="35" height="40" fill={cream} />
            <rect x="42" y="129" width="28" height="40" fill={brick} />
            <rect x="70" y="129" width="30" height="40" fill={wood} />
            <path d="M70 67h17v27H70zM74 70h9v7h-9zM74 80h9v10h-9z" fill="none" />
          </g>
          <path d={island} fill="none" stroke={outline} strokeWidth="3.5" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
