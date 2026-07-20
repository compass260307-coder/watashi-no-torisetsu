// Phase 1.5-α: 結果ページ上のヒーロー (箱カードにしない・ページ背景に自然に乗せる)。
//
// 構成: [角丸スクエアのキャラ画像 (コンテンツカードと同じ横幅)] → essence + 型名 (同サイズ・
// font-black・deepPurple のクリーン塗り) → 短い説明。
// 見出しは保存画像 (ShareCard) の .wtr-* (白フチ+黄ドロップ) とは別で、装飾なしのクリーンな塗り。
// スマホでは見出しブロックを画像下端に少し重ねる (frame relative + 負 margin + z-index)。
// 画像は幅高さ固定でレイアウトシフト防止。
//
// 使う場所: /me(自分の型) / /evaluate/result(友達から見た型)。

import type { CSSProperties } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { Job } from "@/lib/job";
import type { ResultLocale } from "@/i18n/result";

// 動物＋職業システム用スロット (/me のみ渡す)。
// job が決まれば「{職業}{動物}」+ アバター右下バッジ。未定なら「？{動物}」+ 判明ゲージ。
export interface CharacterHeroJobSlot {
  animal: string; // bare 動物名 (例: イルカ)
  job: Job | null; // 友達3人以上で確定。null = 未定
  friendCount: number;
  threshold: number; // 職業判明に必要な友達人数 (= 3)
}

interface CharacterHeroProps {
  imageSrc: string;
  alt: string;
  essence: string; // 小・上 (例: 気まぐれロマンチスト)
  name: string; // 大・下 (例: きらめきウサギ)
  description?: string; // 短い説明 (型の essence 文 1〜3 行)
  eyebrow?: string; // 任意の上ラベル (例: 「{perceiver}が見た{owner}は」)
  jobSlot?: CharacterHeroJobSlot; // 指定時は名前を動物＋職業表示に切替 (/me)
  // 画像枠のアスペクト比 (Tailwind クラス)。既定は正方形。
  imageAspectClassName?: string;
  // 画像の object-fit (Tailwind クラス)。既定は cover/top。/me は contain で全身を切らさず表示。
  imageFitClassName?: string;
  // 画像枠の最大幅 (Tailwind クラス)。既定は無し (= 親の横幅いっぱい)。/me は小さめ「引き」+
  // 余白を見せるため max-w を指定。テキスト (名前/肩書き) は親幅のまま広く読ませる。
  imageMaxWidthClassName?: string;
  // 縁を溶かす表示。true で角丸/影を外し、ラジアルマスクで画像の外周 (背景の余白部) を
  // 透過フェードさせ、四角いカードの縁をページ背景に馴染ませる。中心 (キャラ本体) は不透過の
  // ままなのでキャラは切れない。ヒーロー背景がキャラ画像の背景トーンのとき没入感が出る。
  imageBlend?: boolean;
  // <Image> の sizes 属性 (実表示幅。例 "320px")。未指定なら従来どおり sizes を省略。
  imageSizes?: string;
  // imageBlend=false 時のカード枠クラスを上書き (角丸/影/リング等)。未指定なら既定カード。
  imageCardClassName?: string;
  // 職業判明時の「変身」演出キー (localStorage、ユーザーごと)。指定時のみ名前を JobRevealName
  // で描画し初回判明で 1 回だけ再生する。未指定 (例: /evaluate/result) は静的表示のまま。
  revealKey?: string;
  // デモ用: 変身演出を毎回強制再生 (フラグを見ない/書かない)。開発確認用。
  forceReveal?: boolean;
  // true で画像下の「装飾」(eyebrow / essence 肩書き / 説明文) を非表示にする。
  // 職業まわり (型名 h1 / 判明ゲージ / 変身演出 JobRevealName) は残す。
  // /me はキャラ名をトップバーへ移したため装飾は隠しつつ、職業表示は維持する用途。
  hideDecorations?: boolean;
  // true で「あと○人で職業が判明」ゲージのみ非表示にする (職業バッジ/ロジックは残す)。/me 用。
  hideJobGauge?: boolean;
  // imageBlend 時のマスク style を上書き (未指定なら既定の radial BLEND_MASK)。
  // /me は四辺だけ細く溶かす矩形マスク (linear×2 を mask-composite:intersect) を渡す。
  imageBlendStyle?: CSSProperties;
  locale?: ResultLocale;
}

