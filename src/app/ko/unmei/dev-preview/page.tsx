import { notFound } from "next/navigation";
import UnmeiBirthChatPreview from "@/components/uranai/UnmeiBirthChatPreview";

export const dynamic = "force-dynamic";

export default function KoreanUnmeiBirthChatPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <UnmeiBirthChatPreview locale="ko" />;
}
