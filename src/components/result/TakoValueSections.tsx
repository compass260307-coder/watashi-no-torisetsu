// 他己診断まわりで共通の「価値説明」2セクション:
//   ① 3人集まると、こんなことが見えます。 (4項目グリッド)
//   ② 他己診断の進み方 3ステップ (友達にシェア → 友達が答える → あなたが解ける)
// 元は TakoLockedState 内にあった JSX を切り出し、タコのロック空状態と
// 友達の回答完了後の案内 (FriendIndividualGuide) の両方で同じ見た目を使えるようにする。
// props 無し・フックなしの静的表示なので Server Component のまま (Image のみ)。

import Image from "next/image";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";

// 3ステップ (他己診断の進み方)。accent=上アクセント帯/pill、tint=イラスト帯/pill 背景。
// 色はグループ色 (海=青/陸=緑/未知=紫) に対応させ、世界観に接続する。
const STEPS = [
  {
    n: 1,
    accent: "#5BC6DB",
    tint: "#EAF6F9",
    img: "/tako/steps/step1.png",
    title: "友達にシェア",
    desc: "リンクやQRコードを友達に送るだけ。あなたのことを聞いてみよう。",
  },
  {
    n: 2,
    accent: "#8FCE70",
    tint: "#EEF7E9",
    img: "/tako/steps/step2.png",
    title: "友達が答える",
    desc: "友達は5つの質問でサクッと回答。あなたの印象を教えてくれる。",
  },
  {
    n: 3,
    accent: "#B49BE8",
    tint: "#F1ECFA",
    img: "/tako/steps/step3.png",
    title: "あなたが解ける",
    desc: "3人が答えると「みんなから見たあなた」が完成する。",
  },
] as const;

const UNLOCK_PREVIEW_ITEMS = [
  {
    icon: "sparkle",
    color: "#69C7D8",
    title: "みんなから見たあなた",
    desc: "友達の回答をもとに、自分では気づきにくい印象や魅力を言葉にします。",
  },
  {
    icon: "compare",
    color: "#8FCE70",
    title: "自分とのギャップ",
    desc: "自己診断と友達の見え方を比べて、強みや意外な一面を見つけます。",
  },
  {
    icon: "chat",
    color: "#B49BE8",
    title: "関わり方のヒント",
    desc: "まわりが感じているあなたらしさから、仲良くなるコツを整理します。",
  },
  {
    icon: "check",
    color: "#F0B84D",
    title: "友達ごとの見え方",
    desc: "回答してくれた友達それぞれの印象も、あとから見返せる形で残ります。",
  },
] as const;

