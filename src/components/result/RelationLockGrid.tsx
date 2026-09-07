"use client";

import { useEffect, useRef, useState } from "react";

type RelationLockItem = {
  label: string;
  color: string;
};

function LockGlyph() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function RelationLockGrid({
  items,
  id,
  desktopColumns = 3,
}: {
  items: RelationLockItem[];
  id?: string;
  desktopColumns?: 3 | 4;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [shouldDraw, setShouldDraw] = useState(false);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let hasStarted = false;
    let observer: IntersectionObserver | null = null;

    const stopWatching = () => {
      observer?.disconnect();
      window.removeEventListener("scroll", checkViewport);
      window.removeEventListener("resize", checkViewport);
    };

    const startDrawing = () => {
      if (hasStarted) return;
      hasStarted = true;
      setShouldDraw(true);
      stopWatching();
    };

    const checkViewport = () => {
      const rect = grid.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      if (visibleHeight >= Math.min(rect.height * 0.35, 120)) {
        startDrawing();
      }
    };

    window.addEventListener("scroll", checkViewport, { passive: true });
    window.addEventListener("resize", checkViewport, { passive: true });

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) startDrawing();
        },
        { threshold: 0.35 },
      );
      observer.observe(grid);
    }

    // URLハッシュなどで初期表示時から円が画面内にあるケースも拾う。
    const frame = requestAnimationFrame(checkViewport);

    return () => {
      cancelAnimationFrame(frame);
      stopWatching();
    };
  }, []);

  return (
    <div
      ref={gridRef}
      id={id}
      className={`mb-8 grid grid-cols-2 gap-x-2 gap-y-6 ${
        desktopColumns === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-2.5">
          <span className="relative flex h-[108px] w-[108px] items-center justify-center rounded-full bg-white text-[#B9BCCF]">
            <svg
              aria-hidden="true"
              viewBox="0 0 108 108"
              className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 overflow-visible"
            >
              <circle
                cx="54"
                cy="54"
                r="50"
                fill="none"
                stroke="#ECEEF5"
                strokeWidth="4"
              />
              <circle
                cx="54"
                cy="54"
                r="50"
                fill="none"
                pathLength={1}
                stroke={item.color}
                strokeLinecap="round"
                strokeWidth="4"
                className={`relation-lock-ring-path${shouldDraw ? " is-drawing" : ""}`}
              />
            </svg>
            <span className="relative z-[1]">
              <LockGlyph />
            </span>
          </span>
          <span className="text-[13px] font-black text-[#2E2E5C]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
