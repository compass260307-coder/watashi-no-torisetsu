import { LoginCard } from "@/components/LoginCard";
import { SmoothImage } from "@/components/ui/SmoothImage";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { versionCharacterAssetPath } from "@/lib/character-image";

type LoginPageLocale = "ja" | "en";

const COPY = {
  ja: {
    heading: "おかえりなさい！",
    firstLine: "メールに届くリンクをタップするだけ。",
    secondLine: "パスワードは要りません。",
  },
  en: {
    heading: "Welcome back!",
    firstLine: "Tap the link in your email to return to your results.",
    secondLine: "No password needed.",
  },
} as const;

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

export default function LoginPageContent({
  locale,
}: {
  locale: LoginPageLocale;
}) {
  const copy = COPY[locale];

  return (
    <>
      <TopHeader locale={locale} />
      <main
        className="flex flex-1 flex-col items-center px-5 pb-16 pt-8 md:pt-12"
        style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
      >
        <SmoothImage
          src={versionCharacterAssetPath("/characters/cut/dog_R.webp")}
          alt=""
          width={480}
          height={480}
          priority
          className="h-auto w-[190px] md:w-[230px]"
        />
        <h1 className="mt-1 text-center text-[26px] font-black leading-snug text-[#2E2E5C] md:text-[30px]">
          {copy.heading}
        </h1>
        <p className="mt-2 mb-6 text-center text-[13px] font-bold leading-[1.9] text-[#2E2E5C]/60">
          {copy.firstLine}
          <br />
          {copy.secondLine}
        </p>
        <LoginCard locale={locale} />
      </main>
      <TopFooter locale={locale} />
    </>
  );
}
