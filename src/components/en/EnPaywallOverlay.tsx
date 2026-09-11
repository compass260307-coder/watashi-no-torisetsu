"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EnFullAccessCard from "@/components/en/EnFullAccessCard";

export default function EnPaywallOverlay({
  ownerToken,
  returnTo,
  imageSrc,
  imageAlt,
  onClose,
}: {
  ownerToken: string;
  returnTo: "me" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
  imageSrc?: string;
  imageAlt?: string;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock the Complete Edition"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2E2E5C]/55 px-3 py-5 backdrop-blur-sm md:py-8"
      onClick={onClose}
    >
      <div
        ref={scrollRef}
        className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-[1120px] overflow-y-auto overscroll-contain rounded-3xl md:max-h-[calc(100dvh-4rem)]"
        onClick={(event) => event.stopPropagation()}
        onScroll={() => {
          const element = scrollRef.current;
          if (!element) return;
          setShowTop(
            element.scrollHeight - element.clientHeight > 300 &&
              element.scrollHeight - element.clientHeight - element.scrollTop <= 64,
          );
        }}
      >
        <EnFullAccessCard
          ownerToken={ownerToken}
          purchased={false}
          returnTo={returnTo}
          imageSrc={imageSrc}
          imageAlt={imageAlt}
          onClose={onClose}
        />
      </div>
      <button
        type="button"
        aria-label="Back to the top of the purchase card"
        aria-hidden={!showTop}
        tabIndex={showTop ? 0 : -1}
        onClick={(event) => {
          event.stopPropagation();
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className={`fixed left-1/2 top-[72px] z-[110] flex h-11 -translate-x-1/2 items-center rounded-full bg-[#2A3A5C] px-4 text-[12px] font-black text-white shadow-lg transition md:hidden ${
          showTop ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        ↑ Top
      </button>
    </div>,
    document.body,
  );
}
