"use client";

import { useState } from "react";
import { faqItems } from "@/lib/faq-data";

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqItems.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className="border border-[#D9DCF5] rounded-xl overflow-hidden bg-white"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left hover:bg-[#F4F4FE] transition-colors"
            >
              <span className="text-sm font-bold text-foreground leading-snug">
                <span className="text-[#5B5BEF] mr-1">Q.</span>
                {item.question}
              </span>
              <span
                aria-hidden
                className={`text-[#5B5BEF] text-xl leading-none transition-transform shrink-0 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                ⌄
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 pt-0 text-sm text-muted leading-relaxed bg-[#F4F4FE]">
                <span className="text-[#5B5BEF] font-bold mr-1">A.</span>
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
