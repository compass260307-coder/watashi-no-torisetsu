// Phase 1.5-α: 結果ページ上のヒーロー (箱カードにしない・ページ背景に自然に乗せる)。
//
// 構成: [丸枠キャラ画像] → essence(小・上) → タイプ名(大・下) → 短い説明。
// 見出しは .wtr-sub / .wtr-name (白フチ+黄ドロップ, deepPurple, M PLUS Rounded)。
// グリッド背景・装飾ヘッダー・シェアコード・フッターは付けない (= 保存画像専用)。
// 画像は幅高さ固定でレイアウトシフト防止。
//
// 使う場所: /me(自分の型) / /evaluate/result・/evaluate/sent(友達から見た型)。

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
      {/* キャラ主役級: コンテナ ~85% (最大 320px)。背景込みシーン画像を cover で枠いっぱい。
          白下地・縁は無し (画像自体がやわらかい背景)。角丸 + やわらか影のみ。 */}
      <div className="w-[85%] max-w-[320px] aspect-square rounded-[24px] overflow-hidden shadow-[0_10px_28px_rgba(58,45,107,0.16)] mb-3">
        <Image
          src={imageSrc}
          alt={alt}
          width={640}
          height={640}
          priority
          className="w-full h-full object-cover"
        />
      </div>
      {eyebrow && (
        <p className="text-[#3A2D6B]/70 font-bold text-xs mb-1">{eyebrow}</p>
      )}
      <p className="wtr-sub mb-1">{essence}</p>
      <h1 className="wtr-name mb-3">{name}</h1>
      {description && (
        <p className="text-[#3A2D6B]/85 text-sm leading-relaxed max-w-[300px]">
          {description}
        </p>
      )}
    </div>
  );
}
