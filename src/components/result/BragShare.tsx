"use client";

// 診断拡散シェア (従)。結果ページ (/me) と 他己アンロック (/tako) で共用。
//   - 目的: 純粋な拡散 (新規診断を呼ぶ)。トップ / へ誘導。評価依頼 (主) とは逆ベクトル。
//   - 見た目: 淡グレー 11px テキストリンク。主 (評価シェア) の存在感を食わない従トーン。
//   - KPI: タップで share_clicked を発火。metadata.source で設置箇所 (result/tako) を測り分け。

import { useState } from "react";
import { track } from "@/lib/track";

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
}

export function BragShare({
  essence,
  code,
  catchphrase,
  topUrl,
  source,
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

  return (
    <div className="mt-4 pt-3 border-t border-[#3A2D6B]/10 text-center">
      <p className="text-[11px] font-bold text-[#9BA3B4] mb-1.5">
        この診断、面白かったら広めてね🐧
      </p>
      <div className="flex items-center justify-center gap-3 text-[11px] font-bold">
        <a
          href={bragXUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fire("x")}
          className="text-[#9BA3B4] underline underline-offset-2 hover:text-[#3A2D6B] transition-colors"
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
          className="text-[#9BA3B4] underline underline-offset-2 hover:text-[#3A2D6B] transition-colors"
        >
          LINEで送る
        </a>
        <span aria-hidden="true" className="text-[#9BA3B4]/50">
          ·
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[#9BA3B4] underline underline-offset-2 hover:text-[#3A2D6B] transition-colors"
        >
          {copied ? "コピーしました" : "リンクをコピー"}
        </button>
      </div>
    </div>
  );
}
