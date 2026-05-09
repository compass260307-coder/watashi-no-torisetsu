import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "性格診断（無料・3分）",
  description:
    "Big Five理論ベースの15問の性格診断。直感で答えるだけ、3分で完成。登録不要・完全無料・大学生向け。",
  alternates: { canonical: "/diagnosis" },
};

export default function DiagnosisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
