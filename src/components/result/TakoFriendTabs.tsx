"use client";

// /tako 友達タブ (2026-07-18 1人完結モデル):
//   友達1人ごとに独立した結果シートができ、名前タブで切り替える。
//   平均 (みんなの目) は廃止。パネル本体はサーバで全員ぶん描画済みを props で受け取り、
//   ここでは表示切替だけを行う (本文の再計算・データ取得をクライアントでしない)。
//   タブ末尾の「＋招待」はページ下部の招待セクション (#tako-invite) へのアンカー。

import { useState, type ReactNode } from "react";

const NAVY = "#2E2E5C";
const INDIGO = "#5B5BEF";

// タブ表示用: 自由入力の名前が長いときの折返し崩れを防ぐ (表示のみ切り詰め)。
function tabLabel(name: string): string {
  const trimmed = name.trim() || "ともだち";
  return trimmed.length > 8 ? `${trimmed.slice(0, 8)}…` : trimmed;
}

export function TakoFriendTabs({
  names,
  panels,
  inviteHref = "#tako-invite",
}: {
  /** 友達の表示名 (panels と同順)。 */
  names: string[];
  /** 友達ごとの結果シート (サーバ描画済み・names と同順)。 */
  panels: ReactNode[];
  inviteHref?: string;
}) {
  const [idx, setIdx] = useState(0);

  return (
    <div>
      {/* ── 名前タブ (横スクロール可) ── */}
      <div
        role="tablist"
        aria-label="友達ごとの結果"
        className="scrollbar-none -mx-4 mb-6 flex items-center gap-2 overflow-x-auto px-4 pt-4 md:mx-0 md:px-0"
      >
        {names.map((name, i) => {
          const selected = i === idx;
          return (
            <button
              key={i}
              role="tab"
              aria-selected={selected}
              onClick={() => setIdx(i)}
              className="flex-shrink-0 rounded-full border-[3px] px-5 py-2 text-[14px] font-black transition-colors"
              style={
                selected
                  ? { background: INDIGO, borderColor: INDIGO, color: "#fff" }
                  : { background: "#fff", borderColor: "#E3E6F5", color: NAVY }
              }
            >
              {tabLabel(name)}
            </button>
          );
        })}
        {/* ＋招待: 下部の招待セクションへ */}
        <a
          href={inviteHref}
          className="flex-shrink-0 rounded-full border-[3px] border-dashed px-5 py-2 text-[14px] font-black"
          style={{ background: "#fff", borderColor: "#C9CDF0", color: INDIGO }}
        >
          ＋招待
        </a>
      </div>

      {/* ── 選択中の友達の結果シート (非選択は DOM に残さず切替。パネルは軽い純描画) ── */}
      {panels[idx]}
    </div>
  );
}
