"use client";

// Alice Plus LP全体のスクロール演出を、1つのObserverにまとめる。
// コンテンツ自体はServer Componentのままにし、DOMへ状態だけ付与する。

import { useEffect } from "react";

export default function PlusMotionController() {
  useEffect(() => {
    const root = document.getElementById("alice-plus-page");
    if (!root) return;

    const revealTargets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-plus-reveal]"),
    );
    const hero = root.querySelector<HTMLElement>("[data-plus-hero]");
    const stickyStops = Array.from(
      root.querySelectorAll<HTMLElement>("[data-plus-sticky-stop]"),
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canObserve = "IntersectionObserver" in window;

    root.dataset.plusMotion = reduceMotion
      ? "reduced"
      : canObserve
        ? "ready"
        : "static";

    if (reduceMotion || !canObserve) {
      revealTargets.forEach((target) => {
        target.dataset.plusVisible = "true";
      });
    }

    if (!canObserve) return;

    const revealObserver = reduceMotion
      ? null
      : new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target as HTMLElement;
              target.dataset.plusVisible = "true";
              observer.unobserve(target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
        );

    if (revealObserver) {
      revealTargets.forEach((target) => revealObserver.observe(target));
    }

    let hasPassedHero = false;
    const visibleStops = new Set<Element>();
    const syncSticky = () => {
      root.dataset.plusSticky =
        hasPassedHero && visibleStops.size === 0 ? "visible" : "hidden";
    };

    const heroObserver = hero
      ? new IntersectionObserver(
          ([entry]) => {
            hasPassedHero =
              !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
            syncSticky();
          },
          { threshold: 0 },
        )
      : null;

    const stopObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleStops.add(entry.target);
          else visibleStops.delete(entry.target);
        });
        syncSticky();
      },
      { threshold: 0 },
    );

    if (hero && heroObserver) heroObserver.observe(hero);
    stickyStops.forEach((target) => stopObserver.observe(target));

    return () => {
      revealObserver?.disconnect();
      heroObserver?.disconnect();
      stopObserver.disconnect();
    };
  }, []);

  return null;
}
