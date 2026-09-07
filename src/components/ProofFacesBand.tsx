// 利用者数の実績バンド (中央に人数、周囲に笑顔アバターが浮遊 + 星スパークル)。
// /unmei LP で作った実績ストリップの中身を共有化したもの (2026-08-02、/tako 待機ページにも
// 設置するため)。アニメーションは globals.css の face-float / star-twinkle。
//
// 人数は計測集計の実数スナップショット。増える一方なので「以上」表記は常に正だが、
// 定期的に最新値へ更新する (lib/proof-stats.ts の定数を直すだけでよい):
//   - 既定 (/unmei ほか): 無料診断の累計完了者数 DIAGNOSIS_COUNT_SNAPSHOT
//   - /tako 待機ページ: 友達診断の回答完了者数 1,458人 (呼び出し側で props 指定)
//
// 顔は ChatGPT生成の「実在しない人物」の笑顔ポートレート (public/proof-faces。
// 元グリッド1536×1024から384px角で切り出し)。実在の人物ではないため肖像権・写真
// ライセンスの問題はない。「写真はイメージです」注記は一度入れたがオーナー判断で
// 削除 (2026-08-02)。再度必要になったら人数テキスト <p> 末尾に text-[10px] で戻す。

import { SmoothImage } from "@/components/ui/SmoothImage";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";

// 位置・サイズ・角度・アニメ遅延は固定値 (Math.random だと SSR と hydration がズレる)。
// 男女が交互になる並び。SP (バンド幅 ~358px) でも中央テキストと重ならない配置にする。
const FLOATING_FACES: {
  src: string;
  pos: React.CSSProperties;
  size: number;
  rotate: number;
  delay: number;
}[] = [
  { src: "/proof-faces/face-1.webp", pos: { left: "4%", top: "4%" }, size: 60, rotate: -8, delay: 0 },
  { src: "/proof-faces/face-5.webp", pos: { left: "20%", top: "-10%" }, size: 60, rotate: 10, delay: 0.3 },
  { src: "/proof-faces/face-3.webp", pos: { right: "20%", top: "-8%" }, size: 60, rotate: -10, delay: 0.6 },
  { src: "/proof-faces/face-2.webp", pos: { right: "5%", top: "6%" }, size: 60, rotate: 8, delay: 0.9 },
  { src: "/proof-faces/face-7.webp", pos: { left: "0%", top: "52%" }, size: 60, rotate: 5, delay: 1.2 },
  { src: "/proof-faces/face-6.webp", pos: { right: "0%", top: "48%" }, size: 60, rotate: -6, delay: 1.8 },
  { src: "/proof-faces/face-4.webp", pos: { left: "14%", top: "88%" }, size: 60, rotate: 7, delay: 1.5 },
  { src: "/proof-faces/face-8.webp", pos: { right: "13%", top: "90%" }, size: 60, rotate: -5, delay: 2.1 },
];

// 装飾スパークル (星モチーフ)。淡インディゴ+黄の2系統でゆっくり明滅させ、白地の余白を
// 埋める。位置は SP (~358px) で顔・テキストの両方と重ならない座標に固定
// (顔の座標を動かすときはここも見直す)。
const SPARKLES: {
  pos: React.CSSProperties;
  size: number;
  color: string;
  delay: number;
}[] = [
  { pos: { left: "22%", top: "16%" }, size: 12, color: "#8F8FF0", delay: 0 },
  { pos: { right: "24%", top: "14%" }, size: 10, color: "#FFD34D", delay: 0.7 },
  { pos: { left: "7%", top: "78%" }, size: 10, color: "#FFD34D", delay: 1.3 },
  { pos: { right: "6%", top: "80%" }, size: 13, color: "#C7C7F5", delay: 0.4 },
  { pos: { left: "44%", top: "0%" }, size: 9, color: "#C7C7F5", delay: 1.8 },
  { pos: { right: "36%", top: "90%" }, size: 11, color: "#FFE08A", delay: 1.0 },
  { pos: { left: "11%", top: "38%" }, size: 8, color: "#C7C7F5", delay: 2.2 },
  { pos: { right: "12%", top: "34%" }, size: 9, color: "#FFD34D", delay: 1.6 },
];

export function ProofFacesBand({
  className = "",
  lead = "これまでに",
  count = DIAGNOSIS_COUNT_SNAPSHOT,
  countSuffix = "人以上",
  tail = "が自分のトリセツを診断しています",
}: {
  className?: string;
  /** 人数の前の行 (例: これまでに)。 */
  lead?: string;
  /** 大きく出す人数 (カンマ区切り文字列)。 */
  count?: string;
  /** 人数の直後に小さく付ける単位 (例: 人以上)。 */
  countSuffix?: string;
  /** 人数の後の行。助詞から始めてよい (人数行から一文につながって読まれる)。 */
  tail?: string;
}) {
  return (
    /* PC はヒーロー/コンテンツの内側幅 (1080px) に揃える */
    <section
      className={`relative mx-auto max-w-[640px] py-2 md:max-w-[1080px] md:py-3 ${className}`}
    >
      <div aria-hidden="true">
        {FLOATING_FACES.map((f) => (
          <span
            key={f.src}
            className="absolute"
            style={{
              ...f.pos,
              width: f.size,
              height: f.size,
              transform: `rotate(${f.rotate}deg)`,
            }}
          >
            <span
              className="animate-face-float relative block h-full w-full overflow-hidden rounded-full bg-white shadow-[0_4px_14px_rgba(46,46,92,0.14)] ring-2 ring-white"
              style={{ animationDelay: `${f.delay}s` }}
            >
              <SmoothImage
                src={f.src}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            </span>
          </span>
        ))}
        {SPARKLES.map((s, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            fill="currentColor"
            className="animate-star-twinkle absolute"
            style={{
              ...s.pos,
              width: s.size,
              height: s.size,
              color: s.color,
              animationDelay: `${s.delay}s`,
            }}
          >
            {/* 4方向スパークル (キラッ) */}
            <path d="M12 0c1 6.6 5.4 11 12 12-6.6 1-11 5.4-12 12-1-6.6-5.4-11-12-12C6.6 11 11 6.6 12 0Z" />
          </svg>
        ))}
      </div>
      <p className="relative z-10 mx-auto max-w-[280px] py-8 text-center md:max-w-none md:py-10">
        <span className="block text-[14px] font-bold text-[#2E2E5C]/60 md:text-[18px]">
          {lead}
        </span>
        <span className="mt-1.5 block leading-none md:mt-2.5">
          <span className="relative inline-block text-[36px] font-black leading-none text-[#2E2E5C] md:text-[56px]">
            {/* 蛍光マーカー風の黄下線 (鑑定表示の紺・黄トーンと同系) */}
            <span
              aria-hidden="true"
              className="absolute -inset-x-1.5 bottom-0 h-[13px] rounded-[4px] bg-[#FFE58A]/80 md:h-[20px]"
            />
            <span className="relative">
              {count}
              <span className="ml-1 text-[20px] md:text-[30px]">{countSuffix}</span>
            </span>
          </span>
        </span>
        <span className="mt-2.5 block text-[15px] font-bold text-[#2E2E5C]/60 md:mt-3.5 md:text-[19px]">
          {tail}
        </span>
      </p>
    </section>
  );
}
