import type { Metadata } from "next";
import CharacterShareLandingPage, {
  generateCharacterShareMetadata,
} from "@/components/share/CharacterShareLandingPage";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  return generateCharacterShareMetadata({ params, locale: "en" });
}

export default function EnglishSharePage(props: PageProps) {
  return <CharacterShareLandingPage {...props} locale="en" />;
}
