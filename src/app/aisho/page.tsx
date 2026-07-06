// 相性診断ページ /aisho
//
// 32タイプから2つ選んで相性を見る、診断不要の回遊コンテンツ。
// 完全静的 (Supabase/セッション/owner_token 不要)。?a=&b= のクエリ駆動でシェア可。
// ロジックは lib/aisho-compat.ts (テーブル直引き・数値化なし)。
// 配色はネイビー #2A3A5C 直書き・非アクティブ #9BA3B4・グループ色は THIRTY_TWO_GROUP_COLOR。
// アイコンは依存ライブラリ不使用・インラインSVG (BottomNav.tsx 流儀)。

"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  allThirtyTwoTypeIds,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoGroup,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { type ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { compat, type AxisKey } from "@/lib/aisho-compat";
import { sceneLines, type SceneKey } from "@/lib/aisho-scene-copy";
import characterImages from "@/generated/character-images.json";
import TopHeader from "@/components/top/TopHeader";

// 結果ページ (/me) と同じブランドネイビーに統一 (旧 #2A3A5C)。
const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";

// /me ヒーロー帯と同じグループ別ミディアムトーン (白文字が立つ濃さ)。
const HERO_BAND_BY_GROUP: Record<ThirtyTwoGroup, string> = {
  sea: "#5BC6DB",
  sky: "#EDCF62",
  land: "#8FCE70",
  unknown: "#B49BE8",
};

// キャラ画像: /me と同じく背景除去済みの透過版 (characters/cut) を優先し、
// 無いタイプのみ v3 原画へフォールバック (ヒーロー帯に自然に乗せるため)。
function heroImagePath(id: ThirtyTwoTypeId): string {
  const v3 = thirtyTwoImagePath(id);
  const file = v3.split("/").pop() ?? "";
  return characterImages.cut.includes(file) ? `/characters/cut/${file}` : v3;
}

// カードのサムネ: 顔ズーム版 (characters/face・16P の顔アバター風) があれば優先。
// 無いタイプは v3 原画のまま。face 版は丸抜き、v3 は角丸で表示する。
function faceImagePath(id: ThirtyTwoTypeId): { src: string; isFace: boolean } {
  const v3 = thirtyTwoImagePath(id);
  const file = v3.split("/").pop() ?? "";
  // 空配列だと JSON から never[] に推論されるため string[] に明示キャスト
  return (characterImages.face as string[]).includes(file)
    ? { src: `/characters/face/${file}`, isFace: true }
    : { src: v3, isFace: false };
}

// グループ = base16 の E×O (実データ確認済み)。二軸ラベルは E(外向/内向)×O(感性/現実)。
//   空 E−O＋=内向×感性 / 陸 E＋O−=外向×現実 / 海 E＋O＋=外向×感性 / 未知 E−O−=内向×現実
// 表示順は /types の帯と同じ 海→陸→空→未知。
const GROUP_META: {
  key: ThirtyTwoGroup;
  label: string;
}[] = [
  { key: "sea", label: "海" },
  { key: "land", label: "陸" },
  { key: "sky", label: "空" },
  { key: "unknown", label: "未知" },
];

// /types の帯と同じペール色 (v3 キャラ画像の背景色そのもの) と濃色見出し・斜めカット。
const BAND_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#FDEFB4",
  sea: "#BEF2F9",
  land: "#D8F2C0",
  unknown: "#E7DCFB",
};
// グループ名の文字色 = 各グループ色の濃いバージョン (/types の DARK_COLOR と同じ値。
// 白だとペール帯とのコントラストが足りず読みにくい)。
const DARK_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#8F6B14",
  sea: "#1D6E86",
  land: "#3F7A2E",
  unknown: "#6C4EB8",
};


const ALL_IDS = allThirtyTwoTypeIds();
const VALID = new Set<string>(ALL_IDS);

function isValid(id: string | null): id is ThirtyTwoTypeId {
  return id !== null && VALID.has(id);
}

