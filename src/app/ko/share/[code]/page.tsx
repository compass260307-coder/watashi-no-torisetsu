import type { Metadata } from "next";
import CharacterShareLandingPage, {
  generateCharacterShareMetadata,
} from "@/components/share/CharacterShareLandingPage";

interface KoreanSharePageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export function generateMetadata({
  params,
}: Pick<KoreanSharePageProps, "params">): Promise<Metadata> {
  return generateCharacterShareMetadata({ params, locale: "ko" });
}

export default function KoreanSharePage(props: KoreanSharePageProps) {
  return <CharacterShareLandingPage {...props} locale="ko" />;
}
