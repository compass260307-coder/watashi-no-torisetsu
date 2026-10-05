"use client";
import { useNavigationCopy } from "@/i18n/ui/use-navigation-copy";
import { usePathname } from "next/navigation";
import { Component, type ReactNode } from "react";
function InitialLocaleCopy({ children }: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const segment = pathname.split("/")[1];
  const locale = segment === "en" || segment === "ko" || segment === "id" ? segment : "ja";
  // Japanese resolves only lightweight navigation here. Other locales retain
  // their existing shared dictionary to avoid extra small resource requests.
  useNavigationCopy(locale);
  return children;
}
export class LocaleUiBoundary extends Component<{
  children: ReactNode;
}, {
  failed: boolean;
}> {
  state = {
    failed: false
  };
  static getDerivedStateFromError() {
    return {
      failed: true
    };
  }
  render() {
    if (this.state.failed) {
      return (<div role="alert" className="mx-auto max-w-lg p-8 text-center">
        <p>ページを読み込めませんでした。 / Unable to load this page.</p>
        <button className="mt-4 underline" onClick={() => window.location.reload()}>
          再読み込み / Reload
        </button>
      </div>);
    }
    return <InitialLocaleCopy>{this.props.children}</InitialLocaleCopy>;
  }
}
