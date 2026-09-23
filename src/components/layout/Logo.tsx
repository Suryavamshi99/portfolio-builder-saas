import * as React from "react";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  /** Override the "Ship" wordmark's color (defaults to text-foreground, a
   *  theme token) — needed when the logo sits over content with its own
   *  fixed palette, like a video background, rather than the site's own
   *  light/dark background. The "folio" half always stays text-accent. */
  wordmarkClassName?: string;
}

export function Logo({ className = "", showWordmark = true, size = "md", wordmarkClassName = "text-foreground" }: LogoProps) {
  const iconSizes = {
    sm: "size-6",
    md: "size-7 sm:size-8",
    lg: "size-10",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg sm:text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={`inline-flex items-center gap-2.5 font-bold tracking-tight select-none ${className}`}>
      {/* Modern geometric Shipfolio icon mark */}
      <div
        className={`relative flex ${iconSizes[size]} items-center justify-center rounded-xl bg-gradient-to-tr from-[#2A46D8] via-[#3457E8] to-[#5B8CFF] text-white shadow-md shadow-[#3457E8]/25 ring-1 ring-white/20 transition-transform group-hover:scale-105`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-4/5 text-white"
        >
          {/* Back folder / card sheet */}
          <rect
            x="6"
            y="6"
            width="20"
            height="20"
            rx="4"
            fill="currentColor"
            fillOpacity="0.3"
            transform="rotate(-4 16 16)"
          />
          {/* Front interactive folio card */}
          <rect
            x="7"
            y="7"
            width="18"
            height="18"
            rx="3.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.2"
          />
          {/* AI Sparkle / Star Node */}
          <path
            d="M16 10.5C16.3 12.8 17.2 13.7 19.5 14C17.2 14.3 16.3 15.2 16 17.5C15.7 15.2 14.8 14.3 12.5 14C14.8 13.7 15.7 12.8 16 10.5Z"
            fill="#ffffff"
          />
          {/* Dynamic dot indicator */}
          <circle cx="21" cy="21" r="2" fill="#34d399" />
        </svg>
      </div>

      {showWordmark && (
        <span className={`font-extrabold tracking-tight ${wordmarkClassName} ${textSizes[size]}`}>
          <span>Ship</span>
          <span className="text-accent">folio</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
