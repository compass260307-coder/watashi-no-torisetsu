import type { Metadata } from "next";
import CharacterShareLandingPage, {
  generateCharacterShareMetadata,
} from "@/components/share/CharacterShareLandingPage";

interface SharePageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export function generateMetadata({
  params,
}: Pick<SharePageProps, "params">): Promise<Metadata> {
  return generateCharacterShareMetadata({ params, locale: "ja" });
}

export default function SharePage(props: SharePageProps) {
  return <CharacterShareLandingPage {...props} locale="ja" />;
}
