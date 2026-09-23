// next/image の unoptimized を「開発時のみ」有効にする共有フラグ。
//
// 経緯: dev サーバの画像 optimizer は大きな透過 PNG/WebP で固まることがあり
// (/aisho で実測)、各所で unoptimized が常時指定されていた。その結果、本番でも
// 原寸画像 (数百KB〜数MB) がそのまま配信され、転送量 (Vercel Fast Data Transfer)
// を押し上げていた。本番では next/image の AVIF/WebP 変換 + 適正サイズ配信を使い、
// dev だけ optimizer を素通しする (2026-09-23 サーバー費用削減)。
export const UNOPTIMIZED_IN_DEV = process.env.NODE_ENV === "development";
