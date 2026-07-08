"use client";

// 他己診断 (タコ診断) ページ /tako/[token] のロック空状態。
// 友達の回答が解除条件 (3人) に満たないとき表示する。
//   - FV (2026-07-07): /aisho と同じ「左=見出し / 右=ループ動画」ヒーロー。
//     PC 横並び (見出し flex-1 / 動画 46%)、SP 縦積み (見出し→動画)。色は #2E2E5C 基準。
//   - FV の下: ロックカード (鍵/進捗) + QR 招待 (LockedInviteShare)。/me のロック表現に統一。
//     背景はネイビー階調のダミーを blur した「この先に結果がある」チラ見せ。
//   - 触れるのは QR・友達誘導・シェアのみ (LockedInviteShare が担う)。

import Image from "next/image";
import { useEffect, useRef } from "react";
import { LockedInviteShare } from "./LockedInviteShare";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";

// 3ステップ (他己診断の進み方)。accent=上アクセント帯/pill、tint=イラスト帯/pill 背景。
// 色はグループ色 (海=青/陸=緑/未知=紫) に対応させ、世界観に接続する。
// イラスト帯は画像スロット (あとで画像を入れる)。絵文字は使わない。
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

const REMAINING_VISUALS = {
  1: { src: "/tako/ato-1.png", width: 1525, height: 456 },
  2: { src: "/tako/ato-2.png", width: 1526, height: 456 },
  3: { src: "/tako/ato-3.png", width: 1525, height: 457 },
} as const;

type RemainingCount = keyof typeof REMAINING_VISUALS;

function remainingCount(friendCount: number, threshold: number): RemainingCount {
  const remaining = threshold - friendCount;
  if (remaining <= 1) return 1;
  if (remaining === 2) return 2;
  return 3;
}

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
      <svg
        viewBox="0 0 40 40"
        fill="none"
        className="h-8 w-8 md:h-9 md:w-9"
      >
        {icon === "sparkle" && (
          <>
            <path
              d="M20 5l3.4 9.5L33 18l-9.6 3.5L20 31l-3.4-9.5L7 18l9.6-3.5L20 5z"
              fill={color}
            />
            <path d="M10 27l1.4 3.8L15 32l-3.6 1.2L10 37l-1.4-3.8L5 32l3.6-1.2L10 27z" fill={color} opacity="0.55" />
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
            <path d="M15 12h10" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          </>
        )}
      </svg>
    </div>
  );
}

// FV 右側のループ動画。/aisho の HeroLoopVideo と同流儀 (autoPlay/muted/loop、
// prefers-reduced-motion で一時停止)。動画ファイル (/tako/hero-loop.mp4) 生成前でも
// 崩れないよう、コンテナに淡いグラデ背景と固定アスペクトを持たせる (差し替えは source のみ)。
function TakoHeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);
  return (
    // 動画は自然な縦横比で全体を表示 (見切れ防止)。読み込み前は淡いグラデ背景。
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="w-full rounded-3xl object-contain"
      style={{
        background:
          "linear-gradient(135deg, #EEF0FB 0%, #F6F3FC 50%, #EAF6F9 100%)",
      }}
    >
      <source src="/tako/hero-loop.mp4" type="video/mp4" />
    </video>
  );
}

interface TakoLockedStateProps {
  friendCount: number;
  threshold: number;
  inviteUrl: string;
}

