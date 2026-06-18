// ① ファーストビュー (改修): 大キャッチ(テキスト) + サブ + マスコット + FV内CTA + バッジ。
// logo-hero.png は廃止しテキストキャッチを主役に (ヘッダーの logo.png は page 側で維持)。
import Image from "next/image";
import { CtaButton, ReassureBadge } from "./CtaButton";

export function HeroSection() {
  return (
    <section className="text-center pt-2">
      {/* 大キャッチ (透過 webp 画像)。命名/参照は /logo.png と同じ public 直下の絶対パス。 */}
      <h1 className="flex justify-center mt-3 mb-3">
        <Image
          src="/fv-catch.webp"
          alt="友達しか知らない「ホントのアナタ」見たくない？"
          width={1113}
          height={604}
          priority
          className="w-full max-w-[380px] h-auto"
        />
      </h1>

      {/* サブコピー */}
      <p className="text-[#3A2D6B]/85 font-bold text-sm leading-relaxed mb-4">
        自己診断 × 友達評価 × AI で、
        <br />
        アナタも気づかなかったアナタが見えてくる
      </p>

      {/* キービジュアル (マスコット維持。アーチ背景でポップに) */}
      <div className="relative my-4 flex justify-center">
        <div
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 top-2 w-[260px] h-[200px] bg-gradient-to-b from-pink-200/40 to-blue-200/40 rounded-t-full"
        />
        <Image
          src="/mascot-pair.png"
          alt="ワタシのトリセツのマスコット"
          width={300}
          height={300}
          priority
          className="relative z-10 w-full max-w-[280px] h-auto"
        />
      </div>

      {/* FV内CTA + バッジ */}
      <div className="mb-2">
        <CtaButton href="/diagnosis" label="無料で診断する →" />
      </div>
      <div className="flex justify-center">
        <ReassureBadge />
      </div>
    </section>
  );
}
