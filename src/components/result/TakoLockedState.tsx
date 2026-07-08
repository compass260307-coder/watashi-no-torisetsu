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
      <div
        className="mb-10 md:mb-14 rounded-3xl p-8 md:px-10 md:py-12"
        style={{ background: "#EDEFFB" }}
      >
        <section className="md:flex md:items-center md:gap-12">
          {/* 左: 進捗ドット + 画像 (テキストは廃し、画像で内容を伝える) */}
          <div className="md:flex-1">
            {/* 進捗ドット。SP では画像/QR/ピルと同じ 288px 幅に揃える (mx-auto)。 */}
            <div
              className="mx-auto flex max-w-[340px] items-center gap-2 md:mx-0 md:max-w-none"
              role="progressbar"
              aria-valuenow={friendCount}
              aria-valuemin={0}
              aria-valuemax={threshold}
            >
              {Array.from({ length: threshold }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${
                    i < friendCount ? "bg-[#5B5BEF]" : "bg-[#2E2E5C]/15"
                  }`}
                />
              ))}
            </div>

            {/* あと○人ビジュアル (フェルト調イラスト・透過PNG)。テキストの代わりにこの画像で伝える。
                dev の画像 optimizer 対策で unoptimized 配信。画像は「あと3人」固定 (人数別に差し替え可)。 */}
            <div className="mt-5 -mx-4 md:mx-0 md:max-w-[540px]">
              <Image
                src="/tako/ato-3.png"
                alt="あと3人の回答で結果が解放"
                width={1444}
                height={400}
                unoptimized
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* 右: 招待 (QR + シェア)。唯一のカードとして行動を促す */}
          <div className="mt-4 md:mt-0 md:w-[42%] md:max-w-[420px] md:shrink-0">
            <LockedInviteShare inviteUrl={inviteUrl} />
          </div>
        </section>
      </div>

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
