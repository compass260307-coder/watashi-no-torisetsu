// 相性診断ページ /aisho
//
// 32タイプから2つ選んで相性を見る、診断不要の回遊コンテンツ。
// 完全静的 (Supabase/セッション/owner_token 不要)。?a=&b= のクエリ駆動でシェア可。
// ロジックは lib/aisho-compat.ts (テーブル直引き・数値化なし)。
// 配色はネイビー #2A3A5C 直書き・非アクティブ #9BA3B4・グループ色は THIRTY_TWO_GROUP_COLOR。
// アイコンは依存ライブラリ不使用・インラインSVG (BottomNav.tsx 流儀)。

"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  allThirtyTwoTypeIds,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoGroup,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import {
  THIRTY_TWO_GROUP_COLOR,
  type ThirtyTwoGroup,
} from "@/lib/thirty-two-content/character-32";
import { compat, type CompatResult } from "@/lib/aisho-compat";

const NAVY = "#2A3A5C";
const INACTIVE = "#9BA3B4";

// グループ = base16 の E×O (実データ確認済み)。二軸ラベルは E(外向/内向)×O(感性/現実)。
//   空 E−O＋=内向×感性 / 陸 E＋O−=外向×現実 / 海 E＋O＋=外向×感性 / 未知 E−O−=内向×現実
const GROUP_META: {
  key: ThirtyTwoGroup;
  emoji: string;
  label: string;
  axisLabel: string;
}[] = [
  { key: "sky", emoji: "🕊", label: "空", axisLabel: "内向×感性" },
  { key: "land", emoji: "🌿", label: "陸", axisLabel: "外向×現実" },
  { key: "sea", emoji: "🌊", label: "海", axisLabel: "外向×感性" },
  { key: "unknown", emoji: "✨", label: "未知", axisLabel: "内向×現実" },
];

const ALL_IDS = allThirtyTwoTypeIds();
const VALID = new Set<string>(ALL_IDS);

function isValid(id: string | null): id is ThirtyTwoTypeId {
  return id !== null && VALID.has(id);
}

function sectionId(key: ThirtyTwoGroup): string {
  return `aisho-group-${key}`;
}

// ---- インラインSVG (依存ライブラリ不使用) --------------------------------

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill={filled ? NAVY : "none"}
      stroke={filled ? NAVY : INACTIVE}
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 16.9l-5.2 2.73.99-5.8-4.21-4.1 5.82-.85L12 3.5z" />
    </svg>
  );
}

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

function ShuffleIcon() {
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
      <path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5" />
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
  if (!id) {
    return (
      <div
        className="flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 py-6 px-2 text-center"
        style={{ borderColor: INACTIVE, color: INACTIVE }}
      >
        <span className="text-3xl leading-none">＋</span>
        <span className="text-xs font-bold">タップで選ぶ</span>
        <span className="text-[10px]">{label}</span>
      </div>
    );
  }
  return (
    <div
      className="flex-1 relative rounded-2xl border-2 bg-white flex flex-col items-center py-4 px-2"
      style={{ borderColor: NAVY }}
    >
      <button
        type="button"
        onClick={onClear}
        aria-label={`${thirtyTwoEssence(id)}を外す`}
        className="absolute top-1.5 right-1.5 rounded-full p-1 text-white"
        style={{ background: NAVY }}
      >
        <CloseIcon />
      </button>
      <Image
        src={thirtyTwoImagePath(id)}
        alt={thirtyTwoEssence(id)}
        width={120}
        height={120}
        className="w-20 h-20 rounded-2xl object-cover"
      />
      <span
        className="mt-2 font-black text-base leading-tight"
        style={{ color: NAVY }}
      >
        {thirtyTwoEssence(id)}
      </span>
    </div>
  );
}

// ---- 詳細ブロック (良いところ2 / 注意1) ----------------------------------
// ★将来の購入ゲート単位。%＋★＋サマリー(無料側)とは独立させ、後から
//   購入フラグでこのコンポーネントごとラップできるようにしてある (今回はゲートなし・常時表示)。

