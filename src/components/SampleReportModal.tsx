"use client";

import { useEffect } from "react";

interface SampleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SampleReportModal({ isOpen, onClose }: SampleReportModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-modal-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="サンプルレポート"
    >
      <div
        className="relative w-full h-[100dvh] sm:h-[85vh] sm:max-w-md bg-white sm:rounded-2xl shadow-2xl overflow-hidden animate-modal-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          <span className="text-xl text-gray-700 font-bold leading-none">
            ✕
          </span>
        </button>

        <iframe
          src="/report/sample"
          className="w-full h-full border-0"
          title="サンプルレポート"
        />
      </div>
    </div>
  );
}
