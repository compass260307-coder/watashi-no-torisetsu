"use client";
import { useState } from "react";
import { LINE_UPGRADE_PAID_MESSAGE } from "@/lib/line-upgrade-delivery-copy";

export function LineUpgradeReceipt({ failed = false, preview = false }: {failed?:boolean;preview?:boolean}) {
  const [retrying,setRetrying]=useState(false);
  const [message,setMessage]=useState<string | null>(null);
  async function retry() {
    if(retrying || preview) return;
    setRetrying(true);setMessage(null);
    try {
      const response=await fetch("/api/result-upgrade/generate?channel=line",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:true})});
      setMessage(response.ok?"お届けの確認を受け付けたよ。追加のお支払いは必要ないから、LINEで待っていてね🌙":"いま確認がうまくいかなかったみたい。少し待ってから、もう一度試してね。");
    } catch {setMessage("少し待ってから、もう一度試してね。");}
    finally {setRetrying(false);}
  }
  return <section className="mx-auto max-w-xl rounded-3xl border border-[#B9EACD] bg-white px-6 py-9 text-center text-[#2E2E5C] shadow-[0_12px_36px_rgba(6,199,85,0.12)]">
    <span className="rounded-full bg-[#E9F9EF] px-4 py-2 text-xs font-bold text-[#007A33]">お支払い完了 · ¥899</span>
    <h1 className="mt-6 text-2xl font-black">お支払いを確認したよ🌙</h1>
    <p className="mt-5 text-left text-sm leading-8">{LINE_UPGRADE_PAID_MESSAGE}</p>
    <a href={preview?"#line-delivery-preview":"https://line.me/R/oaMessage/%40867domoo"} className="mt-7 inline-flex rounded-full bg-[#06C755] px-7 py-3 font-bold text-white">{preview?"LINEでの受け取りを見る":"AliceとのLINEトークに戻る"}</a>
    {(failed || !preview) && <div className="mt-5 text-sm leading-7">
      <p>{failed ? "お届けの途中で止まっているみたい。追加購入せずに、もう一度確認してね。" : "LINEに届かないときは、追加購入せずに確認してね。"}</p>
      <button disabled={retrying || preview} onClick={retry} className="mt-3 font-bold text-[#007A33] underline disabled:opacity-50">{retrying?"確認しています…":"お届けをもう一度確認する"}</button>
    </div>}
    {message && <p role="status" className="mt-4 text-sm leading-7">{message}</p>}
  </section>;
}
