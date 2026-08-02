import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "친구가 보는 나",
  description: "친구의 답변과 자기 진단을 비교해 실제로 어떻게 보이는지 확인해 보세요.",
  robots: { index: false, follow: false },
};

export default function KoreanTakoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
