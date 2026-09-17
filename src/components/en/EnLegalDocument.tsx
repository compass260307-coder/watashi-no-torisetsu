import type { ReactNode } from "react";
import LegalDocument from "@/components/LegalDocument";

export default function EnLegalDocument({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <LegalDocument title={title} lastUpdated={lastUpdated} locale="en">
      {children}
    </LegalDocument>
  );
}