function CompatDetail({ r }: { r: CompatResult }) {
  return (
    <div>
      {/* 良いところ 2 */}
      <div className="mt-6 space-y-2">
        <p className="font-black text-sm" style={{ color: NAVY }}>
          良いところ
        </p>
        {r.goods.map((g, i) => (
          <div
            key={i}
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={{ background: "#EEF1F7", color: NAVY }}
          >
            {g}
          </div>
        ))}
      </div>

      {/* 気をつけるところ 1 */}
      <div className="mt-4">
        <p className="font-black text-sm" style={{ color: NAVY }}>
          ここだけ気をつけると◎
        </p>
        <div
          className="mt-2 rounded-2xl px-4 py-3 text-sm leading-relaxed border-2"
          style={{ borderColor: INACTIVE, color: NAVY }}
        >
          {r.caution}
        </div>
      </div>
    </div>
  );
}

// ---- 結果ブロック ---------------------------------------------------------

function ResultBlock({ a, b }: { a: ThirtyTwoTypeId; b: ThirtyTwoTypeId }) {
  const r = useMemo(() => compat(a, b), [a, b]);
  return (
    <section
      className="rounded-3xl border-2 bg-white px-4 py-6 mt-2"
      style={{ borderColor: NAVY }}
    >
      {/* --- 無料側 (%＋★＋サマリー・ゲート対象外) --- */}
      {/* 2キャラ左右対面 */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center w-24">
          <Image
            src={thirtyTwoImagePath(a)}
            alt={thirtyTwoEssence(a)}
            width={120}
            height={120}
            className="w-24 h-24 rounded-2xl object-cover"
          />
          <span
            className="mt-1 font-black text-sm text-center leading-tight"
            style={{ color: NAVY }}
          >
            {thirtyTwoEssence(a)}
          </span>
        </div>
        <div style={{ color: NAVY }}>
          <HeartIcon />
        </div>
        <div className="flex flex-col items-center w-24">
          <Image
            src={thirtyTwoImagePath(b)}
            alt={thirtyTwoEssence(b)}
            width={120}
            height={120}
            className="w-24 h-24 rounded-2xl object-cover"
          />
          <span
            className="mt-1 font-black text-sm text-center leading-tight"
            style={{ color: NAVY }}
          >
            {thirtyTwoEssence(b)}
          </span>
        </div>
      </div>

      {/* 大% + 星 + サマリー1行 */}
      <div className="flex flex-col items-center mt-5">
        <div className="flex items-end" style={{ color: NAVY }}>
          <span className="font-black leading-none text-6xl">{r.percent}</span>
          <span className="font-black text-2xl mb-1">%</span>
        </div>
        <div className="flex gap-0.5 mt-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} filled={n <= r.stars} />
          ))}
        </div>
        <span
          className="mt-3 inline-block rounded-full px-4 py-1.5 text-white font-black text-sm"
          style={{ background: NAVY }}
        >
          {r.summary}
        </span>
      </div>

      {/* --- 詳細 (将来ゲート単位・今回は常時表示) --- */}
      <CompatDetail r={r} />
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
    <div className="mt-4 space-y-6">
      {grouped.map((g) => (
        <section key={g.key} id={sectionId(g.key)} className="scroll-mt-16">
          <h2
            className="flex items-center gap-2 font-black text-base mb-2"
            style={{ color: NAVY }}
          >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: THIRTY_TWO_GROUP_COLOR[g.key] }}
              aria-hidden="true"
            />
            <span>{g.emoji}</span>
            <span>{g.label}</span>
            <span className="text-xs font-bold" style={{ color: INACTIVE }}>
              {g.axisLabel}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {g.ids.map((id) => {
              const isSel = selected.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPick(id)}
                  disabled={isSel}
                  aria-pressed={isSel}
                  className="rounded-2xl border bg-white flex items-center gap-3 px-3 py-2 transition-opacity text-left"
                  style={{
                    borderColor: isSel ? NAVY : "#E1E4EC",
                    opacity: isSel ? 0.4 : 1,
                  }}
                >
                  <Image
                    src={thirtyTwoImagePath(id)}
                    alt={thirtyTwoEssence(id)}
                    width={72}
                    height={72}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                  <span
                    className="font-black text-sm leading-tight"
                    style={{ color: NAVY }}
                  >
                    {thirtyTwoEssence(id)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
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
  // 結果表示中はキャラ一覧を畳む。「選び直す」で editing=true にして再展開。
  const [editing, setEditing] = useState(false);

  const bothFilled = slotA !== null && slotB !== null;
  const resultShown = bothFilled && !editing;

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
      if (slotA === null) {
        setSlotA(id);
        syncUrl(id, slotB);
        if (slotB !== null) setEditing(false); // 2枠埋まった→結果へ
      } else if (slotB === null && id !== slotA) {
        setSlotB(id);
        syncUrl(slotA, id);
        setEditing(false); // 2枠埋まった→結果へ
      }
    },
    [slotA, slotB, syncUrl],
  );

  const clearA = useCallback(() => {
    setSlotA(null);
    syncUrl(null, slotB);
    setEditing(true);
  }, [slotB, syncUrl]);

  const clearB = useCallback(() => {
    setSlotB(null);
    syncUrl(slotA, null);
    setEditing(true);
  }, [slotA, syncUrl]);

  const shuffle = useCallback(() => {
    const i = Math.floor(Math.random() * ALL_IDS.length);
    let j = Math.floor(Math.random() * (ALL_IDS.length - 1));
    if (j >= i) j += 1; // i と重複しない別の1体
    setSlotA(ALL_IDS[i]);
    setSlotB(ALL_IDS[j]);
    setEditing(false);
    syncUrl(ALL_IDS[i], ALL_IDS[j]);
  }, [syncUrl]);

  const scrollToGroup = useCallback((key: ThirtyTwoGroup) => {
    if (typeof document === "undefined") return;
    document
      .getElementById(sectionId(key))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <main className="min-h-screen bg-[#F2EFE6] pb-16">
      <div className="max-w-[560px] mx-auto px-4 pt-6">
        {/* ヘッダー */}
        <header className="text-center mb-5">
          <h1 className="font-black text-2xl" style={{ color: NAVY }}>
            相性診断
          </h1>
          <p className="text-xs mt-1" style={{ color: INACTIVE }}>
            2キャラを選ぶと相性が出ます・診断不要
          </p>
        </header>

        {resultShown ? (
          /* ===== 結果モード (一覧は畳む) ===== */
          <>
            <ResultBlock a={slotA} b={slotB} />
            <div className="flex justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 font-black text-sm border-2 bg-white"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                <EditIcon />
                選び直す
              </button>
              <button
                type="button"
                onClick={shuffle}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-white font-black text-sm"
                style={{ background: NAVY }}
              >
                <ShuffleIcon />
                シャッフル
              </button>
            </div>
          </>
        ) : (
          /* ===== 選択モード ===== */
          <>
            {/* 上部スロット */}
            <div className="flex items-stretch gap-3">
              <Slot id={slotA} label="1人目" onClear={clearA} />
              <Slot id={slotB} label="2人目" onClear={clearB} />
            </div>

            {/* シャッフル */}
            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={shuffle}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-white font-black text-sm"
                style={{ background: NAVY }}
              >
                <ShuffleIcon />
                シャッフル
              </button>
            </div>

            <p className="text-center text-xs mt-4" style={{ color: INACTIVE }}>
              {slotA || slotB
                ? "もう1人選ぶと相性が表示されます"
                : "下からキャラを2人選んでね"}
            </p>

            {/* スティッキーのグループチップ (アンカージャンプ・フィルタではない) */}
            <div className="sticky top-0 z-10 -mx-4 mt-4 px-4 py-2 bg-[#F2EFE6]/95 backdrop-blur flex gap-2 justify-center">
              {GROUP_META.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => scrollToGroup(g.key)}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black bg-white"
                  style={{ borderColor: "#E1E4EC", color: NAVY }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: THIRTY_TWO_GROUP_COLOR[g.key] }}
                    aria-hidden="true"
                  />
                  {g.label}
                </button>
              ))}
            </div>

            {/* グループ別グリッド */}
            <TypeGrid onPick={pick} selected={selected} />
          </>
        )}
      </div>
    </main>
  );
}

export default function AishoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F2EFE6] flex items-center justify-center">
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
