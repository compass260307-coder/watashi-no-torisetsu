// 友達診断 (/tako) のロックブロック (tako_unlock 未購入時)。
// /me の第二部ロックと同じ見せ方: ぼかしたデコイ本文の上に、
// 白い解錠カード (🔒 + 価格 + 解錠ボタン) を重ねる。
// 実本文はサーバで解決しない (フェイルクローズ)。ここに来るのはデコイだけ。

import { PaywallScrollButton } from "./PaywallScrollButton";

// ぼかしの背後に敷くデコイ (実データは使わない)。ぼかし前提なので中身は汎用文。
const DECOY_ITEMS = [
  { title: "気づかいの名人", body: "さりげないフォローに、周りはちゃんと気づいてる。" },
  { title: "場を明るくする力", body: "いるだけで空気が華やぐ人。一緒の時間が記憶に残る。" },
  { title: "約束を守る誠実さ", body: "言ったことをちゃんとやる姿に、株が上がってる。" },
  { title: "ブレない自分軸", body: "流されない意見の強さが、頼りがいとして映ってる。" },
  { title: "動じない包容力", body: "何があっても慌てない落ち着きが、安心になってる。" },
  { title: "世界が広がる面白さ", body: "新しい遊びも話題も、次々見つけてくる人。" },
] as const;

export function TakoLockedBlock({
  description,
  source = "tako_lock",
}: {
  /** セクション別の説明文 (課金感を出さない一文。/me の解除カードと同トーン)。 */
  description: string;
  /** 課金ファネル計測の設置場所ID (paywall-source の allowlist に載せること)。
      セクション別に分けると ¥799 の導線別テーブルでカード単位の比較ができる。 */
  source?: string;
}) {
  return (
    <div className="relative">
      {/* デコイ (ぼかし・操作不可・コピー不可) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[7px]"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          {DECOY_ITEMS.map((it) => (
            <div key={it.title}>
              <p className="mb-1 text-[15px] font-black text-[#2E2E5C]">
                {it.title}
              </p>
              <p className="body-gothic text-[14px] leading-[1.6] text-[#1A1A1A]">
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 解錠カード (/me の第二部ロックと同じトーン) */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="relative w-full max-w-[360px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] bg-white/95 px-6 pb-6 pt-8 text-center shadow-[0_12px_36px_rgba(46,46,92,0.18)] backdrop-blur-sm">
          <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          <p className="mb-2 text-[16px] font-black text-[#2E2E5C]">
            今すぐロックを解除
          </p>
          <p className="mb-4 text-[13px] font-bold leading-[1.75] text-[#8A8AA3]">
            {description}
          </p>
          {/* CTA: 最下部の課金カード (#tako-promo) へスクロール (/me の解除カードと同挙動) */}
          <PaywallScrollButton
            source={source}
            targetId="tako-promo"
            className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
          >
            今すぐアクセス
          </PaywallScrollButton>
        </div>
      </div>
    </div>
  );
}
