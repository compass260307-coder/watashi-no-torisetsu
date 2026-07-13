"use client";

// 他己診断 /tako の「あと◯人で開く」ゲートの前面(主役)カード = シェア連動カウンター。
//   狙いは「カウントを減らしたくなる」体験 (他者が答えるほど自己理解が完成する核と一致)。
//   静的な数字表示ではなく、送る=減らすレバーが主役。
//
//   三層構造 (TakoRevealStage) の一番手前レイヤーとして載る。報酬チラ見せ(奥レイヤー)と
//   招待QRは親側が持つため、このカードは {見出し / 数字 / 診断中 / スロット / CTA} に専念する。
//   ほぼ不透明カード + 影で常にくっきり浮かせる (可読性担保)。
//
// 状態モデル: 各招待スロットは empty / pending(診断中) / answered。
//   remaining = threshold - answered、pending = 診断中(近似)、toSend = 空きスロット。
//   gate 解放は answered >= threshold (親 TakoLockedState 側の分岐に従う)。
//
// 世界観: 既存フェルトトークン内で完結 (NAVY / INACTIVE / ラベンダー / 点線ステッチ)。
//   新規カラーは足さない。モーションは数字・スロットのみ (globals.css の gate-* を使用)。
//   prefers-reduced-motion は globals.css 側で静止。
//
// パララックス競合対策: ドラッグ開始させたくない操作要素には data-no-drag を付ける
//   (親 TakoRevealStage が pointerdown 時に closest('[data-no-drag]') を見て握らない)。

import Image from "next/image";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";
const LAVENDER = "#5B5BEF";
const STITCH = "#C9DEF5"; // 点線ステッチ枠 (既存 friend-evaluation と同色)

// 頭文字プレースホルダの淡色トーン (顔画像が無い answered のフォールバック / FriendList と同系)。
const AVATAR_TONES = [
  { bg: "#EAF6FA", fg: "#3D9DB1" },
  { bg: "#FBF4DA", fg: "#C4A83F" },
  { bg: "#EAF6E5", fg: "#6DAA50" },
  { bg: "#F4F4FE", fg: "#5B5BEF" },
] as const;

export type GateAnsweredFriend = {
  perceptionId: string;
  name: string;
  /** 「その友達から見たあなた」のキャラ画像。null なら頭文字にフォールバック。 */
  imageSrc: string | null;
  /** 「その友達から見たあなた」の32型 (④ 詳細シートの表示用)。 */
  perceivedType32?: ThirtyTwoTypeId | null;
  /** その友達“本人”の32型 (Path1 相性ループ)。診断済み&リンク済みのときだけ非null。 */
  friendOwnType32?: ThirtyTwoTypeId | null;
};

interface TakoShareGateProps {
  answered: GateAnsweredFriend[];
  pendingCount: number;
  threshold: number;
  /** CTA タップ時の着地。既定は #tako-invite へスクロール (招待QRは親が描画)。 */
  onPrimaryAction?: () => void;
  /**
   * 再訪リビール(②)用。表示する answered 数を上書きする (演出中は lastSeen→server へ動く)。
   * 未指定なら answered.length を使う。
   */
  shownAnsweredCount?: number;
  /** 「◯人届いた！」バナー用。0/未指定なら非表示。 */
  deliveredCount?: number;
  /** 数字バウンドの再発火キー (増えるたびに1回バウンド)。 */
  bounceKey?: number;
  /** この index 以上の answered スロットを順次ポップ (演出の起点 lastSeen)。 */
  revealFromIndex?: number;
  /** ④ answered スロットのタップ (相性ループ)。index は answered 配列の位置。 */
  onAnsweredTap?: (index: number) => void;
}

// remaining ごとの見出しコピー。gate はロック時 (remaining>=1) のみ描画される想定。
function headingFor(remaining: number): string {
  if (remaining <= 0) return "開きました！";
  if (remaining === 1) return "ラストひとり！";
  if (remaining === 2) return "いい調子、あと2人";
  return "仲間を集めよう";
}

