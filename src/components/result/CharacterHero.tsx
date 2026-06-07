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

interface CharacterHeroProps {
  imageSrc: string;
  alt: string;
  essence: string; // 小・上 (例: 気まぐれロマンチスト)
  name: string; // 大・下 (例: きらめきウサギ)
  description?: string; // 短い説明 (型の essence 文 1〜3 行)
  eyebrow?: string; // 任意の上ラベル (例: 「{perceiver}が見た{owner}は」)
}

export function CharacterHero({
  imageSrc,
  alt,
  essence,
  name,
  description,
  eyebrow,
}: CharacterHeroProps) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      {/* コンテンツカードと同じ横幅 (w-full)・正方形。背景込みシーンを cover で枠いっぱい。 */}
      <div className="w-full aspect-square rounded-[24px] overflow-hidden shadow-[0_10px_28px_rgba(58,45,107,0.16)]">
        <Image
          src={imageSrc}
          alt={alt}
          width={960}
          height={960}
          priority
          className="w-full h-full object-cover"
        />
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
          {name}
        </h1>
      </div>
      {description && (
        // balance-jp: text-wrap:balance + word-break:auto-phrase (日本語の文節で均等折返し)
        <p className="balance-jp text-[#3A2D6B]/85 text-sm leading-relaxed max-w-[340px]">
          {description}
        </p>
      )}
    </div>
  );
}
