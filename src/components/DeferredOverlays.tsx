"use client";
import { useUiCopy } from "@/i18n/ui/use-ui-copy";

import { PaywallOverlay } from "@/components/result/PaywallModal";
import { Component, lazy, Suspense, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Keep checkout code in the initial bundle so opening a purchase dialog does not
// wait for another JavaScript download. Login remains loaded on demand.
// Both wrappers are mounted only while their corresponding dialog is open.
const LoginModal = lazy(() =>
  import("@/components/LoginModal").then((mod) => ({ default: mod.LoginModal })),
);

type FeedbackProps = {
  onClose: () => void;
  locale?: "ja" | "en" | "ko" | "id";
};

function LoadingDialog({ onClose, locale = "ja", failed = false }: FeedbackProps & { failed?: boolean }) {
  const copy = useUiCopy(locale).loading;
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
  const [loading, close, failure, reload] = copy;
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

export function EagerPaywallOverlay(props: ComponentProps<typeof PaywallOverlay>) {
  return (
    <OverlayErrorBoundary onClose={props.onClose} locale={props.locale}>
      <PaywallOverlay {...props} />
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
