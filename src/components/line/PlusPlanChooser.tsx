"use client";

// Alice Plus LP のプラン選択UI (ラブ教授の選択画面を参考・2026-09-03 オーナー指示)。
// 「サブスクプラン(自動更新あり)」「買い切りプラン(自動更新なし)」の2グループに
// ラジオ行を並べ、下部固定CTAが選択中プランに追従する。
// LP本体はサーバーコンポーネントのため、選択状態が要るこの塊だけ切り出している。

import { useState } from "react";

type PlanId = "monthly" | "week" | "lifetime";

function RadioCircle({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
        selected ? "border-[#5B5BEF]" : "border-[#2E2E5C]/25"
      }`}
    >
      {selected && (
        <span className="h-2.5 w-2.5 rounded-full bg-[#5B5BEF]" />
      )}
    </span>
  );
}

export default function PlusPlanChooser({
  monthlyUrl,
  weekUrl,
  lifetimeUrl,
  weekAvailable,
  lifetimeAvailable,
  weekPassLabel,
}: {
  monthlyUrl: string;
  weekUrl: string;
  lifetimeUrl: string;
  weekAvailable: boolean;
  lifetimeAvailable: boolean;
  // 1週間パス利用中なら「◯月◯日」の期限ラベル (週パス行を「利用中」に固定する)
  weekPassLabel: string | null;
}) {
  const [selected, setSelected] = useState<PlanId>("monthly");

  const ctaHref: Record<PlanId, string> = {
    monthly: monthlyUrl,
    week: weekUrl,
    lifetime: lifetimeUrl,
  };

  const row = (
    id: PlanId,
    title: string,
    price: string,
    pills: { text: string; tone: "gold" | "indigo" }[],
    disabledLabel?: string,
  ) => {
    const isSelected = selected === id;
    const disabled = Boolean(disabledLabel);
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setSelected(id)}
        className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition ${
          isSelected
            ? "border-[#5B5BEF] bg-[#EDEAFB]/60"
            : "border-[#5B5BEF]/10 bg-white"
        } ${disabled ? "opacity-45" : "active:scale-[0.99]"}`}
      >
        <RadioCircle selected={isSelected} />
        <span className="flex-1">
          <span className="text-[14px] font-black text-[#2E2E5C]">
            {title}
            {/* 価格は Noto Sans JP 700 + tabular-nums (M PLUS は撤回 2026-09-04)。 */}
            <span className="ml-1.5 font-bold tabular-nums">{price}</span>
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          {disabledLabel ? (
            <span className="rounded-full bg-[#F4F1FB] px-2.5 py-1 text-[10px] font-black text-[#2E2E5C]/45">
              {disabledLabel}
            </span>
          ) : (
            pills.map((pill) => (
              <span
                key={pill.text}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  pill.tone === "gold"
                    ? "bg-[#FFD97A] text-[#5C4300]"
                    : "bg-[#EDEAFB] text-[#5B5BEF]"
                }`}
              >
                {pill.text}
              </span>
            ))
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <section className="mt-6 space-y-3">
        <h2 className="flex items-center gap-2 px-1 text-[16px] font-black text-[#2E2E5C]">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rotate-45 bg-[#FFD97A]"
          />
          プランをえらぶ
        </h2>
        {weekPassLabel && (
          <p className="rounded-xl bg-[#FFF6DE] px-4 py-3 text-[12px] font-bold leading-relaxed text-[#5C4300]">
            🎫 1週間パスを利用中です({weekPassLabel}
            まで)。月額プランに移ると、そのまま途切れずに続きます。
          </p>
        )}
        <div className="space-y-5 rounded-3xl border border-[#5B5BEF]/10 bg-white p-5 shadow-[0_12px_34px_rgba(36,26,79,0.08)]">
          <div className="space-y-2.5">
            <p className="text-[12px] font-black text-[#5B5BEF]">
              💠 サブスクプラン
              <span className="ml-1 font-bold text-[#2E2E5C]/40">
                (自動更新あり)
              </span>
            </p>
            {row("monthly", "1ヶ月", "¥480/月", [
              { text: "★オススメ", tone: "gold" },
              { text: "初回1週間無料", tone: "indigo" },
            ])}
          </div>
          {(weekAvailable || lifetimeAvailable) && (
            <div className="space-y-2.5">
              <p className="text-[12px] font-black text-[#5B5BEF]">
                💠 買い切りプラン
                <span className="ml-1 font-bold text-[#2E2E5C]/40">
                  (自動更新なし)
                </span>
              </p>
              {weekAvailable &&
                row(
                  "week",
                  "1週間",
                  "¥480",
                  [{ text: "おためしに", tone: "indigo" }],
                  weekPassLabel ? "利用中" : undefined,
                )}
              {lifetimeAvailable &&
                row("lifetime", "無期限", "¥9,800", [
                  { text: "ずっと使える", tone: "gold" },
                ])}
            </div>
          )}
        </div>
      </section>

      {/* 固定CTA: 選択中のプランに追従 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[#5B5BEF]/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <a
            href={ctaHref[selected]}
            className={`block w-full rounded-xl py-4 text-center text-[15px] font-black transition-transform active:scale-95 ${
              selected === "lifetime"
                ? "bg-gradient-to-r from-[#E8B93E] to-[#FFD97A] text-[#5C4300] shadow-[0_10px_26px_rgba(232,185,62,0.4)]"
                : "bg-gradient-to-r from-[#5B5BEF] to-[#7C5BEF] text-white shadow-[0_10px_26px_rgba(91,91,239,0.35)]"
            }`}
          >
            プランを選んで相談を続ける
          </a>
        </div>
      </div>
    </>
  );
}
