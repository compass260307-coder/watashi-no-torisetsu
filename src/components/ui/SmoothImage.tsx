"use client";

// サイト共通の画像表示ラッパー (next/image)。
// 「画像がバラバラに出る」体験を統一するために作成:
//   - width/height/fill で場所を先に確保し (CLS 防止)、読み込み完了でスッとフェードイン。
//     下スクロールで挿絵が "パッ" と割り込む感を、どの画像も同じ動きに揃える。
//   - priority (ヒーロー/LCP) はフェードで初期描画を遅らせないため、即時不透明で出す。
//   - プレースホルダ地色は既定で「透明」。キャラ画像の大半は透過素材を色帯/背景の上に
//     重ねる設計で、地色を敷くと読み込み中に白い四角の箱が見えてしまうため
//     (例: /me ヒーロー・/types グリッド)。不透明画像で読み込み中の空白を色で埋めたい
//     ときだけ placeholderColor に色を渡す。
// ※ ShareCard の PNG 焼き込み用 <img> は確実性優先のため対象外 (置き換えない)。

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

// 既定は透明 = 箱を出さない。場所は width/height で確保済みなのでズレない。
const DEFAULT_PLACEHOLDER = "transparent";

interface SmoothImageProps extends ImageProps {
  // 読み込み中の地色。既定は透明 (箱なし)。不透明画像で空白を色で埋めたいときのみ指定。
  placeholderColor?: string;
}

export function SmoothImage({
  placeholderColor = DEFAULT_PLACEHOLDER,
  priority,
  className,
  style,
  onLoad,
  ...rest
}: SmoothImageProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // キャッシュ済み画像はマウント時点で onLoad が発火しないことがあるため complete を確認する。
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  // priority はフェードなし (即時描画で LCP を遅らせない)。それ以外はスッとフェードイン。
  const fade = !priority;

  return (
    // alt は呼び出し側から {...rest} 経由で必ず渡す (静的解析では追えないため無効化)。
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...rest}
      ref={ref}
      priority={priority}
      className={className}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={{
        ...style,
        backgroundColor: loaded ? undefined : placeholderColor,
        opacity: fade && !loaded ? 0 : 1,
        transition: fade ? "opacity 0.45s ease" : undefined,
      }}
    />
  );
}
