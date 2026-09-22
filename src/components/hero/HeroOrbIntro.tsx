import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Autoplaying hero intro: a small "glass" orb grows to fill the screen and
 * the real hero content fades in over it, once, on mount — like a short
 * video, not tied to scroll. (An earlier version drove this off scroll
 * position instead, pinning the viewport for a 300vh section; the problem
 * with that wasn't the animation itself, it was that a first-time visitor
 * who doesn't scroll never sees the headline — the page just looks blank.
 * Autoplay fixes that directly, and needs less machinery: no sticky
 * pinning, no scroll listeners, no full-bleed breakout hack — this section
 * is just a normal h-screen block that scrolls away like any other.)
 *
 * The orb itself is plain CSS (layered radial-gradient + box-shadow, see
 * the .orb-* classes in styles.css) — not WebGL/three.js. An earlier
 * attempt at a similar visual via React Three Fiber was heavy and, per
 * direct feedback, ugly.
 */

const START_SIZE_PX = 140;
const GROW_DURATION_S = 2.4;
const CONTENT_DELAY_S = 1.1;
const CONTENT_DURATION_S = 1.3;
const EASE = [0.16, 1, 0.3, 1] as const;

function OrbAtmosphere() {
  return (
    <>
      {/* Same dot-grid texture used behind the rest of the page (see the
          fixed layer in index.tsx), but fixed-white here rather than
          theme-linked — this stage has its own palette independent of
          light/dark mode, and its own opaque background would otherwise
          hide the page's version of this texture completely. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute -left-10 -top-10 size-24 rounded-full bg-[rgba(50,70,90,0.25)] blur-2xl" />
      <div className="pointer-events-none absolute -right-10 top-5 size-24 rounded-full bg-[rgba(50,70,90,0.25)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-5 left-8 size-24 rounded-full bg-[rgba(50,70,90,0.25)] blur-2xl" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-white/15" />
    </>
  );
}

export function HeroOrbIntro({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [maxSize, setMaxSize] = React.useState(1200);

  React.useEffect(() => {
    const update = () => setMaxSize(Math.max(window.innerWidth, window.innerHeight) * 1.45);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scaleTarget = maxSize / START_SIZE_PX;

  return (
    <section
      className="relative left-1/2 flex h-screen w-screen -translate-x-1/2 items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #b4c0c5, #c3cdd1)" }}
    >
      <OrbAtmosphere />

      <motion.div
        initial={{ scale: reduceMotion ? scaleTarget : 1 }}
        animate={{ scale: scaleTarget }}
        transition={{ duration: reduceMotion ? 0 : GROW_DURATION_S, ease: EASE }}
        className="pointer-events-none absolute left-1/2 top-1/2 size-[140px] -translate-x-1/2 -translate-y-1/2 will-change-transform"
      >
        <div className="orb-surface relative size-full overflow-hidden rounded-full">
          <div className="orb-light" />
          <div className="orb-texture" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: reduceMotion ? 0 : CONTENT_DURATION_S,
          delay: reduceMotion ? 0 : CONTENT_DELAY_S,
          ease: EASE,
        }}
        className="pointer-events-auto relative z-10 w-[85%] max-w-2xl text-center"
      >
        {children}
      </motion.div>
    </section>
  );
}

export default HeroOrbIntro;