// 縁フェード用マスク: 中心 80% は不透過 (キャラ本体)、外周〜角を透過 (背景の余白を溶かす)。
const BLEND_MASK =
  "radial-gradient(closest-side at 50% 50%, #000 80%, transparent 100%)";

export function CharacterHero({
  imageSrc,
  alt,
  essence,
  description,
  eyebrow,
  jobSlot,
  imageAspectClassName = "aspect-square",
  imageFitClassName = "object-cover object-top",
  imageMaxWidthClassName = "",
  imageBlend = false,
  imageSizes,
  imageCardClassName,
  hideDecorations = false,
  hideJobGauge = false,
  imageBlendStyle,
  locale = "ja",
}: CharacterHeroProps) {
  const job = jobSlot?.job ?? null;
  const remaining = jobSlot
    ? Math.max(0, jobSlot.threshold - jobSlot.friendCount)
    : 0;
  const progressPct = jobSlot
    ? Math.min(100, Math.round((jobSlot.friendCount / jobSlot.threshold) * 100))
    : 0;

  return (
    <div className="flex flex-col items-center text-center mb-4">
      {/* 画像枠。imageMaxWidthClassName で「引き」(小さめ+余白) も可。アスペクト/object-fit も可変。
          contain 指定時はキャラ全身が枠内に収まり切れず欠けない (見切れ解消)。 */}
      <div className={`relative w-full ${imageMaxWidthClassName}`.trim()}>
        <div
          className={
            imageBlend
              ? `w-full ${imageAspectClassName}`
              : `w-full ${imageAspectClassName} ${imageCardClassName ?? "rounded-[24px] overflow-hidden shadow-[0_10px_28px_rgba(58,45,107,0.16)]"}`
          }
          style={
            imageBlend
              ? (imageBlendStyle ?? {
                  WebkitMaskImage: BLEND_MASK,
                  maskImage: BLEND_MASK,
                })
              : undefined
          }
        >
          <SmoothImage
            src={imageSrc}
            alt={alt}
            width={960}
            height={960}
            priority
            sizes={imageSizes}
            className={`w-full h-full ${imageFitClassName}`}
          />
        </div>
        {/* 職業バッジ (アバター右下のアイコン) は撤去。職業テキスト/ロジックは不変。 */}
      </div>
      {/* 画像下のテキスト。称号(essence)を主役の見出しに表示し、動物名(name/animal)は表示しない
          (データは温存・別系統で参照)。hideDecorations 時はまとめて非表示 (/me は独自ヒーロー)。 */}
      {!hideDecorations && (
        <div className="mt-3 flex flex-col items-center">
          {eyebrow && (
            <p className="text-[#2E2E5C]/70 font-bold text-xs mb-1">{eyebrow}</p>
          )}
          <h1 className="font-black text-3xl text-[#2E2E5C] leading-tight mb-3">
            {essence}
          </h1>
        </div>
      )}

      {/* 職業未定: 判明ゲージ (hideJobGauge で表示のみ抑止可。ロジックは不変) */}
      {jobSlot && !job && !hideJobGauge && (
        <div className="w-full max-w-[280px] mb-3">
          <p className="text-[#5B5BEF] font-black text-[10px] tracking-[0.2em] mb-1.5">
            {locale === "ko"
              ? `친구 ${remaining}명만 더 참여하면 역할을 알 수 있어요`
              : `あと ${remaining} 人で職業が判明`}
          </p>
          <div
            className="w-full h-2.5 bg-card-border rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={jobSlot.friendCount}
            aria-valuemin={0}
            aria-valuemax={jobSlot.threshold}
            aria-label={
              locale === "ko"
                ? `친구 평가 ${jobSlot.friendCount} / ${jobSlot.threshold}명`
                : `友達評価 ${jobSlot.friendCount} / ${jobSlot.threshold} 人`
            }
          >
            <div
              className="h-full bg-[var(--primary)] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {!hideDecorations && description && (
        // balance-jp: text-wrap:balance + word-break:auto-phrase (日本語の文節で均等折返し)
        <p className="balance-jp text-[#2E2E5C]/85 text-sm leading-relaxed max-w-[340px]">
          {description}
        </p>
      )}
    </div>
  );
}
