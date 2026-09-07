"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  isAccessProduct,
  type AccessProduct,
} from "@/lib/access-products";
import type { ResultLocale } from "@/i18n/result";

export function useCheckoutCancelledProduct(): AccessProduct | null {
  const [product, setProduct] = useState<AccessProduct | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedProduct = params.get("product");
    if (
      params.get("checkout") !== "cancelled" ||
      !isAccessProduct(requestedProduct)
    ) {
      return;
    }

    const timer = window.setTimeout(() => setProduct(requestedProduct), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return product;
}

export function CheckoutCancelledNotice({
  locale,
  courseName,
  retryAction,
  imageSrc,
  className = "",
}: {
  locale: ResultLocale;
  courseName: string;
  retryAction: ReactNode;
  imageSrc?: string;
  className?: string;
}) {
  const isKorean = locale === "ko";

  return (
    <div
      role="region"
      aria-label={isKorean ? "결제 취소 안내" : "決済キャンセルのご案内"}
      className={`mx-auto flex w-full max-w-[720px] flex-col justify-center rounded-[24px] border border-[#D9D8F3] bg-[#F3F2FF] px-6 py-6 text-left shadow-[0_8px_24px_rgba(46,46,92,0.08)] ${imageSrc ? "min-h-[355px]" : ""} ${className}`}
    >
      {imageSrc ? (
        <div className="mx-auto mb-4 flex h-[118px] w-[118px] items-center justify-center rounded-full bg-white/70 shadow-[inset_0_0_0_1px_rgba(217,216,243,0.7)]">
          <Image
            src={imageSrc}
            alt=""
            aria-hidden="true"
            width={160}
            height={160}
            sizes="118px"
            className="h-[108px] w-[108px] object-contain drop-shadow-[0_8px_14px_rgba(46,46,92,0.12)]"
          />
        </div>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        className={imageSrc ? "text-center" : undefined}
      >
        <p className="text-[16px] font-black text-[#2E2E5C]">
          {isKorean ? "결제가 취소되었어요" : "決済はキャンセルされました"}
        </p>
        <p className="mx-auto mt-2 max-w-[310px] text-[12px] font-bold leading-[1.75] text-[#65657B] md:text-[13px]">
          {isKorean
            ? `요금은 청구되지 않았어요. ${courseName}을(를) 선택한 상태로 돌아왔어요.`
            : `料金は発生していません。${courseName}を選択した状態に戻しました。`}
        </p>
      </div>
      <div className="mt-5">{retryAction}</div>
    </div>
  );
}

function clearCheckoutCancelledParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  url.searchParams.delete("product");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export function CheckoutCancelledModal({
  locale,
  courseName,
  retryAction,
  imageSrc,
}: {
  locale: ResultLocale;
  courseName: string;
  retryAction: ReactNode;
  imageSrc?: string;
}) {
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isKorean = locale === "ko";

  const dismiss = useCallback(() => {
    clearCheckoutCancelledParams();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [dismiss, open]);

  if (!open) return null;

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) dismiss();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#17172B]/40 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isKorean ? "결제 취소 안내" : "決済キャンセルのご案内"}
        className="relative w-full max-w-[380px]"
      >
        <CheckoutCancelledNotice
          locale={locale}
          courseName={courseName}
          retryAction={retryAction}
          imageSrc={imageSrc}
          className="max-w-none shadow-[0_20px_65px_rgba(23,23,43,0.24)]"
        />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={dismiss}
          aria-label={isKorean ? "닫기" : "閉じる"}
          className="absolute -right-1 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2E2E5C] shadow-[0_5px_18px_rgba(23,23,43,0.22)] transition hover:scale-105 active:scale-95"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}
