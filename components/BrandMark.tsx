import { useId } from "react";
import { SITE_NAME } from "@/lib/ui/copy";

type BrandMarkProps = {
  variant: "full" | "compact";
  surface?: "light" | "dark";
  className?: string;
  width?: number;
  height?: number;
};

// 完整輪廓依使用者提供的 design/reference/pin-chhu-logo.png 重畫，僅採圖形。
const island = "M550 50h26l20 20h17v68l-13 18-21 107-43 69v55h-35v-35l-44-26-37-46v-59l79-151h51z";

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
      viewBox={compact ? "0 0 32 32" : "410 40 213 357"}
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
          <g clipPath={`url(#${clipId})`}>
            <path d={island} fill={wood} />
            <path d="M420 102h130v54H420z" fill={cream} />
            <path d="M550 114h63v42h-63zM455 156h80v65h-80zM501 221h34v65h-34zM455 286h46v67l-46-27z" fill={brick} />
            <path d="M535 156h80v91h-80zM419 221h82v65h-82z" fill={concrete} />
            <path d="M535 247h50v39h-50zM420 286h35v40z" fill={cream} />
            <g fill="none" stroke={outline} strokeWidth="3.4" strokeLinejoin="miter">
              <path d="M550 50v106M481 102h69M502 102v11m0 19v24M535 103v26h15M550 114h37m20 0h6" />
              <path d="M455 156h146M455 156v22m0 19v24M535 156v65H420M429 221v51h45v-51M501 221v131" />
              <path d="M423 286h142M455 286v38M535 286v-39h47M565 247v-58h29" />
            </g>
            <path
              d="M569 190l19 15-20 15 14 12-14 15M590 190l-22 15 18 15-18 14 12 13M565 204h26M565 219h23M565 234h20"
              fill="none" stroke={outline} strokeWidth="1.7"
            />
          </g>
          <path d={island} fill="none" stroke={outline} strokeWidth="4.4" strokeLinejoin="miter" />
        </>
      )}
    </svg>
  );
}