function sectionId(key: ThirtyTwoGroup): string {
  return `aisho-group-${key}`;
}

// ---- インラインSVG (依存ライブラリ不使用) --------------------------------

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke={NAVY}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// ---- ヘッダーのループ動画 (kling 生成のアイドルループ) ---------------------
// autoplay + muted + loop。prefers-reduced-motion: reduce では再生しない。

function HeroLoopVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="w-full rounded-3xl object-cover"
    >
      <source src="/aisho/hero-loop.mp4" type="video/mp4" />
    </video>
  );
}

// ---- スロット (上部の選択枠) ---------------------------------------------

function Slot({
  id,
  label,
  onClear,
}: {
  id: ThirtyTwoTypeId | null;
  label: string;
  onClear: () => void;
}) {
  // 空/選択済みで高さが変わると選択のたびにレイアウトが揺れるため、両状態とも固定高。
  // 一覧カードと同じ文法: 白カードの上端から顔ズーム版キャラの頭をはみ出させ、
  // 体の切れ目はカード下端に揃えて隠す。名前はカードの下に出す (SP の幅でも破綻しない)。
  const CARD_H = "h-[96px] md:h-[150px]";
  if (!id) {
    return (
      <div className="flex-1">
        <div
          className={`${CARD_H} rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 px-2 text-center`}
          style={{ borderColor: INACTIVE, color: INACTIVE }}
        >
          <span className="text-2xl md:text-3xl leading-none">＋</span>
          <span className="text-xs md:text-sm font-bold">タップで選ぶ</span>
        </div>
        <p
          className="mt-1.5 text-center text-[11px] md:text-xs font-bold"
          style={{ color: INACTIVE }}
        >
          {label}
        </p>
      </div>
    );
  }
  const thumb = faceImagePath(id);
  return (
    <div className="flex-1">
      <div
        className={`relative ${CARD_H} rounded-2xl border-2 bg-white`}
        style={{ borderColor: NAVY }}
      >
        <button
          type="button"
          onClick={onClear}
          aria-label={`${thirtyTwoEssence(id)}を外す`}
          className="absolute top-1.5 right-1.5 z-10 rounded-full p-1 text-white"
          style={{ background: NAVY }}
        >
          <CloseIcon />
        </button>
        {thumb.isFace ? (
          <Image
            src={thumb.src}
            alt={thirtyTwoEssence(id)}
            width={300}
            height={300}
            className="absolute bottom-0 left-1/2 w-[120px] md:w-[190px] max-w-none -translate-x-1/2"
          />
        ) : (
          <Image
            src={thumb.src}
            alt={thirtyTwoEssence(id)}
            width={240}
            height={240}
            className="h-full w-full rounded-[14px] object-cover"
          />
        )}
      </div>
      <p
        className="mt-1.5 md:mt-2.5 text-center font-black text-sm md:text-lg leading-tight"
        style={{ color: NAVY }}
      >
        {thirtyTwoEssence(id)}
      </p>
    </div>
  );
}

// ---- シーンアイコン (インラインSVG・currentColor) -------------------------

function SceneIcon({ scene }: { scene: SceneKey }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (scene) {
    case "love": // heart
      return (
        <svg {...common}>
          <path d="M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" />
        </svg>
      );
    case "friend": // users
      return (
        <svg {...common}>
          <path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3" />
          <path d="M22 19v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
        </svg>
      );
    case "work": // briefcase
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
        </svg>
      );
    case "clash": // alert-circle
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
  }
}

// ---- 結果セクション見出し (/me の丸数字見出しと同じ文法) -------------------

function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <h3
      className="flex items-center gap-2.5 font-black text-[19px] mb-3"
      style={{ color: NAVY }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] text-white"
        style={{ background: NAVY }}
      >
        {n}
      </span>
      {title}
    </h3>
  );
}

