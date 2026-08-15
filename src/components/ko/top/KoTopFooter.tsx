// 2026-08-15: 実装は TopFooter (locale="ko") に統合済み。
// 既存の import 箇所 ({isKo ? <KoTopFooter/> : <TopFooter/>} パターン多数) を
// 壊さないための薄いラッパーとして残す。文言・リンクの変更は TopFooter 側で行う。

import TopFooter from "@/components/top/TopFooter";

export default function KoTopFooter({
  topBorder = true,
}: {
  topBorder?: boolean;
}) {
  return <TopFooter locale="ko" topBorder={topBorder} />;
}
