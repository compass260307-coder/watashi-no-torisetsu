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
  return generateCharacterShareMetadata({ params, locale: "id" });
}

export default function IndonesianSharePage(props: SharePageProps) {
  return <CharacterShareLandingPage {...props} locale="id" />;
}
