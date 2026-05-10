import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "友達からの印象",
  description:
    "友達があなたをどう見ているか、印象の集まりを確認できます。",
  robots: { index: false, follow: false },
};

export default function PerceptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
