import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import CinematicHeroVideo from "@/components/cinematic/CinematicHeroVideo";

/**
 * Autoplaying hero intro: a cinematic background video (generated with
 * Gemini/Veo via the gemini-cinematic-web skill — glass shards converging
 * into a single lit sphere, matching the site's deep-azure/amber palette)
 * plays behind the hero, and the real hero content fades in over it, once,
 * on mount. Not tied to scroll — a first-time visitor who never scrolls
 * still sees the headline immediately.
 *
 * CinematicHeroVideo itself handles LCP/CLS/perf: it server-renders a
 * poster image first (the actual LCP element), only mounts <video> after
 * load+idle, and skips the video payload entirely for reduced-motion,
 * Save-Data or 2G. See src/components/cinematic/CinematicHeroVideo.tsx.
 *
 * This replaced an earlier plain-CSS "glass orb" (layered radial-gradient
 * + box-shadow growing to fill the screen) that played the same beat with
 * no video — kept as the deliberately simple predecessor before the
 * cinematic video was generated from the site's own brand/copy.
 */

const CONTENT_DELAY_S = 0.6;
const CONTENT_DURATION_S = 1.3;
const EASE = [0.16, 1, 0.3, 1] as const;

function DotGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] opacity-[0.12]"
      style={{
        backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}

export function HeroOrbIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className={[
        "relative isolate left-1/2 flex h-screen w-screen -translate-x-1/2 items-center justify-center overflow-hidden bg-[#06101c]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* scrimColor is explicit, not left to the component's default
          `var(--background)` fallback: this project stores that token as a
          bare "R G B" triplet for `rgb(var(--background))` use elsewhere,
          which color-mix() can't consume directly — the scrim's
          background-image silently computed to `none` without this. This
          hero also has its own fixed dark palette independent of the site's
          light/dark toggle (see the file comment above), so the scrim
          should match that, not the theme-dependent site background. */}
      <CinematicHeroVideo scrim="center" scrimOpacity={0.7} scrimColor="#06101c" />
      <DotGrid />

      <motion.div
        initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: reduceMotion ? 0 : CONTENT_DURATION_S,
          delay: reduceMotion ? 0 : CONTENT_DELAY_S,
          ease: EASE,
        }}
        className="pointer-events-auto relative z-10 w-[90%] max-w-5xl text-center"
      >
        {children}
      </motion.div>
    </section>
  );
}

export default HeroOrbIntro;
