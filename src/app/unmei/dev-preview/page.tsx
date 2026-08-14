import { notFound } from "next/navigation";
import UnmeiBirthChatPreview from "@/components/uranai/UnmeiBirthChatPreview";

export const dynamic = "force-dynamic";

export default function UnmeiBirthChatPreviewPage() {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  return <UnmeiBirthChatPreview />;
}