// ---- 詳細ブロック (バランス / いいところ / 注意 / シーン別) ----------------
// ★将来の購入ゲート単位。%＋★＋サマリー(無料側)とは独立させ、後から
//   購入フラグでこのコンポーネントごとラップできるようにしてある (今回はゲートなし・常時表示)。

// 5軸メーターの表示ラベル (取扱説明書トーンの平易語)。
const AXIS_LABEL: Record<AxisKey, string> = {
  A: "思いやり",
  N: "情緒の安定",
  O: "価値観",
  C: "生活リズム",
  E: "社交バランス",
};
const AXIS_ORDER_VIEW: AxisKey[] = ["A", "N", "O", "C", "E"];

// スコア→判定マーク (◎/○/△)。数値の羅列より取説っぽく、直感的に読める。
function axisMark(v: number): string {
  return v >= 0.9 ? "◎" : v >= 0.5 ? "○" : "△";
}

function CompatDetail({ a, b }: { a: ThirtyTwoTypeId; b: ThirtyTwoTypeId }) {
  const r = useMemo(() => compat(a, b), [a, b]);
  const scenes = useMemo(() => sceneLines(a, b), [a, b]);
  return (
    <div className="mx-auto mt-8 max-w-[640px] space-y-9">
      {/* ① 二人のバランス (5軸メーター) */}
      <section>
        <SectionHeading n={1} title="二人のバランス" />
        <div
          className="rounded-2xl border bg-white px-4 py-4 space-y-3"
          style={{ borderColor: "#E3E6F5" }}
        >
          {AXIS_ORDER_VIEW.map((k) => {
            const v = r.s[k];
            return (
              <div key={k} className="flex items-center gap-3">
                <span
                  className="w-[86px] shrink-0 text-[12px] font-black"
                  style={{ color: NAVY }}
                >
                  {AXIS_LABEL[k]}
                </span>
                <div
                  className="h-2.5 flex-1 overflow-hidden rounded-full"
                  style={{ background: "#EEF1F7" }}
                  role="meter"
                  aria-valuenow={Math.round(v * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={AXIS_LABEL[k]}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(v * 100)}%`,
                      background: "#5B5BEF",
                    }}
                  />
                </div>
                <span
                  className="w-5 shrink-0 text-center text-[13px] font-black"
                  style={{ color: v >= 0.5 ? "#5B5BEF" : INACTIVE }}
                >
                  {axisMark(v)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ② 二人のいいところ (compat の goods = 相性を支えるトップ2軸) */}
      <section>
        <SectionHeading n={2} title="二人のいいところ" />
        <ul className="space-y-2.5">
          {r.goods.map((g) => (
            <li
              key={g}
              className="flex items-start gap-2.5 rounded-2xl border bg-white px-4 py-3"
              style={{ borderColor: "#E3E6F5" }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "#5B5BEF" }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
                {g}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ③ ここだけ注意 (compat の caution。ゆるい警告トーン) */}
      <section>
        <SectionHeading n={3} title="ここだけ注意" />
        <div
          className="flex items-start gap-2.5 rounded-2xl border px-4 py-3"
          style={{ borderColor: "#F2E3B3", background: "#FFFBEF" }}
        >
          <span
            className="mt-0.5 shrink-0"
            style={{ color: "#C79A2A" }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 21.5 20h-19L12 3.5z" />
              <path d="M12 10v4.2M12 17.2h.01" />
            </svg>
          </span>
          <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
            {r.caution}
          </p>
        </div>
      </section>

      {/* ④ シーン別トリセツ (恋愛/友情/働く/すれ違い) */}
      <section>
        <SectionHeading n={4} title="シーン別トリセツ" />
        <div className="space-y-3">
          {scenes.map((s) => (
            <div
              key={s.key}
              className="rounded-2xl border bg-white px-4 py-3.5"
              style={{ borderColor: "#E3E6F5" }}
            >
              <div
                className="flex items-center gap-1.5 font-black text-sm mb-1.5"
                style={{ color: NAVY }}
              >
                <SceneIcon scene={s.key} />
                <span>{s.label}</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- 結果ブロック ---------------------------------------------------------
// /me ヒーローと同じ文法: グループ色の全幅帯 + 白抜きの大% + 斜めカットで白へ接続。

function ResultBlock({ a, b }: { a: ThirtyTwoTypeId; b: ThirtyTwoTypeId }) {
  const r = useMemo(() => compat(a, b), [a, b]);
  const bandA = HERO_BAND_BY_GROUP[thirtyTwoGroup(a)];
  const bandB = HERO_BAND_BY_GROUP[thirtyTwoGroup(b)];
  const dotColor = "rgba(255,255,255,0.55)";
  return (
    <section>
      {/* ===== ヒーロー帯 (全幅・2グループ色グラデ・斜めカット) ===== */}
      <div
        className="relative mx-[calc(50%-50vw)] w-screen overflow-hidden"
        style={{
          background: `linear-gradient(105deg, ${bandA} 0%, ${bandA} 38%, ${bandB} 62%, ${bandB} 100%)`,
          clipPath:
            "polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - clamp(20px, 3vw, 48px)))",
        }}
      >
        {/* 上部中央の放射状グロー + フェルトドット (/me と同じ装飾) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[240px]"
          style={{
            background:
              "radial-gradient(ellipse at top center, rgba(255,255,255,0.55) 0%, transparent 68%)",
          }}
        />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 10, height: 10, top: "14%", left: "7%" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 7, height: 7, top: "40%", left: "12%" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 12, height: 12, top: "18%", right: "8%" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 7, height: 7, top: "52%", right: "13%" }} />

        <div className="relative mx-auto max-w-[560px] px-4 pt-7 pb-10 text-center">
          <p className="text-[11px] font-black tracking-[0.25em] text-white/90">
            二人の相性
          </p>

          {/* 2キャラ対面 (透過版 cut を優先) */}
          <div className="mt-3 flex items-end justify-center gap-2">
            <div className="flex w-[132px] flex-col items-center">
              <Image
                src={heroImagePath(a)}
                alt={thirtyTwoEssence(a)}
                width={240}
                height={240}
                className="h-[116px] w-[116px] object-contain"
              />
              <span className="mt-1.5 text-[13px] font-black leading-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.18)]">
                {thirtyTwoEssence(a)}
              </span>
            </div>
            <div className="mb-9 text-white" aria-hidden="true">
              <HeartIcon />
            </div>
            <div className="flex w-[132px] flex-col items-center">
              <Image
                src={heroImagePath(b)}
                alt={thirtyTwoEssence(b)}
                width={240}
                height={240}
                className="h-[116px] w-[116px] object-contain"
              />
              <span className="mt-1.5 text-[13px] font-black leading-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.18)]">
                {thirtyTwoEssence(b)}
              </span>
            </div>
          </div>

          {/* 大% + 星 + サマリーピル (白抜き) */}
          <div className="mt-4 flex items-end justify-center text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.14)]">
            <span className="text-[64px] font-black leading-none">
              {r.percent}
            </span>
            <span className="mb-1.5 text-2xl font-black">%</span>
          </div>
          <div className="mt-2 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <svg
                key={n}
                viewBox="0 0 24 24"
                width={22}
                height={22}
                fill={n <= r.stars ? "#FFFFFF" : "none"}
                stroke="#FFFFFF"
                strokeWidth={1.6}
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ opacity: n <= r.stars ? 1 : 0.55 }}
              >
                <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 16.9l-5.2 2.73.99-5.8-4.21-4.1 5.82-.85L12 3.5z" />
              </svg>
            ))}
          </div>
          <span
            className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-black shadow-md"
            style={{ color: NAVY }}
          >
            {r.summary}
          </span>
        </div>
      </div>

      {/* --- 詳細 (将来ゲート単位・今回は常時表示) --- */}
      <CompatDetail a={a} b={b} />
    </section>
  );
}

// ---- グループ別グリッド ---------------------------------------------------

function TypeGrid({
  onPick,
  selected,
}: {
  onPick: (id: ThirtyTwoTypeId) => void;
  selected: Set<string>;
}) {
  const grouped = useMemo(
    () =>
      GROUP_META.map((g) => ({
        ...g,
        ids: ALL_IDS.filter((id) => thirtyTwoGroup(id) === g.key),
      })),
    [],
  );

  return (
    // 全幅色帯をそのまま積む (帯どうしの境界は水平)。
    <div className="mt-10 md:mt-14">
      {grouped.map((g, gi) => {
        const isLast = gi === grouped.length - 1;
        return (
          <section
            key={g.key}
            id={sectionId(g.key)}
            aria-label={`${g.label}グループ`}
            className="relative mx-[calc(50%-50vw)] w-screen"
            style={{ backgroundColor: BAND_COLOR[g.key] }}
          >
            {/* 列数は 2列 (SP) / 4列 (md 以上) のみ。1行8枚や3列は不自然なので使わず、
                画面幅にはカードの大きさ (可変カラム幅 + 大画面は max-w 拡大) で追従する */}
            {/* 最終帯はページ末尾 (下の白を無くし紫で終える) なので、
                固定ボトムナビに最終行が隠れないぶんの下余白を足す */}
            <div
              className={`mx-auto max-w-[1080px] px-4 md:px-8 2xl:max-w-[1400px] pt-9 md:pt-11 ${
                isLast ? "pb-20 md:pb-24" : "pb-12 md:pb-14"
              }`}
            >
              <h2
                className="font-black text-[28px] md:text-[36px] leading-none mb-4 md:mb-5"
                style={{ color: DARK_COLOR[g.key] }}
              >
                {g.label}グループ
              </h2>
              {/* 行間 (gap-y) は頭のはみ出し (約16px) が上のカードに触れない広さにする */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4 md:gap-x-4 md:gap-y-7">
                {g.ids.map((id) => {
                  const isSel = selected.has(id);
                  const thumb = faceImagePath(id);
                  if (thumb.isFace) {
                    /* 顔ズーム版 (透過): 台座は置かず、キャラの頭を白カードの
                       上端からはみ出させる (背面のグループ色帯に頭が重なる)。
                       体の四角い切れ目はカード下端に揃えて見えなくする。
                       画像の左端はカードの角丸 (r=16px) が終わる x=16px に置き、
                       下端フラッシュでも角がカード外にはみ出さないようにする。 */
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onPick(id)}
                        disabled={isSel}
                        aria-pressed={isSel}
                        className="relative flex h-[60px] md:h-[68px] items-center rounded-2xl bg-white pl-[96px] md:pl-[112px] pr-3 text-left transition-opacity shadow-[0_2px_10px_rgba(42,58,92,0.08)]"
                        style={{
                          border: isSel
                            ? `2px solid ${NAVY}`
                            : "2px solid transparent",
                          opacity: isSel ? 0.45 : 1,
                        }}
                      >
                        <Image
                          src={thumb.src}
                          alt={thirtyTwoEssence(id)}
                          width={168}
                          height={168}
                          className="absolute bottom-0 left-4 w-[72px] md:w-[84px] max-w-none"
                        />
                        {/* 役職名は画像を除いた残り幅の中央に置く */}
                        <span
                          className="flex-1 text-center font-black text-sm md:text-[15px] leading-tight"
                          style={{ color: NAVY }}
                        >
                          {thirtyTwoEssence(id)}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onPick(id)}
                      disabled={isSel}
                      aria-pressed={isSel}
                      className="rounded-2xl bg-white flex items-center gap-3 px-3 py-2 md:px-4 md:py-3 transition-opacity text-left shadow-[0_2px_10px_rgba(42,58,92,0.08)]"
                      style={{
                        border: isSel
                          ? `2px solid ${NAVY}`
                          : "2px solid transparent",
                        opacity: isSel ? 0.45 : 1,
                      }}
                    >
                      <Image
                        src={thumb.src}
                        alt={thirtyTwoEssence(id)}
                        width={96}
                        height={96}
                        className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover shrink-0"
                      />
                      <span
                        className="font-black text-sm md:text-[15px] leading-tight"
                        style={{ color: NAVY }}
                      >
                        {thirtyTwoEssence(id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---- 本体 -----------------------------------------------------------------

function AishoInner() {
  const searchParams = useSearchParams();
  // 初期値は ?a=&b= から (遅延初期化。effect内setStateを避ける)
  const [slotA, setSlotA] = useState<ThirtyTwoTypeId | null>(() => {
    const a = searchParams.get("a");
    return isValid(a) ? a : null;
  });
  const [slotB, setSlotB] = useState<ThirtyTwoTypeId | null>(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    return isValid(b) && b !== a ? b : null;
  });
  // 2枠そろっても即表示せず、「相性を見る」を押して初めて結果を出す（ワンクッション）。
  // 直リンク(?a=&b= 両方あり)は共有先で結果を見せたいので初期 revealed=true。
  const [revealed, setRevealed] = useState(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    return isValid(a) && isValid(b) && a !== b;
  });
  // 選択操作で2枠そろった直後の「診断中…」演出 (直リンクでは出さない)。
  const [analyzing, setAnalyzing] = useState(false);
  useEffect(() => {
    if (!analyzing) return;
    const t = setTimeout(() => {
      setAnalyzing(false);
      setRevealed(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [analyzing]);

  const bothFilled = slotA !== null && slotB !== null;
  const resultShown = bothFilled && revealed;
  const resultRef = useRef<HTMLDivElement>(null);

  // 選択変更で URL を書き換え (直リンク・シェア可)
  const syncUrl = useCallback((a: string | null, b: string | null) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, []);

  const selected = useMemo(() => {
    const s = new Set<string>();
    if (slotA) s.add(slotA);
    if (slotB) s.add(slotB);
    return s;
  }, [slotA, slotB]);

  const pick = useCallback(
    (id: ThirtyTwoTypeId) => {
      // 選ぶだけでは診断しない。2枠そろうと CTA「相性を見る」が押せるようになり、
      // 押した時に「診断中…」演出 → 結果表示。
      if (slotA === null) {
        setSlotA(id);
        syncUrl(id, slotB);
      } else if (slotB === null && id !== slotA) {
        setSlotB(id);
        syncUrl(slotA, id);
      }
    },
    [slotA, slotB, syncUrl],
  );

  const clearA = useCallback(() => {
    setSlotA(null);
    syncUrl(null, slotB);
    setRevealed(false);
    setAnalyzing(false);
  }, [slotB, syncUrl]);

  const clearB = useCallback(() => {
    setSlotB(null);
    syncUrl(slotA, null);
    setRevealed(false);
    setAnalyzing(false);
  }, [slotA, syncUrl]);

  // 結果が現れたらそこへスクロール（「相性を見る」tap・直リンク両対応）
  useEffect(() => {
    if (resultShown) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resultShown]);

  return (
    <>
    <TopHeader />
    <main className="min-h-screen overflow-x-clip bg-white">
      {/* コンテンツ幅は帯の中身 (TypeGrid 内) と同じ 1080/2xl:1400 に揃える */}
      <div className="max-w-[1080px] 2xl:max-w-[1400px] mx-auto px-4 md:px-8 pt-6 md:pt-10">
        {analyzing && slotA && slotB ? (
          /* ===== 診断中演出 (約1.6秒): 2キャラ対面 + 鼓動するハート ===== */
          <div className="flex min-h-[60vh] flex-col items-center justify-center">
            <div className="flex items-center gap-5 md:gap-8">
              <Image
                src={heroImagePath(slotA)}
                alt={thirtyTwoEssence(slotA)}
                width={280}
                height={280}
                className="w-[120px] md:w-[160px] object-contain"
              />
              <span
                className="animate-pulse"
                style={{ color: NAVY }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" width={34} height={34} fill="currentColor">
                  <path d="M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" />
                </svg>
              </span>
              <Image
                src={heroImagePath(slotB)}
                alt={thirtyTwoEssence(slotB)}
                width={280}
                height={280}
                className="w-[120px] md:w-[160px] object-contain"
              />
            </div>
            <p
              className="mt-7 text-[15px] md:text-base font-black"
              style={{ color: NAVY }}
              role="status"
            >
              二人の相性を診断中…
            </p>
          </div>
        ) : resultShown ? (
          /* ===== 結果モード (一覧は畳む) ===== */
          <>
            <div ref={resultRef} className="scroll-mt-4">
              <ResultBlock a={slotA} b={slotB} />
            </div>
            <div className="flex justify-center mt-6 pb-16">
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-black text-sm border-2 bg-white"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                <EditIcon />
                選び直す
              </button>
            </div>
          </>
        ) : (
          /* ===== 選択モード ===== */
          <>
            {/* ヘッダー: 左=見出し / 右=ループ動画 (16P のセクション見出し文法)。
                SP は縦積み (見出し→動画→スロット)。 */}
            <header className="mb-7 md:mb-12 md:flex md:items-center md:gap-12">
              <div className="md:flex-1">
                <h1
                  className="font-black text-[29px] md:text-[36px] leading-[1.45] md:leading-[1.4]"
                  style={{ color: NAVY }}
                >
                  気になるあの子との
                  <br className="md:hidden" />
                  相性を、
                  <br className="hidden md:block" />
                  診断してみよう。
                </h1>
                <p
                  className="mt-2.5 text-[12.5px] md:text-sm font-bold"
                  style={{ color: INACTIVE }}
                >
                  2キャラを選ぶだけ・自分の診断がなくてもOK
                </p>
              </div>
              <div className="mt-5 md:mt-0 md:w-[46%] md:max-w-[620px] md:shrink-0">
                <HeroLoopVideo />
              </div>
            </header>

            {/* 上部スロット: 結果ヒーローと同じ「2キャラ対面 + ハート」の文法。
                PC では小さな点線ボックスが余白に浮いて見えたため、一回り大きくする */}
            <div className="mx-auto flex max-w-[560px] md:max-w-[860px] items-stretch gap-3 md:gap-8">
              <Slot id={slotA} label="1人目" onClear={clearA} />
              {/* ハートはカード (名前ラベルを除く) の縦中央に合わせる */}
              <span
                className="self-start mt-[38px] md:mt-[65px] shrink-0"
                style={{ color: NAVY }}
                aria-hidden="true"
              >
                <HeartIcon />
              </span>
              <Slot id={slotB} label="2人目" onClear={clearB} />
            </div>

            {/* CTA: 2キャラそろうまでは薄色 (disabled)、そろったら押せる */}
            <div className="flex justify-center mt-6 md:mt-8">
              <button
                type="button"
                onClick={() => setAnalyzing(true)}
                disabled={!bothFilled}
                className="rounded-full px-12 py-3 md:px-14 md:py-3.5 text-white font-black text-base md:text-lg shadow-sm transition-all disabled:cursor-not-allowed"
                style={{
                  background: NAVY,
                  opacity: bothFilled ? 1 : 0.35,
                }}
              >
                相性を診断する
              </button>
            </div>

            {/* グループ別グリッド */}
            <TypeGrid onPick={pick} selected={selected} />
          </>
        )}
      </div>
    </main>
    </>
  );
}

export default function AishoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-sm font-bold" style={{ color: INACTIVE }}>
            読み込み中…
          </p>
        </main>
      }
    >
      <AishoInner />
    </Suspense>
  );
}
