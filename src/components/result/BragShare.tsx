"use client";

// 診断拡散シェア (拡散=新規診断を呼ぶ)。結果ページ (/me) と 他己アンロック (/tako) で共用。
//   - 目的: トップ / へ誘導する SNS 自慢文。評価依頼 (/friend) とは逆ベクトル。
//   - variant:
//       "prominent" … 主(評価シェア)と対等に目立たせる版 (枠線ボタン)。場所を離して混同回避。
//       "subtle"    … 淡グレー 11px テキストリンクの控えめ版 (従来の従トーン)。
//   - KPI: タップで share_clicked を発火。metadata.source で設置箇所 (result/tako) を測り分け。

import { useState } from "react";
import { track } from "@/lib/track";

const NAVY = "#2A3A5C";

interface BragShareProps {
  /** 自己タイプの称号 (例「詩人」) */
  essence: string;
  /** OCEAN コード表記 (高=大文字/低=小文字、例「OCeAN」) */
  code: string;
  /** 自己タイプのキャッチ一文 (末尾の「。」は本文で調整) */
  catchphrase: string;
  /** 遷移先トップ URL (絶対) */
  topUrl: string;
  /** 設置箇所。share_clicked の metadata.source に載せて後で測り分ける。 */
  source: "result" | "tako";
  /** 見た目。既定は控えめ (subtle)。 */
  variant?: "prominent" | "subtle";
}

export function BragShare({
  essence,
  code,
  catchphrase,
  topUrl,
  source,
  variant = "subtle",
}: BragShareProps) {
  const [copied, setCopied] = useState(false);

  const catchLine = `${catchphrase.replace(/。$/, "")}人らしい。`;
  const bragBody = `【私のトリセツ、できました🐧】\n私は「${essence} / ${code}」タイプでした。\n${catchLine}\n\nあなたは何タイプ？30秒で診断できるよ👇`;
  const bragFull = `${bragBody}\n${topUrl}`;
  const bragXUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    bragBody,
  )}&url=${encodeURIComponent(topUrl)}`;
  const bragLineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    bragFull,
  )}`;

  const fire = (channel: "x" | "line" | "copy") =>
    track("share_clicked", { metadata: { channel, kind: "brag", source } });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bragFull);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      fire("copy");
    } catch {
      // 無視
    }
  };

  const CAPTION = "この診断、面白かったら広めてね🐧";

  // ---- prominent: 主と対等に目立つ版 (枠線ボタン。主=塗り との差で役割を分ける) ----
  if (variant === "prominent") {
    const pill =
      "inline-flex items-center gap-1 rounded-full border-2 font-black text-xs px-4 py-2.5 bg-white transition-colors active:scale-95";
    return (
      <div
        className="rounded-3xl p-6 text-center"
        style={{ background: "#EEF1F7" }}
      >
        <h2 className="font-black text-base mb-1" style={{ color: NAVY }}>
          {CAPTION}
        </h2>
        <p className="text-xs mb-4" style={{ color: `${NAVY}B3` }}>
          友達に「あなたもやってみて」って送れる
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={bragXUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fire("x")}
            className={`${pill} hover:bg-[#2A3A5C] hover:text-white`}
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Xでシェア
          </a>
          <a
            href={bragLineUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fire("line")}
            className={`${pill} hover:bg-[#2A3A5C] hover:text-white`}
            style={{ borderColor: NAVY, color: NAVY }}
          >
            LINEで送る
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className={`${pill} hover:bg-[#2A3A5C] hover:text-white`}
            style={{ borderColor: NAVY, color: NAVY }}
          >
            {copied ? "コピーしました" : "リンクをコピー"}
          </button>
        </div>
      </div>
    );
  }

  // ---- subtle: 淡グレー 11px テキストリンク (従来の控えめ版) ----
  return (
    <div className="mt-4 pt-3 border-t border-[#2E2E5C]/10 text-center">
      <p className="text-[11px] font-bold text-[#9BA3B4] mb-1.5">{CAPTION}</p>
      <div className="flex items-center justify-center gap-3 text-[11px] font-bold">
        <a
          href={bragXUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fire("x")}
          className="text-[#9BA3B4] underline underline-offset-2 hover:text-[#2E2E5C] transition-colors"
        >
          Xでシェア
        </a>
        <span aria-hidden="true" className="text-[#9BA3B4]/50">
          ·
        </span>
        <a
          href={bragLineUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fire("line")}
          className="text-[#9BA3B4] underline underline-offset-2 hover:text-[#2E2E5C] transition-colors"
        >
          LINEで送る
        </a>
        <span aria-hidden="true" className="text-[#9BA3B4]/50">
          ·
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[#9BA3B4] underline underline-offset-2 hover:text-[#2E2E5C] transition-colors"
        >
          {copied ? "コピーしました" : "リンクをコピー"}
        </button>
      </div>
    </div>
  );
}
