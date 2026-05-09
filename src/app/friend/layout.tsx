import type { Metadata } from "next";

// /friend および /friend/[inviteCode] は個人招待ページのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FriendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
