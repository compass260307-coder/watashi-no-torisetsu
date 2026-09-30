"use client";

import { Component, lazy, Suspense, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Keep global navigation independent of checkout, report previews and login code.
// These wrappers must only be mounted when the corresponding dialog is open.
const PaywallOverlay = lazy(() =>
  import("@/components/result/PaywallModal").then((mod) => ({ default: mod.PaywallOverlay })),
);
const LoginModal = lazy(() =>
  import("@/components/LoginModal").then((mod) => ({ default: mod.LoginModal })),
);

const LOADING_COPY = {
  ja: ["読み込み中…", "閉じる", "読み込みに失敗しました。ページを更新すると、入力中の内容が失われる場合があります。", "ページを更新"],
  ko: ["불러오는 중…", "닫기", "불러오지 못했습니다. 새로고침하면 입력 중인 내용이 사라질 수 있습니다.", "새로고침"],
  en: ["Loading…", "Close", "Could not load. Reloading may discard unsaved answers.", "Reload page"],
  id: ["Memuat…", "Tutup", "Gagal dimuat. Memuat ulang dapat menghapus jawaban yang belum disimpan.", "Muat ulang"],
  th: ["กำลังโหลด…", "ปิด", "โหลดไม่ได้ การโหลดใหม่อาจทำให้คำตอบที่ยังไม่ได้บันทึกหายไป", "โหลดหน้าใหม่"],
} as const;

type FeedbackProps = {
  onClose: () => void;
  locale?: keyof typeof LOADING_COPY;
};

function LoadingDialog({ onClose, locale = "ja", failed = false }: FeedbackProps & { failed?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        event.preventDefault();
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const [loading, close, failure, reload] = LOADING_COPY[locale];
  return createPortal(
    <div ref={dialogRef} className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2E2E5C]/45 px-5"
      role="dialog" aria-modal="true" aria-label={failed ? failure : loading}>
      <div className="max-w-md rounded-3xl bg-white px-8 py-6 text-center text-[#2E2E5C] shadow-xl">
        <p role={failed ? "alert" : "status"}>{failed ? failure : loading}</p>
        {failed ? <button type="button" onClick={() => window.location.reload()}
          className="mr-3 mt-4 rounded-full border px-6 py-2 font-bold">{reload}</button> : null}
        <button ref={closeRef} type="button" onClick={onClose}
          className="mt-4 rounded-full border px-6 py-2 font-bold">{close}</button>
      </div>
    </div>,
    document.body,
  );
}

// A failed lazy chunk should not replace the whole page or discard its answers.
class OverlayErrorBoundary extends Component<FeedbackProps & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <LoadingDialog onClose={this.props.onClose} locale={this.props.locale} failed />
      : this.props.children;
  }
}

export function DeferredPaywallOverlay(props: ComponentProps<typeof PaywallOverlay>) {
  return (
    <OverlayErrorBoundary onClose={props.onClose} locale={props.locale}>
    <Suspense fallback={<LoadingDialog onClose={props.onClose} locale={props.locale} />}>
      <PaywallOverlay {...props} />
    </Suspense>
    </OverlayErrorBoundary>
  );
}

export function DeferredLoginModal(props: ComponentProps<typeof LoginModal>) {
  if (!props.open) return null;
  return (
    <OverlayErrorBoundary onClose={props.onClose} locale={props.locale}>
    <Suspense fallback={<LoadingDialog onClose={props.onClose} locale={props.locale} />}>
      <LoginModal {...props} />
    </Suspense>
    </OverlayErrorBoundary>
  );
}
