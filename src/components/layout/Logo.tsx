import * as React from "react";

import {
  AURORA_STOPS,
  CHEVRON_PATH,
  FOLIO_GRADIENT,
  FOLIO_PATH,
  LEAF_PATH,
  LOGO_VIEWBOX,
  SHIP_PATH,
} from "./logo-paths";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  /** Override the "ship" half of the wordmark (defaults to text-foreground, a
   *  theme token): needed when the logo sits over content with its own fixed
   *  palette, like a video background. It is applied as the text colour, and
   *  the outlines use currentColor. The "folio" half is always the Aurora gradient. */
  wordmarkClassName?: string;
}

// Heights are for the whole lockup box (the leaf fills about 70% of it).
const LOCKUP_HEIGHT = {
  sm: "h-8",
  md: "h-9 sm:h-10",
  lg: "h-14",
} as const;

const SYMBOL_SIZE = {
  sm: "size-7",
  md: "size-8 sm:size-9",
  lg: "size-12",
} as const;

/**
 * The Shipfolio logo: a leaf (a folio) with an upward chevron, in the Aurora
 * gradient, plus the outlined "shipfolio" wordmark. Artwork lives in
 * ./logo-paths and matches brand/logo/svg.
 */
export function Logo({
  className = "",
  showWordmark = true,
  size = "md",
  wordmarkClassName = "text-foreground",
}: LogoProps) {
  const uid = React.useId().replace(/:/g, "");
  const leafId = `${uid}-leaf`;
  const folioId = `${uid}-folio`;

  const leafGradient = (
    <linearGradient id={leafId} x1="0" y1="0" x2="1" y2="1">
      {AURORA_STOPS.map((s) => (
        <stop key={s.offset} offset={s.offset} stopColor={s.color} />
      ))}
    </linearGradient>
  );

  const symbol = (
    <>
      <path fill={`url(#${leafId})`} d={LEAF_PATH} />
      <path fill="#fff" d={CHEVRON_PATH} />
    </>
  );

  if (!showWordmark) {
    return (
      <span className={`inline-flex select-none ${className}`}>
        <svg
          viewBox="0 0 256 256"
          role="img"
          aria-label="Shipfolio"
          className={`${SYMBOL_SIZE[size]} shrink-0`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>{leafGradient}</defs>
          {symbol}
        </svg>
      </span>
    );
  }

  return (
    <span className={`inline-flex select-none ${wordmarkClassName} ${className}`}>
      <svg
        viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
        role="img"
        aria-label="Shipfolio"
        className={`${LOCKUP_HEIGHT[size]} w-auto shrink-0`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {leafGradient}
          <linearGradient
            id={folioId}
            gradientUnits="userSpaceOnUse"
            x1={FOLIO_GRADIENT.x1}
            y1={FOLIO_GRADIENT.y1}
            x2={FOLIO_GRADIENT.x2}
            y2={FOLIO_GRADIENT.y2}
          >
            {AURORA_STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
        {symbol}
        <path fill="currentColor" d={SHIP_PATH} />
        <path fill={`url(#${folioId})`} d={FOLIO_PATH} />
      </svg>
    </span>
  );
}

export default Logo;
