// Phase 1.5-α: 結果ページ上のヒーロー (箱カードにしない・ページ背景に自然に乗せる)。
//
// 構成: [角丸スクエアのキャラ画像 (コンテンツカードと同じ横幅)] → essence + 型名 (同サイズ・
// font-black・deepPurple のクリーン塗り) → 短い説明。
// 見出しは保存画像 (ShareCard) の .wtr-* (白フチ+黄ドロップ) とは別で、装飾なしのクリーンな塗り。
// スマホでは見出しブロックを画像下端に少し重ねる (frame relative + 負 margin + z-index)。
// 画像は幅高さ固定でレイアウトシフト防止。
//
// 使う場所: /me(自分の型) / /evaluate/result(友達から見た型)。

import Image from "next/image";
import type { Job } from "@/lib/job";
import { JobRevealName } from "./JobRevealName";

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
}

// 縁フェード用マスク: 中心 80% は不透過 (キャラ本体)、外周〜角を透過 (背景の余白を溶かす)。
const BLEND_MASK =
  "radial-gradient(closest-side at 50% 50%, #000 80%, transparent 100%)";

export function CharacterHero({
  imageSrc,
  alt,
  essence,
  name,
  description,
  eyebrow,
  jobSlot,
  imageAspectClassName = "aspect-square",
  imageFitClassName = "object-cover object-top",
  imageMaxWidthClassName = "",
  imageBlend = false,
  imageSizes,
  imageCardClassName,
  revealKey,
  forceReveal = false,
  hideDecorations = false,
  hideJobGauge = false,
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
              ? { WebkitMaskImage: BLEND_MASK, maskImage: BLEND_MASK }
              : undefined
          }
        >
          <Image
            src={imageSrc}
            alt={alt}
            width={960}
            height={960}
            priority
            sizes={imageSizes}
            className={`w-full h-full ${imageFitClassName}`}
          />
        </div>
        {/* 職業バッジ (確定時のみ、アバター右下)。overflow-hidden の外なのでクリップされない。 */}
        {job && (
          <div
            className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-white border-2 border-[#3A2D6B] shadow-md flex items-center justify-center text-xl"
            role="img"
            aria-label={`職業: ${job.name}`}
          >
            <span aria-hidden="true">{job.emoji}</span>
          </div>
        )}
      </div>
      {/* 画像下: eyebrow / essence(肩書き) / 型名 h1 は「画像下のテキスト」として hideDecorations
          時にまとめて非表示 (キャラ名はトップバーへ移設済み)。判明ゲージは下で別途残す。
          ※ h1 内の変身演出 JobRevealName は revealKey 指定時のみ描画する設計だが、現在 /me は
          hideDecorations + revealKey 未指定のため、ここ (JobRevealName 含む) はどこにもマウント
          されない。コンポーネントは将来再利用のため温存し削除しない。 */}
      {!hideDecorations && (
        <div className="mt-3 flex flex-col items-center">
          {eyebrow && (
            <p className="text-[#3A2D6B]/70 font-bold text-xs mb-1">{eyebrow}</p>
          )}
          <p className="font-black text-2xl text-[#3A2D6B] leading-tight">
            {essence}
          </p>
        <h1 className="font-black text-3xl text-[#3A2D6B] leading-tight mb-3">
          {jobSlot ? (
            job ? (
              revealKey ? (
                // 判明時: 初回だけ「動物 → 演出 → 職業動物」の変身を再生 (以降は静的)。
                <JobRevealName
                  animal={jobSlot.animal}
                  jobName={job.name}
                  revealKey={revealKey}
                  forcePlay={forceReveal}
                />
              ) : (
                `${job.name}${jobSlot.animal}`
              )
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center min-w-[1.6em] px-1 rounded-lg border-2 border-dashed border-[#3A2D6B]/35 text-[#3A2D6B]/40"
                >
                  ？
                </span>
                {jobSlot.animal}
                <span className="sr-only">（職業は友達{jobSlot.threshold}人の評価で判明）</span>
              </span>
            )
          ) : (
            name
          )}
        </h1>
        </div>
      )}

      {/* 職業未定: 判明ゲージ (hideJobGauge で表示のみ抑止可。ロジックは不変) */}
      {jobSlot && !job && !hideJobGauge && (
        <div className="w-full max-w-[280px] mb-3">
          <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.2em] mb-1.5">
            あと {remaining} 人で職業が判明
          </p>
          <div
            className="w-full h-2.5 bg-card-border rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={jobSlot.friendCount}
            aria-valuemin={0}
            aria-valuemax={jobSlot.threshold}
            aria-label={`友達評価 ${jobSlot.friendCount} / ${jobSlot.threshold} 人`}
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
        <p className="balance-jp text-[#3A2D6B]/85 text-sm leading-relaxed max-w-[340px]">
          {description}
        </p>
      )}
    </div>
  );
}