export function TakoShareGate({
  answered,
  pendingCount,
  threshold,
  onPrimaryAction,
  shownAnsweredCount,
  deliveredCount = 0,
  bounceKey = 0,
  revealFromIndex = 0,
  onAnsweredTap,
}: TakoShareGateProps) {
  const answeredCount = Math.min(
    shownAnsweredCount ?? answered.length,
    threshold,
  );
  const remaining = Math.max(0, threshold - answeredCount);
  // pending は残りスロットを超えない。answered+pending が threshold を超えないよう抑える。
  const pending = Math.max(0, Math.min(pendingCount, remaining));
  // 送る先 = まだ誰も触れていない空きスロット。
  const toSend = Math.max(0, remaining - pending);

  // スロット並び: [answered..., pending..., empty...] で threshold 個。
  type Slot =
    | { kind: "answered"; friend: GateAnsweredFriend; idx: number }
    | { kind: "pending" }
    | { kind: "empty" };
  const slots: Slot[] = Array.from({ length: threshold }, (_, i) => {
    if (i < answeredCount)
      return { kind: "answered", friend: answered[i], idx: i };
    if (i < answeredCount + pending) return { kind: "pending" };
    return { kind: "empty" };
  });

  // CTA ラベル (残数連動)。
  const ctaLabel =
    toSend > 0
      ? toSend === 1
        ? "ラスト1人に送る"
        : `あと${toSend}人に送る`
      : "回答をリマインド"; // toSend=0 かつ未解放: 全スロットが診断中/回答済みだが3人未満

  const handlePrimary = () => {
    if (onPrimaryAction) return onPrimaryAction();
    const el = document.getElementById("tako-invite");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div
      className="rounded-[28px] px-5 py-7 md:px-8 md:py-8 shadow-[0_22px_60px_rgba(46,46,92,0.22)] ring-1 ring-white/70 backdrop-blur-[5px]"
      style={{ background: "rgba(255,255,255,0.6)" }}
    >
      {/* ===== 再訪リビール: 「◯人届いた！」バナー (deliveredCount>0 のとき) ===== */}
      <div className="flex h-8 items-center justify-center">
        {deliveredCount > 0 && (
          <span
            key={bounceKey}
            className="animate-gate-slot-pop inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] md:text-[15px] font-black text-white"
            style={{ background: LAVENDER }}
          >
            <span aria-hidden="true">🎉</span>
            {deliveredCount}人届いた！
          </span>
        )}
      </div>

      {/* ===== 見出し (remaining で出し分け) ===== */}
      <h1
        className="mt-1 text-center font-black text-[26px] md:text-[34px] leading-[1.35]"
        style={{ color: NAVY }}
      >
        {headingFor(remaining)}
      </h1>

      {/* ===== ヒーロー数字: 「あと [N] 人で開く」。数字だけ圧倒的に主役。 ===== */}
      <div className="mt-3 flex items-end justify-center gap-2">
        <span
          className="pb-2 text-[18px] md:text-[22px] font-black"
          style={{ color: INACTIVE }}
        >
          あと
        </span>
        {/* 外=バウンド(到着時1回・keyで再発火) / 内=呼吸(常時)。transform を分けて共存させる。 */}
        <span
          key={bounceKey}
          className={
            bounceKey > 0
              ? "animate-gate-count-bounce inline-block"
              : "inline-block"
          }
        >
          <span
            className="animate-gate-breathe inline-block font-black leading-none tracking-tight"
            style={{
              color: LAVENDER,
              fontSize: "clamp(84px, 26vw, 152px)",
            }}
            aria-hidden="true"
          >
            {remaining}
          </span>
        </span>
        <span
          className="pb-2 text-[18px] md:text-[22px] font-black"
          style={{ color: INACTIVE }}
        >
          人で開く
        </span>
      </div>
      {/* スクリーンリーダー向けの等価テキスト (視覚は分割表示) */}
      <p className="sr-only">あと{remaining}人の回答で結果が開きます。</p>

      {/* ===== 診断中 (pending>0 のとき薄く) ===== */}
      <p
        className="mt-1 h-5 text-center text-[13px] md:text-[14px] font-bold"
        style={{ color: INACTIVE, opacity: pending > 0 ? 1 : 0 }}
        aria-hidden={pending === 0}
      >
        {pending > 0 ? `${pending}人が診断中…` : " "}
      </p>

      {/* ===== スロット3枠 ===== */}
      <ul className="mt-4 flex items-start justify-center gap-4 md:gap-7">
        {slots.map((slot, i) => (
          <li
            key={i}
            className="flex w-[88px] flex-col items-center gap-2 md:w-[104px]"
          >
            {slot.kind === "answered" ? (
              <AnsweredSlot
                friend={slot.friend}
                idx={slot.idx}
                revealDelayMs={
                  slot.idx >= revealFromIndex
                    ? (slot.idx - revealFromIndex) * 130
                    : 0
                }
                onTap={onAnsweredTap ? () => onAnsweredTap(slot.idx) : undefined}
              />
            ) : slot.kind === "pending" ? (
              <PendingSlot />
            ) : (
              <EmptySlot />
            )}
          </li>
        ))}
      </ul>

      {/* ===== CTA (画面の主役ボタン・いちばん大きく)。data-no-drag でドラッグ非開始。 ===== */}
      <div className="mt-7">
        <button
          type="button"
          onClick={handlePrimary}
          data-no-drag
          className="mx-auto flex w-full max-w-[420px] items-center justify-center gap-2 rounded-full px-6 py-4 text-[18px] md:text-[20px] font-black text-white shadow-[0_10px_30px_rgba(91,91,239,0.35)] transition-transform active:scale-[0.97]"
          style={{ background: LAVENDER }}
        >
          {ctaLabel}
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <p
          className="mt-2.5 text-center text-[12.5px] font-bold"
          style={{ color: INACTIVE }}
        >
          送るほど、みんなから見たあなたが完成する
        </p>
      </div>
    </div>
  );
}

