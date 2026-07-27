import { useEffect, useRef } from "react";
import { animate } from "animejs";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const RESTING_TRANSFORM = "rotate(-1.4deg) translate(5px, 4px)";

interface BookCoverProps {
  closing?: boolean;
}

/**
 * The physical red cover — spans the full two-page spread (behind both
 * LeftLeaf and BookPage), visibly offset and slightly rotated so it reads
 * as its own object peeking out around the pages, not just a background
 * color fill. The book crease itself is a separate element between the two
 * leaves, not this cover's own edge.
 *
 * Swings open (rotateY) on mount — right after signup/login lands you in
 * Layout — then settles a couple degrees askew, like it fell open and came
 * to rest. Stays exactly there afterward (it doesn't reset on navigation;
 * only BookPage's cream page flips per-route). Swings shut again on
 * logout, in sync with BookPage's own closing motion.
 */
export function BookCover({ closing }: BookCoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.opacity = "1";
      el.style.transform = RESTING_TRANSFORM;
      return;
    }
    el.style.transform = "rotateY(-100deg)";
    animate(el, {
      rotateY: [-100, 0],
      opacity: [0, 1],
      duration: 650,
      ease: "outQuad",
      onComplete: () => {
        animate(el, {
          rotate: ["0deg", "-1.4deg"],
          translateX: [0, 5],
          translateY: [0, 4],
          duration: 220,
          ease: "outQuad",
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timed to finish around the same moment as BookPage's own 380ms closing
  // animation (100ms settle-undo + 280ms swing-shut), since Layout navigates
  // away as soon as BookPage reports it's done — this shouldn't run long.
  useEffect(() => {
    if (!closing) return;
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    animate(el, {
      rotate: ["-1.4deg", "0deg"],
      translateX: [5, 0],
      translateY: [4, 0],
      duration: 100,
      ease: "inQuad",
      onComplete: () => {
        animate(el, { rotateY: [0, 100], opacity: [1, 0], duration: 280, ease: "inQuad" });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 rounded-xl bg-khata-red opacity-0 shadow-xl"
      style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
      aria-hidden="true"
    />
  );
}
