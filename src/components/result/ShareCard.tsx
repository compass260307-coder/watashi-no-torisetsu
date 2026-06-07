"use client";

// Phase 1.5-α: SNS シェア用の保存画像 (確定カードはここだけ)。
//
// 参照: docs/design/watashi-torisetsu-result-card-design.html
// 全部入り: グリッド背景・装飾ヘッダー({owner}のトリセツ + 花/ハート)・丸枠キャラ・
// 2 行ポップ見出し(essence 小 / 型名 大)・短い説明・シェアコード・フッター。
//
// html-to-image(toPng) で 1 枚 PNG に書き出す対象。確実に焼き込むため:
//   - グリッド背景は ::before(.grid-bg) に頼らずインライン backgroundImage で再現
//   - 画像は next/image でなく素の <img> (オフスクリーン同一オリジンで確実にロード)
//   - 見出しは .wtr-name/.wtr-sub (白フチ+黄ドロップ, M PLUS Rounded)
//   - 幅高さは固定 (レイアウトシフト/出力ブレ防止)

import { forwardRef } from "react";

interface ShareCardProps {
  ownerName: string;
  typeName: string;
  essence: string;
  description: string;
  imageSrc: string;
  shareCode: string;
}

const CARD_W = 540;

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCard(
    { ownerName, typeName, essence, description, imageSrc, shareCode },
    ref,
  ) {
    return (
      <div
        ref={ref}
        style={{
          width: CARD_W,
          boxSizing: "border-box",
          padding: "36px 28px 28px",
          borderRadius: 32,
          border: "3px solid #0094D8",
          // grid-bg をインライン再現 (グリッド線 + sky→pink ベースグラデ)
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)," +
            "linear-gradient(180deg, #BCDEF8 0%, #FFD6E0 100%)",
          backgroundSize: "32px 32px, 32px 32px, 100% 100%",
          fontFamily:
            'var(--font-m-plus-rounded), "Hiragino Maru Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
          textAlign: "center",
        }}
      >
        {/* 装飾ヘッダー: ハート + 「{owner}のトリセツ」ピル + 花 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decorations/heart-pink.png"
            alt=""
            width={44}
            height={44}
            style={{ width: 44, height: 44, transform: "rotate(-12deg)" }}
          />
          <span
            style={{
              background: "#FFE993",
              color: "#3A2D6B",
              fontWeight: 800,
              fontSize: 18,
              padding: "8px 18px",
              borderRadius: 9999,
              border: "2px solid #3A2D6B",
              transform: "rotate(-2deg)",
              whiteSpace: "nowrap",
            }}
          >
            {ownerName}のトリセツ
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decorations/flower-yellow.png"
            alt=""
            width={40}
            height={40}
            style={{ width: 40, height: 40, transform: "rotate(12deg)" }}
          />
        </div>

        {/* 角丸スクエア枠キャラ (主役級・大、背景込みシーンを cover で全面。白下地・縁なし) */}
        <div
          style={{
            width: 440,
            height: 440,
            margin: "0 auto 16px",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 10px 28px rgba(58,45,107,0.16)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={typeName}
            width={440}
            height={440}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* 2 行ポップ見出し */}
        <p className="wtr-sub" style={{ margin: "0 0 4px", fontSize: 20 }}>
          {essence}
        </p>
        <h2 className="wtr-name" style={{ margin: "0 0 14px", fontSize: 38 }}>
          {typeName}
        </h2>

        {/* 短い説明 */}
        <p
          style={{
            color: "#3A2D6B",
            fontSize: 15,
            lineHeight: 1.7,
            fontWeight: 600,
            margin: "0 auto 22px",
            maxWidth: 380,
          }}
        >
          {description}
        </p>

        {/* シェアコード */}
        <div
          style={{
            display: "inline-block",
            background: "#3A2D6B",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "0.18em",
            padding: "6px 16px",
            borderRadius: 9999,
            marginBottom: 18,
          }}
        >
          {shareCode}
        </div>

        {/* フッター */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#3A2D6B",
            opacity: 0.7,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="ワタシのトリセツ"
            width={104}
            height={30}
            style={{ width: 104, height: "auto" }}
          />
          <span>watashi-torisetsu.com</span>
        </div>
      </div>
    );
  },
);
