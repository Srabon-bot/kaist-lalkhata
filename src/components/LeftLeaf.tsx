import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { animate } from "animejs";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The flipped page — its own section, positioned by Layout in the space
 * immediately to the left of the main app section (same size as it, via
 * `right-full` positioning), not squeezed into a shared row with it. No
 * real content lives here, it's a visual sign that pages have been turned.
 * Empty (red cover showing through) on Ledger; a plain cream leaf
 * otherwise. Toggles every navigation, forever, hinged at its right edge
 * (facing the main section, the book's spine side).
 */
export function LeftLeaf() {
  const location = useLocation();
  const leafRef = useRef<HTMLDivElement>(null);
  const isFirstRef = useRef(true);

  useLayoutEffect(() => {
    const leaf = leafRef.current;
    if (!leaf) return;
    const goingHome = location.pathname === "/";

    if (isFirstRef.current) {
      isFirstRef.current = false;
      leaf.style.opacity = goingHome ? "0" : "1";
      return;
    }
    if (prefersReducedMotion()) {
      leaf.style.opacity = goingHome ? "0" : "1";
      return;
    }

    if (goingHome) {
      animate(leaf, { opacity: [1, 0], rotateY: [0, 60], duration: 380, ease: "inQuad" });
    } else {
      leaf.style.transform = "rotateY(60deg)";
      animate(leaf, { opacity: [0, 1], rotateY: [60, 0], duration: 380, ease: "outQuad" });
    }
    // Intentionally re-runs on every pathname change, forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      ref={leafRef}
      className="ruled-paper relative z-10 flex flex-1 flex-col overflow-hidden rounded-lg bg-page-cream p-4 opacity-0 shadow-md"
      style={{ transformOrigin: "right center", transformStyle: "preserve-3d" }}
      aria-hidden="true"
    >
      {/* A faint impression of a page that's been written on — same
          structure as BookPage's own header + rows, just muted to gray,
          since there's no real content to show here. */}
      <div className="h-5 w-2/3 rounded bg-ink/10" />
      <div className="mt-4 h-10 w-full rounded-lg bg-ink/5" />
      <div className="mt-3 space-y-2.5">
        <div className="h-3 w-full rounded bg-ink/5" />
        <div className="h-3 w-5/6 rounded bg-ink/5" />
        <div className="h-3 w-full rounded bg-ink/5" />
      </div>

      {/* A bound/stacked-paper edge, not a flat rectangle — thin striations
          like the visible edge of a pile of pages. */}
      <div
        className="absolute inset-y-0 left-0 w-2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(38,32,26,0.16) 0px, rgba(38,32,26,0.16) 1px, transparent 1px, transparent 5px)",
        }}
      />
    </div>
  );
}
