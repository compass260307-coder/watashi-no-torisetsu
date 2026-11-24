import { SmoothImage } from "@/components/ui/SmoothImage";
import { phraseWrapJa } from "@/lib/ja-phrase";
import type { StaticImageData } from "next/image";
import diagnosisHero from "../../../public/mascot/diagnosis-hero.png";
import stepOne from "../../../public/mascot/diagnosis-step-1.webp";
import stepTwo from "../../../public/mascot/diagnosis-step-2.webp";
import stepThree from "../../../public/mascot/diagnosis-step-3.webp";

// 診断ページ冒頭のヒーロー。/tako (友達診断) の FV と同じ「左=見出し / 右=イラスト」構成。
//   - PC (md+): 見出し flex-1 (左) + イラスト (右)。SP: 縦積み (見出し→イラスト)。
//   - 見出しは font-black・ネイビー。下に権威づけのサブコピー (診断の理論的裏付け)。
//   - 横幅はフッター・質問カードと同じ max-w-[1080px] に揃える。
//   - 最初のページ (page 0) の最上部にだけ置き、スクロールで流れて進捗バーが上端に残る。
//
// steps を渡すと、イラストの代わりに「3つの手順」を出す (2026-11-25)。
//   スマホでは大きなイラストに押されて 1 問目の回答の○が最初の画面に入らず、
//   1 問も答えずに離れる人が多かったため。手順は 1 枚の表にまとめて、
//   1 問目の○まで最初の画面に収める。PC は説明文つきの 3 枚のカード。
//   見た目は落ち着かせる: 淡い帯・白い表・色は 1 色・絵はフェルトの小物
//   (キャラクターの顔やパステルの飾りを増やすと、信頼感が落ちる)。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const ACCENT = "#5B5BEF";

export interface DiagnosisHeroStep {
  // 「ステップ1」などの小さなラベル
  label: string;
  // 手順の名前
  title: string;
  // 手順の説明。読点・句点で 2 つに分かれ、それぞれ 18 字以内 (スマホで 2 行に収める)
  body: string;
}

// 手順の絵 (並び順 = ステップ順)。背景は透明で、淡い色の台に載せる。
const STEP_ART: StaticImageData[] = [stepOne, stepTwo, stepThree];

// 帯の下端のゆるい曲線 (左右の端が少し上がる)。
const BAND_CURVE = "50% 28px";

// 見出しの字間を詰める (かなの前後の空きをなくして、文字の並びを引き締める)。
const PALT = '"palt"';

// 手順の表・カードの影。近い影と遠い影を重ねて、紙が少し浮いているように見せる。
const CARD_SHADOW_SP =
  "shadow-[0_1px_1px_rgba(46,46,92,0.03),0_6px_14px_-6px_rgba(46,46,92,0.10),0_22px_40px_-22px_rgba(46,46,92,0.22)]";
const CARD_SHADOW_PC =
  "md:shadow-[0_1px_1px_rgba(46,46,92,0.03),0_8px_18px_-8px_rgba(46,46,92,0.10),0_28px_52px_-26px_rgba(46,46,92,0.24)]";

