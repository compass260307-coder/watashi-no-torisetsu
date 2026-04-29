import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ワタシのトリセツ｜友達と作る、ワタシのトリセツ",
  description:
    "自分が思う私と、友達から見える私。そのギャップが、本当のあなたを見せてくれる。15問の診断で、あなたのトリセツを作ろう。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