function UnlockPreviewIcon({
  icon,
  color,
}: {
  icon: (typeof UNLOCK_PREVIEW_ITEMS)[number]["icon"];
  color: string;
}) {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center bg-[#F7F8FC] md:h-16 md:w-16"
      style={{
        clipPath: "polygon(25% 7%, 75% 7%, 100% 50%, 75% 93%, 25% 93%, 0 50%)",
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" fill="none" className="h-8 w-8 md:h-9 md:w-9">
        {icon === "sparkle" && (
          <>
            <path
              d="M20 5l3.4 9.5L33 18l-9.6 3.5L20 31l-3.4-9.5L7 18l9.6-3.5L20 5z"
              fill={color}
            />
            <path
              d="M10 27l1.4 3.8L15 32l-3.6 1.2L10 37l-1.4-3.8L5 32l3.6-1.2L10 27z"
              fill={color}
              opacity="0.55"
            />
          </>
        )}
        {icon === "compare" && (
          <>
            <path
              d="M11 13h15l-4-4 2.6-2.6L33 14.8l-8.4 8.4L22 20.6l4-4H11V13z"
              fill={color}
            />
            <path
              d="M29 27H14l4 4-2.6 2.6L7 25.2l8.4-8.4 2.6 2.6-4 4h15V27z"
              fill={color}
              opacity="0.72"
            />
          </>
        )}
        {icon === "chat" && (
          <>
            <path
              d="M8 10.5A5.5 5.5 0 0113.5 5h13A5.5 5.5 0 0132 10.5v9A5.5 5.5 0 0126.5 25H18l-7.5 6v-6A5.5 5.5 0 018 19.5v-9z"
              fill={color}
            />
            <circle cx="15" cy="15" r="2" fill="white" opacity="0.9" />
            <circle cx="20" cy="15" r="2" fill="white" opacity="0.9" />
            <circle cx="25" cy="15" r="2" fill="white" opacity="0.9" />
          </>
        )}
        {icon === "check" && (
          <>
            <rect x="9" y="7" width="22" height="27" rx="5" fill={color} opacity="0.92" />
            <path
              d="M15 20.5l4 4 7-9"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 12h10"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.8"
            />
          </>
        )}
      </svg>
    </div>
  );
}

// leadText: グリッド上の導入コピー。文脈で差し替えられるよう props 化 (既定は tako ロック時の文言)。
// stepsFirst: true で「3ステップ → 4項目グリッド」の順に上下反転 (完了画面用)。
//   既定 false は tako ロック空状態の「グリッド → ステップ」順。
export function TakoValueSections({
  leadText = "3人集まると、こんなことが見えます。",
  stepsFirst = false,
}: {
  leadText?: string;
  stepsFirst?: boolean;
} = {}) {
  const gridSection = (
    <>
      {/* ===== 解放後に見えるもの (4項目グリッド) ===== */}
      <section className="mb-12 md:mb-16">
        <p
          className="mb-7 text-[17px] font-bold leading-relaxed md:mb-8 md:text-[19px]"
          style={{ color: INACTIVE }}
        >
          {leadText}
        </p>
        <div className="grid gap-8 md:grid-cols-2 md:gap-x-14 md:gap-y-10">
          {UNLOCK_PREVIEW_ITEMS.map((item) => (
            <div key={item.title} className="flex gap-4 md:gap-5">
              <UnlockPreviewIcon icon={item.icon} color={item.color} />
              <div className="min-w-0">
                <h3 className="text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
                  {item.title}
                </h3>
                <p className="body-gothic mt-2 text-[14px] font-normal leading-relaxed text-[#5F687A] md:text-[15px]">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const stepsSection = (
    <>
      {/* ===== 3ステップ (どう進むか)。SP=1枚のカード(行を区切り線で連結)、PC=縦カード3列。 ===== */}
      <section className="relative mb-12 md:mb-16">
        <div className="relative z-10 overflow-hidden rounded-2xl bg-white/95 shadow-[0_14px_40px_rgba(46,46,92,0.10)] ring-1 ring-white/60 backdrop-blur-[2px] md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none md:ring-0 md:backdrop-blur-none">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="flex overflow-hidden md:block md:rounded-2xl md:bg-white/95 md:shadow-[0_14px_40px_rgba(46,46,92,0.10)] md:ring-1 md:ring-white/60 md:backdrop-blur-[2px]"
            >
              {/* アクセント: SP=左の縦帯(連続) / PC=上のライン */}
              <div className="w-1.5 shrink-0 md:hidden" style={{ background: s.accent }} />
              <div className="hidden h-1.5 md:block" style={{ background: s.accent }} />

              <div
                className={`flex min-h-[76px] min-w-0 flex-1 md:block md:min-h-0 ${
                  i > 0 ? "border-t border-[#ECECF3] md:border-t-0" : ""
                }`}
              >
                <div className="relative w-20 shrink-0 self-stretch bg-white md:h-44 md:w-full">
                  <Image
                    src={s.img}
                    alt={s.title}
                    fill
                    unoptimized
                    sizes="(max-width: 767px) 80px, 340px"
                    className="object-contain p-1.5 md:p-3"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 md:block md:px-6 md:pt-0 md:pb-6">
                  <span
                    className="hidden rounded-full px-3 py-1 text-[11px] font-black md:inline-block"
                    style={{ background: s.tint, color: NAVY }}
                  >
                    ステップ{s.n}
                  </span>
                  <h3 className="hidden text-[19px] font-black text-[#2E2E5C] md:mt-3 md:block">
                    {s.title}
                  </h3>
                  <p className="body-gothic text-[14px] font-normal leading-relaxed text-[#1A1A1A] md:mt-1.5 md:text-[13px]">
                    {s.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <>
      {stepsFirst ? (
        <>
          {stepsSection}
          {gridSection}
        </>
      ) : (
        <>
          {gridSection}
          {stepsSection}
        </>
      )}
    </>
  );
}
