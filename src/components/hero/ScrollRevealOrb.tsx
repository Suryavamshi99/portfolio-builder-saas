import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/**
 * Scroll-jacked hero: pin the viewport for a tall (300vh) section while a
 * small orb grows to fill the screen, then fade the real hero content in
 * once it's dominant. Ported from a plain CSS/vanilla-JS reference — same
 * visual mechanics, driven here by motion/react's scroll utilities instead
 * of a manual scroll listener + getBoundingClientRect, since that's already
 * the idiom used elsewhere in this codebase (see Reveal/StaggerGroup).
 *
 * This is deliberately NOT WebGL/three.js — an earlier attempt at a similar
 * "glass orb" hero visual via React Three Fiber turned out both heavy and,
 * per direct feedback, ugly. This is a layered radial-gradient + box-shadow
 * sphere (see the .orb-* classes in styles.css); the whole thing is a few
 * KB of CSS, no 3D engine, no lazy-loaded chunk.
 */

const START_SIZE_PX = 140;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function OrbAtmosphere() {
  return (
    <>
      <div className="pointer-events-none absolute -left-10 -top-10 size-24 rounded-full bg-[rgba(50,70,90,0.25)] blur-2xl" />
      <div className="pointer-events-none absolute -right-10 top-5 size-24 rounded-full bg-[rgba(50,70,90,0.25)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-5 left-8 size-24 rounded-full bg-[rgba(50,70,90,0.25)] blur-2xl" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-white/15" />
    </>
  );
}

function Orb({ scale }: { scale: ReturnType<typeof useTransform<number, number>> }) {
  return (
    <motion.div
      style={{ scale }}
      className="absolute left-1/2 top-1/2 size-[140px] -translate-x-1/2 -translate-y-1/2 will-change-transform"
    >
      <div className="orb-surface relative size-full overflow-hidden rounded-full">
        <div className="orb-light" />
        <div className="orb-texture" />
      </div>
    </motion.div>
  );
}

export function ScrollRevealOrb({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const [maxSize, setMaxSize] = React.useState(1200);

  React.useEffect(() => {
    const update = () => setMaxSize(Math.max(window.innerWidth, window.innerHeight) * 1.45);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, maxSize / START_SIZE_PX]);
  const contentOpacity = useTransform(scrollYProgress, (v) => smoothstep(0.42, 1, v));
  const contentScale = useTransform(contentOpacity, (o) => 0.75 + o * 0.25);

  if (reduceMotion) {
    // Skip the scroll-jacked reveal entirely for reduced-motion users —
    // not just a frozen mid-state. The content renders at rest, in normal
    // document flow, orb included but static.
    return (
      <section
        className="relative left-1/2 flex min-h-[70vh] w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
        style={{ background: "linear-gradient(135deg, #b4c0c5, #c3cdd1)" }}
      >
        <OrbAtmosphere />
        <div className="orb-surface relative mb-10 size-[140px] overflow-hidden rounded-full">
          <div className="orb-light" />
          <div className="orb-texture" />
        </div>
        <div className="relative z-10 w-full max-w-2xl">{children}</div>
      </section>
    );
  }

  return (
    // Full-bleed breakout: this renders inside the page's normal centered
    // max-w container, but the stage needs to span the actual viewport
    // width regardless of that constraint.
    <section
      ref={sectionRef}
      className="relative left-1/2 w-screen -translate-x-1/2"
      style={{ height: "300vh" }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: "linear-gradient(135deg, #b4c0c5, #c3cdd1)" }}
      >
        <OrbAtmosphere />
        <Orb scale={scale} />
        <motion.div
          style={{ opacity: contentOpacity, scale: contentScale }}
          className="pointer-events-auto absolute left-1/2 top-1/2 w-[85%] max-w-2xl -translate-x-1/2 -translate-y-1/2 text-center"
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}

export default ScrollRevealOrb;