export function TakoLockedState({
  friendCount,
  threshold,
  inviteUrl,
}: TakoLockedStateProps) {
  const remaining = remainingCount(friendCount, threshold);
  const remainingVisual = REMAINING_VISUALS[remaining];

  return (
    <div>
      {/* ===== FV: /aisho と同じ「左=見出し / 右=動画」ヒーロー (最上部) ===== */}
      <header className="mb-9 md:mb-14 md:flex md:items-center md:gap-12">
        <div className="md:flex-1">
          <h1
            className="font-black text-[29px] md:text-[36px] leading-[1.45] md:leading-[1.4]"
            style={{ color: NAVY }}
          >
            自分では気づけない
            <br className="md:hidden" />
            あなたを、
            <br className="hidden md:block" />
            友達に聞いてみよう。
          </h1>
          <p
            className="mt-2.5 text-[12.5px] md:text-sm font-bold"
            style={{ color: INACTIVE }}
          >
            友達に送るだけ・3人が答えると解ける
          </p>
        </div>
        <div className="mt-5 md:mt-0 md:w-[46%] md:max-w-[620px] md:shrink-0">
          <TakoHeroVideo />
        </div>
      </header>

      {/* ===== 結果解放セクション (背景色付きの帯)。友達招待(QR)＋あと○人ビジュアル。 ===== */}
      <div className="mb-10 rounded-3xl p-6 md:mb-12 md:px-9 md:py-6" style={{ background: "#EDEFFB" }}>
        <section className="md:flex md:items-center md:gap-9 lg:gap-12">
          {/* 左: 画像 (テキストは廃し、画像で内容を伝える) */}
          <div className="md:flex-1">
            {/* あと○人ビジュアル (フェルト調イラスト・透過PNG)。friendCount に合わせて出し分ける。 */}
            <div className="-mx-2 md:mx-0 md:max-w-[560px]">
              <Image
                src={remainingVisual.src}
                alt={`あと${remaining}人の回答で結果が解放`}
                width={remainingVisual.width}
                height={remainingVisual.height}
                unoptimized
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* 右: 招待 (QR + シェア)。唯一のカードとして行動を促す */}
          <div className="mt-5 md:mt-0 md:w-[38%] md:max-w-[360px] md:shrink-0">
            <LockedInviteShare inviteUrl={inviteUrl} compact />
          </div>
        </section>
      </div>

      {/* ===== 解放後に見えるもの。あと1人カードの直下で、回答を集める理由を補足する。 ===== */}
      <section className="mb-12 md:mb-16">
        <p
          className="mb-7 text-[17px] font-bold leading-relaxed md:mb-8 md:text-[19px]"
          style={{ color: INACTIVE }}
        >
          3人集まると、こんなことが見えます。
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

      {/* ===== 3ステップ (どう進むか)。MBTI 風: カードの真後ろに各グループ色 (海=青/陸=緑/
          未知=紫) の淡いグローを全幅で滲ませ、背景とカードを地続きに見せる。カードは枠線なし・
          イラスト帯は同じ tint の縦グラデ → 背景グローと色が繋がる。イラストは画像スロット。 ===== */}
      <section className="relative mb-12 md:mb-16">
        {/* 背景の模様(グロー)は一旦削除。復活させる場合はここに aria-hidden の
            グローブロック(ベースのラベンダーグラデ＋青/緑/紫の色ブロブ)を戻す。 */}

        {/* カード。SP=「左サムネ＋右テキスト」の横並びコンパクト行、PC=従来の縦カード(上帯)。
            背後のグローから浮かず、tint 帯で色が地続きになる。 */}
        {/* SP=1枚のカード(行を区切り線で連結・左に色アクセント帯を縦連続)、PC=従来の縦カード3列。
            背後のグローから浮かず、bg-white/95 で色が透ける。 */}
        <div className="relative z-10 overflow-hidden rounded-2xl bg-white/95 shadow-[0_14px_40px_rgba(46,46,92,0.10)] ring-1 ring-white/60 backdrop-blur-[2px] md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none md:ring-0 md:backdrop-blur-none">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="flex overflow-hidden md:block md:rounded-2xl md:bg-white/95 md:shadow-[0_14px_40px_rgba(46,46,92,0.10)] md:ring-1 md:ring-white/60 md:backdrop-blur-[2px]"
            >
              {/* アクセント: SP=左の縦帯(連続) / PC=上のライン */}
              <div className="w-1.5 shrink-0 md:hidden" style={{ background: s.accent }} />
              <div className="hidden h-1.5 md:block" style={{ background: s.accent }} />

              {/* 内容。SP の区切り線はこの内側(アクセント帯を除く範囲)に置き、帯を縦連続させる */}
              <div
                className={`flex min-h-[76px] min-w-0 flex-1 md:block md:min-h-0 ${
                  i > 0 ? "border-t border-[#ECECF3] md:border-t-0" : ""
                }`}
              >
                {/* イラスト = ステップ画像 (白背景フェルト調)。SP=左サムネ / PC=上帯。
                    白地に馴染ませるためスロットも白・object-contain・余白付き。
                    dev の画像 optimizer がこの種の PNG で固まるため unoptimized で配信。 */}
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

                {/* テキスト。SP=本文のみ(縦中央・見出しは隠す)、PC=ステップ番号+見出し+本文 */}
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
                  {/* 本文: 参考画像に合わせ、黒に近い色・軽めウェイトの角ゴシック(/me・/aisho と同じ体裁) */}
                  <p className="body-gothic text-[14px] font-normal leading-relaxed text-[#1A1A1A] md:mt-1.5 md:text-[13px]">
                    {s.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
