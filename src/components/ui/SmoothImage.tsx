"use client";

// サイト共通の画像表示ラッパー (next/image)。
// 「画像がバラバラに出る」体験を統一するために作成:
//   - 読み込み前は淡いプレースホルダ地色を敷き、白い空白/不安定さを消す
//     (透過キャラでも見えるのは一瞬。ロード完了で地色は外し、帯色を透かす)。
//   - 読み込み完了でスッとフェードイン。下スクロールで挿絵が "パッ" と割り込む感を、
//     どの画像も同じ動きに揃える。
//   - priority (ヒーロー/LCP) はフェードで初期描画を遅らせないため、即時不透明で出す。
// width/height/fill はそのまま next/image に渡すので、レイアウト確保 (CLS) は従来どおり。
// ※ ShareCard の PNG 焼き込み用 <img> は確実性優先のため対象外 (置き換えない)。

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

// 読み込み前の淡い地色 (ブランドのオフホワイト寄りの薄ラベンダー)。
const DEFAULT_PLACEHOLDER = "#F1EFF7";

interface SmoothImageProps extends ImageProps {
  // プレースホルダ地色の上書き。帯色に合わせたいときに指定。
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
