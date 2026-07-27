import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { animate } from "animejs";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface BookPageProps {
  children: ReactNode;
  /** Set true to play the closing animation (logout), then call onClosed. */
  closing?: boolean;
  onClosed?: () => void;
}

/**
 * Runs one page-turn. Always hinges at the LEFT edge — that's physically
 * where this page's spine actually is (it sits to the right of LeftLeaf
 * across the book crease), so every turn pivots from the same real hinge;
 * only the rotateY sign/magnitude changes to distinguish forward motion
 * from "closing back." A shadow sweeps across in sync, darker on the edge
 * still lifted away from flat, fading as the page settles — the way a
 * real turning page shades itself.
 */
function flip(
  card: HTMLDivElement,
  shadow: HTMLDivElement | null,
  opts: { from: number; duration: number; delay?: number; ease: string; onComplete?: () => void },
) {
  const { from, duration, delay = 0, ease, onComplete } = opts;
  card.style.transformOrigin = "left center";
  card.style.transform = `rotateY(${from}deg)`;
  if (onComplete) {
    animate(card, { rotateY: [from, 0], opacity: [from === 0 ? 1 : 0.85, 1], duration, delay, ease, onComplete });
  } else {
    animate(card, { rotateY: [from, 0], opacity: [from === 0 ? 1 : 0.85, 1], duration, delay, ease });
  }
  if (shadow) {
    const sweepFromRight = from < 0; // negative rotation lifts the far (right) edge more
    shadow.style.background = `linear-gradient(to ${sweepFromRight ? "right" : "left"}, transparent 40%, rgba(0,0,0,0.4))`;
    animate(shadow, { opacity: [0.9, 0], duration, delay, ease });
  }
}

/**
 * The book's current (right-hand) page in the two-page spread — a cream
 * card resting on the permanently open red cover, next to LeftLeaf across
 * the book crease. Three moments, all real rotateY motion pivoting from
 * the spine edge, not just a flat tilt:
 *
 * 1. Mount (right after signup/login navigates into Layout): the page
 *    swings open, -100deg -> 0, as if the cover had just been opened —
 *    delayed to start after BookCover's own opening has landed.
 * 2. Every later navigation: a single flip, snapped to an edge-on angle
 *    pre-paint (useLayoutEffect, before the browser shows the already-
 *    swapped new route content) then released back to flat — forward nav
 *    (away from Ledger) swings in the same way as the opening (-100deg),
 *    navigating back to Ledger specifically uses the opposite, smaller
 *    swing (+70deg), reading as "closing back" to the first page. Repeats
 *    forever, not just for the first few uses — no page stack is
 *    rendered, always exactly one visible page (LeftLeaf shows a plain
 *    "something's been turned" indicator, not real stacked content).
 * 3. closing=true (logout): the page swings shut the same way as a
 *    "going home" turn (+70deg), fading out, then calls onClosed so
 *    Layout can navigate to /welcome once the animation has finished.
 */
export function BookPage({ children, closing, onClosed }: BookPageProps) {
  const location = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const isFirstNavRef = useRef(true);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (prefersReducedMotion()) {
      card.style.opacity = "1";
      card.style.transform = "none";
      return;
    }
    flip(card, shadowRef.current, { from: -100, duration: 550, delay: 350, ease: "outQuad" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (isFirstNavRef.current) {
      isFirstNavRef.current = false;
      return;
    }
    const card = cardRef.current;
    if (!card || prefersReducedMotion()) return;

    const goingHome = location.pathname === "/";
    flip(card, shadowRef.current, { from: goingHome ? 70 : -100, duration: 380, ease: "outQuad" });
    // Intentionally re-runs on every pathname change, forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!closing) return;
    const card = cardRef.current;
    if (!card || prefersReducedMotion()) {
      onClosed?.();
      return;
    }
    card.style.transformOrigin = "left center";
    animate(card, {
      rotateY: [0, 70],
      opacity: [1, 0],
      duration: 380,
      ease: "inQuad",
      onComplete: () => onClosed?.(),
    });
    if (shadowRef.current) {
      shadowRef.current.style.background = "linear-gradient(to left, transparent 40%, rgba(0,0,0,0.4))";
      animate(shadowRef.current, { opacity: [0, 0.9], duration: 380, ease: "inQuad" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  return (
    <div
      ref={cardRef}
      className="relative z-10 flex flex-1 flex-col rounded-lg bg-page-cream p-4 opacity-0 shadow-md"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div ref={shadowRef} className="pointer-events-none absolute inset-0 z-20 rounded-lg opacity-0" aria-hidden="true" />
      {children}
    </div>
  );
}
