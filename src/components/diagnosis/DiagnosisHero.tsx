import Image from "next/image";

// 診断ページ冒頭のヒーロー。/tako (他己診断) の FV と同じ「左=見出し / 右=イラスト」構成。
//   - PC (md+): 見出し flex-1 (左) + イラスト (右)。SP: 縦積み (見出し→イラスト)。
//   - 見出しは font-black・ネイビー。下に権威づけのサブコピー (診断の理論的裏付け)。
//   - 横幅はフッター・質問カードと同じ max-w-[1080px] に揃える。
//   - 最初のページ (page 0) の最上部にだけ置き、スクロールで流れて進捗バーが上端に残る。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

// title / subtitle / imageSrc は任意。省略時は自己診断ページの既定。
// (他己診断=friend フローでは title / 画像を差し替えて再利用する。)
export function DiagnosisHero({
  title = "性格診断テスト",
  subtitle = "Big Five 性格特性モデル",
  imageSrc = "/mascot/diagnosis-hero.png",
}: {
  title?: string;
  subtitle?: string;
  imageSrc?: string;
} = {}) {
  return (
    <section
      className="w-full bg-white px-4 pt-8 pb-6 md:px-8"
      style={{ fontFamily: FONT_STACK }}
    >
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-4 md:flex-row md:items-center md:gap-10">
        <div className="w-full md:flex-1">
          <h1
            className="text-center text-[34px] font-black leading-[1.35] md:text-left md:text-[52px]"
            style={{ color: NAVY }}
          >
            {title}
          </h1>
          {/* 権威づけ: 診断の理論的裏付け (Big Five 特性理論ベース) を明記して信頼感を出す。 */}
          <p className="mt-2.5 text-center text-base font-bold tracking-wide text-[#8A8AA3] md:text-left md:text-lg">
            {subtitle}
          </p>
        </div>
        {/* エンブレム: フェルト調のキャラクターシーン (横長)。LCP 候補なので priority で先読み。
            SP は画面幅いっぱいまで大きく (w-full)、PC は右カラムで w-[460px]。 */}
        <div className="w-full shrink-0 md:w-auto">
          <Image
            src={imageSrc}
            alt="ワタシのトリセツのマスコット"
            width={1448}
            height={1086}
            priority
            className="mx-auto h-auto w-full max-w-[420px] md:w-[460px] md:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
