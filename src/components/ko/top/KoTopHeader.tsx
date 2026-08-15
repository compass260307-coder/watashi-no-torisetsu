// 2026-08-15: 実装は TopHeader (locale="ko") に統合済み。
// 既存の import 箇所 ({isKo ? <KoTopHeader/> : <TopHeader/>} パターン多数) を
// 壊さないための薄いラッパーとして残す。文言・リンクの変更は TopHeader 側で行う。

import TopHeader from "@/components/top/TopHeader";

export default function KoTopHeader() {
  return <TopHeader locale="ko" />;
}
