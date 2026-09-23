import type { Metadata } from "next";
import EnTakoEntryPage from "@/components/en/EnTakoEntryPage";

const TITLE = "Friend perspective | Alice Personalities";
const DESCRIPTION = "Compare your self-view with how your friends see you.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: "/en/tako",
    languages: {
      "ja-JP": "/tako",
      "ko-KR": "/ko/tako",
      "en-US": "/en/tako",
      "id-ID": "/id/tako",
      "x-default": "/tako",
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    siteName: "Alice Personalities",
    images: ["/characters/keyvisual.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/characters/keyvisual.webp"],
  },
  robots: { index: false, follow: false },
};

export default function EnglishTakoEntryRoute() {
  return <EnTakoEntryPage />;
}