// title / subtitle / imageSrc は任意。省略時は自己診断ページの既定。
// (友達診断=friend フローでは title / 画像を差し替えて再利用する。)
export function DiagnosisHero({
  title = "性格診断テスト",
  subtitle = "ビッグファイブ（Big Five）性格特性モデル",
  imageSrc = diagnosisHero,
  imageAlt = "ワタシのトリセツのマスコット",
  steps,
}: {
  title?: string;
  subtitle?: string;
  imageSrc?: string | StaticImageData;
  imageAlt?: string;
  steps?: DiagnosisHeroStep[];
} = {}) {
  if (steps && steps.length > 0) {
    return (
      <section
        className="relative w-full px-4 pb-2 pt-5 md:px-8 md:pb-4 md:pt-16"
        style={{ fontFamily: FONT_STACK }}
      >
        {/* 淡い帯。手順の表の途中で終わり、表が帯と白地にまたがる。
            上の中央をわずかに明るくして、平らな色面に見えないようにする。 */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 bottom-[76px] md:bottom-[176px]"
          style={{
            background:
              "radial-gradient(90% 70% at 50% 0%, #FDFCFF 0%, rgba(253,252,255,0) 70%), linear-gradient(180deg, #F6F4FD 0%, #EBE8F8 100%)",
            borderBottomLeftRadius: BAND_CURVE,
            borderBottomRightRadius: BAND_CURVE,
          }}
        />
        <div className="relative mx-auto max-w-[1080px]">
          <h1
            className="text-center text-[clamp(26px,8.2vw,32px)] font-black leading-[1.25] tracking-[0.02em] md:text-[56px]"
            style={{ color: NAVY, fontFeatureSettings: PALT }}
          >
            {title}
          </h1>
          {/* 副題は左右に細い線を添えて、認定の表記のように見せる。 */}
          <p className="mt-2 flex items-center justify-center gap-3 text-[15px] font-medium tracking-[0.06em] text-[#4A4A68] md:mt-4 md:gap-4 md:text-[19px]">
            <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0] md:w-9" />
            {subtitle}
            <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0] md:w-9" />
          </p>
          <ol
            className={`mt-4 rounded-[20px] border border-[#E6E4F1] bg-white ${CARD_SHADOW_SP} md:mt-11 md:grid md:grid-cols-3 md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:shadow-none`}
          >
            {steps.slice(0, STEP_ART.length).map((step, index) => (
              <li
                key={step.label}
                className={`relative flex items-center gap-3 px-3.5 py-2.5 md:block md:rounded-[24px] md:border md:border-[#E6E4F1] md:bg-white md:p-3 ${CARD_SHADOW_PC}`}
              >
                {/* 行の区切り線 (スマホだけ。絵の台の右から引く) */}
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[74px] right-0 top-0 h-px bg-[#EDECF5] md:hidden"
                  />
                )}
                {/* 絵の台。スマホは小さな角丸の台、PC はカードの内側に収めた大きな台。 */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(160deg,#F7F5FE_0%,#E9E6F9_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)] md:h-[184px] md:w-full md:rounded-[16px]">
                  <SmoothImage
                    src={STEP_ART[index]}
                    alt=""
                    width={480}
                    height={480}
                    sizes="(min-width: 768px) 150px, 42px"
                    priority={index === 0}
                    className="h-[42px] w-[42px] object-contain md:h-[150px] md:w-[150px]"
                  />
                </div>
                <div className="min-w-0 md:px-4 md:pb-5 md:pt-5">
                  <p className="flex items-center gap-2 md:flex-col md:items-start md:gap-2.5">
                    <span
                      className="shrink-0 rounded-full bg-[#EEEDFC] px-2 py-[3px] text-[10.5px] font-bold leading-none tracking-[0.04em] md:px-3 md:py-[5px] md:text-[12.5px] md:tracking-[0.06em]"
                      style={{ color: ACCENT }}
                    >
                      {step.label}
                    </span>
                    <span
                      className="text-[17px] font-bold leading-[1.4] tracking-[0.01em] md:text-[23px]"
                      style={{ color: NAVY, fontFeatureSettings: PALT }}
                    >
                      {step.title}
                    </span>
                  </p>
                  <p className="phrase-jp mt-[3px] text-[13px] leading-[1.5] text-[#4F4F6E] md:mt-2 md:text-[15.5px] md:leading-[1.8]">
                    {phraseWrapJa(step.body)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section
      className="w-full bg-white px-4 pt-8 pb-6 md:px-8"
      style={{ fontFamily: FONT_STACK }}
    >
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-4 md:flex-row md:items-center md:gap-10">
        <div className="w-full md:flex-1">
          <h1
            className="text-center text-[34px] font-bold leading-[1.35] md:text-left md:text-[52px]"
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
          <SmoothImage
            src={imageSrc}
            alt={imageAlt}
            width={1448}
            height={1086}
            sizes="(min-width: 768px) 460px, (min-width: 452px) 420px, calc(100vw - 32px)"
            priority
            className="mx-auto h-auto w-full max-w-[420px] md:w-[460px] md:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
