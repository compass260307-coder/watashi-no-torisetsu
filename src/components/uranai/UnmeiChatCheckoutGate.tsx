"use client";

// /unmei のチャット決済ゲート (2026-08-06)。
// 既定では LP (children) を見せ、LP の「設計図を作成する →」CTA が発火する
// CustomEvent("unmei-chat-launch") を受けたら、LP を隠してチャット決済を表示する。
// 全画面にはせず通常フローで差し替えるため、/unmei layout の TopHeader / TopFooter と
// ルート layout の BottomNav はそのまま表示される (2026-08-06 指示で全画面→通常表示に変更)。
// LP へ戻る手段は TopHeader のナビ (運命の設計図) 等に委ね、専用の戻るボタンは置かない。
//
// 決済完了→鑑定生成が終わると UnmeiClient が router.refresh() を呼び、サーバが鑑定本文
// (unmeiFlag=true) を返してこのゲートごと差し替わる。

import { useEffect, useState } from "react";
import UnmeiClient from "@/components/uranai/UnmeiClient";

type Props = {
  purchase: {
    ownerToken: string | null;
    product: "unmei" | "unmei_upgrade";
  };
  children: React.ReactNode;
};

export default function UnmeiChatCheckoutGate({ purchase, children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onLaunch = () => setOpen(true);
    window.addEventListener("unmei-chat-launch", onLaunch);
    return () => window.removeEventListener("unmei-chat-launch", onLaunch);
  }, []);

  // LP↔チャットの切り替え時は先頭へスクロール (LP の途中位置のまま切り替わらないように)。
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [open]);

  return (
    <>
      {/* LP はマウントしたまま隠す (再マウントによる計測二重発火・スクロール喪失を避ける) */}
      <div className={open ? "hidden" : undefined}>{children}</div>
      {open ? (
        <UnmeiClient initialState="no_birth" purchase={purchase} />
      ) : null}
    </>
  );
}