// answered: 「その友達から見たあなた」の顔 + ニックネーム。onTap 有りならタップ可能 (④ 相性ループ)。
function AnsweredSlot({
  friend,
  idx,
  revealDelayMs = 0,
  onTap,
}: {
  friend: GateAnsweredFriend;
  idx: number;
  /** 再訪リビール時、順次ポップさせる遅延(ms)。 */
  revealDelayMs?: number;
  /** ④ タップで相性ループ詳細を開く。未指定なら非タップ。 */
  onTap?: () => void;
}) {
  const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
  const initial = (friend.name || "と").trim().charAt(0) || "と";

  const face = (
    <div
      className="animate-gate-slot-pop relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full md:h-[88px] md:w-[88px]"
      style={{ background: tone.bg, animationDelay: `${revealDelayMs}ms` }}
    >
      {friend.imageSrc ? (
        <Image
          src={friend.imageSrc}
          alt={`${friend.name}から見たあなた`}
          width={88}
          height={88}
          unoptimized
          className="h-full w-full object-contain"
        />
      ) : (
        <span
          className="text-[28px] font-black md:text-[34px]"
          style={{ color: tone.fg }}
        >
          {initial}
        </span>
      )}
      {/* 回答済みチェックの縫い付けバッジ */}
      <span
        className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white md:h-7 md:w-7"
        style={{ background: "#8FCE70" }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 6" />
        </svg>
      </span>
    </div>
  );

  const nameRow = (
    <span
      className="max-w-full truncate text-[13px] font-black md:text-[14px]"
      style={{ color: NAVY }}
    >
      {friend.name}
    </span>
  );

  if (!onTap) {
    return (
      <>
        {face}
        {nameRow}
      </>
    );
  }

  // タップ可能: 「押せる気配」は最小限 (淡いリング + 小さな「見る」チップ)。
  return (
    <button
      type="button"
      onClick={onTap}
      data-no-drag
      aria-label={`${friend.name}から見たあなたを見る`}
      className="group flex flex-col items-center gap-2 rounded-2xl outline-none transition-transform active:scale-95"
    >
      <span className="relative rounded-full ring-2 ring-transparent transition-[box-shadow] group-hover:ring-[#E0E3F3] group-focus-visible:ring-[#B9C0E8]">
        {face}
        {/* 押せる気配のミニチップ */}
        <span
          className="absolute -top-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black shadow-[0_2px_6px_rgba(46,46,92,0.15)]"
          style={{ color: LAVENDER }}
          aria-hidden="true"
        >
          見る
        </span>
      </span>
      {nameRow}
    </button>
  );
}

// pending: 点線ステッチ + ゆっくり明滅 + 「診断中」ラベル。
function PendingSlot() {
  return (
    <>
      <div
        className="animate-gate-slot-breathe flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed md:h-[88px] md:w-[88px]"
        style={{ borderColor: STITCH, background: "#F6F7FC" }}
        aria-hidden="true"
      >
        <span className="flex gap-1">
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: INACTIVE }}
            />
          ))}
        </span>
      </div>
      <span
        className="text-[13px] font-bold md:text-[14px]"
        style={{ color: INACTIVE }}
      >
        診断中
      </span>
    </>
  );
}

// empty: 点線ステッチの空フェルト枠。
function EmptySlot() {
  return (
    <>
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed md:h-[88px] md:w-[88px]"
        style={{ borderColor: STITCH, background: "#F9FAFE" }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke={STITCH}
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 6v12M6 12h12" />
        </svg>
      </div>
      <span
        className="text-[13px] font-bold md:text-[14px]"
        style={{ color: "#C4CBD8" }}
      >
        あきスロット
      </span>
    </>
  );
}
