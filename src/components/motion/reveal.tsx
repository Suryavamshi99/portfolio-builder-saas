import * as React from "react";
import { motion, useReducedMotion, useMotionValue, useSpring, type Variants, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
  li: motion.li,
} as const;

type MotionTag = keyof typeof MOTION_TAGS;

interface RevealProps extends Omit<HTMLMotionProps<"div">, "as"> {
  delay?: number;
  y?: number;
  x?: number;
  /** Renders as this HTML tag instead of a div, e.g. "section". Preserves semantics/SEO. */
  as?: MotionTag;
  /**
   * Animate on mount instead of waiting for a viewport intersection. Use this
   * for anything guaranteed to already be in the initial viewport (hero
   * content) — whileInView's IntersectionObserver firing for an element
   * that's already in view at hydration time is a race, not a guarantee,
   * and was intermittently leaving hero content stuck at opacity 0.
   */
  immediate?: boolean;
}

/** Fades + slides content in as it enters the viewport. Motivated by: storytelling (content arrives in scroll order). */
export function Reveal({ children, delay = 0, y = 24, x = 0, as = "div", immediate = false, className, ...props }: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = MOTION_TAGS[as] as typeof motion.div;
  const animateProps = immediate
    ? { animate: { opacity: 1, y: 0, x: 0 } }
    : { whileInView: { opacity: 1, y: 0, x: 0 }, viewport: { once: true, amount: 0.3 } };
  return (
    <MotionTag
      initial={reduce ? false : { opacity: 0, y, x }}
      {...animateProps}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
      {...(props as HTMLMotionProps<"div">)}
    >
      {children}
    </MotionTag>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

interface StaggerGroupProps extends HTMLMotionProps<"div"> {
  /** Animate on mount instead of waiting for a viewport intersection — see Reveal's `immediate` doc. */
  immediate?: boolean;
}

/** Orchestrates child StaggerItems into a sequence. Motivated by: hierarchy (guides the eye through related items in order). */
export function StaggerGroup({ children, className, immediate = false, ...props }: StaggerGroupProps) {
  const reduce = useReducedMotion();
  const animateProps = immediate
    ? { animate: "show" }
    : { whileInView: "show", viewport: { once: true, amount: 0.2 } };
  return (
    <motion.div
      variants={staggerContainer}
      initial={reduce ? false : "hidden"}
      {...animateProps}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "as"> {
  /** Renders as this HTML tag instead of a div, e.g. "h1" for a hero headline. Preserves semantics/SEO. */
  as?: MotionTag;
}

export function StaggerItem({ as = "div", children, className, ...props }: StaggerItemProps) {
  const MotionTag = MOTION_TAGS[as] as typeof motion.div;
  return (
    <MotionTag variants={staggerItem} className={className} {...(props as HTMLMotionProps<"div">)}>
      {children}
    </MotionTag>
  );
}

interface MagneticProps {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}

/**
 * Pulls its child toward the cursor within a small radius. Reserved for the single
 * primary conversion CTA. Motivated by: feedback (reinforces the one action that matters).
 * Uses motion values, not React state, so it never re-renders on pointer move.
 */
export function Magnetic({ children, strength = 14, className }: MagneticProps) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left - rect.width / 2) / rect.width) * strength);
    y.set(((e.clientY - rect.top - rect.height / 2) / rect.height) * strength);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  );
}
