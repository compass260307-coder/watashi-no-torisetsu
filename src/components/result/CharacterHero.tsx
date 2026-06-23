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
  // 画像枠のアスペクト比 (Tailwind クラス)。既定は正方形。/me は横長 (aspect-[3/2]) で
  // ファーストビューの縦占有を抑える。object-cover でキャラ中心が見える位置に収める。
  imageAspectClassName?: string;
}

export function CharacterHero({
  imageSrc,
  alt,
  essence,
  name,
  description,
  eyebrow,
  jobSlot,
  imageAspectClassName = "aspect-square",
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
      {/* コンテンツカードと同じ横幅 (w-full)。アスペクトは imageAspectClassName で可変
          (既定 正方形 / me は横長)。背景込みシーンを cover で枠いっぱい・中心を見せる。 */}
      <div className="relative w-full">
        <div
          className={`w-full ${imageAspectClassName} rounded-[24px] overflow-hidden shadow-[0_10px_28px_rgba(58,45,107,0.16)]`}
        >
          <Image
            src={imageSrc}
            alt={alt}
            width={960}
            height={960}
            priority
            className="w-full h-full object-cover object-center"
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
      {/* essence + 型名: 型名は一回り大きく・font-black(900)・deepPurple・装飾なしのクリーン塗り。
          重ねは撤去し、スマホ/PC とも画像の下に通常配置 (重なりなし)。 */}
      <div className="mt-3 flex flex-col items-center">
        {eyebrow && (
          <p className="text-[#3A2D6B]/70 font-bold text-xs mb-1">{eyebrow}</p>
        )}
        {/* essence は現状維持 (text-2xl)、型名を一回り大きく (text-3xl) して主役に */}
        <p className="font-black text-2xl text-[#3A2D6B] leading-tight">
          {essence}
        </p>
        <h1 className="font-black text-3xl text-[#3A2D6B] leading-tight mb-3">
          {jobSlot ? (
            job ? (
              `${job.name}${jobSlot.animal}`
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

      {/* 職業未定: 判明ゲージ */}
      {jobSlot && !job && (
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

      {description && (
        // balance-jp: text-wrap:balance + word-break:auto-phrase (日本語の文節で均等折返し)
        <p className="balance-jp text-[#3A2D6B]/85 text-sm leading-relaxed max-w-[340px]">
          {description}
        </p>
      )}
    </div>
  );
}
