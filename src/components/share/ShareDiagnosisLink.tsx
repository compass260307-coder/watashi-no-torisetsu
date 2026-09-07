"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { track } from "@/lib/track";

/** 結果シェア着地から自己診断へ進むCTA。設置場所別にクリックを計測する。 */
export function ShareDiagnosisLink({
  href,
  inviteCode,
  source,
  className,
  style,
  children,
}: {
  href: string;
  inviteCode: string;
  source: "sticky_bar" | "share_bottom";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      data-share-diagnosis-tracked="true"
      onClick={() =>
        track("share_to_diagnosis_clicked", {
          inviteCode,
          metadata: { kind: "character", source },
        })
      }
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}
