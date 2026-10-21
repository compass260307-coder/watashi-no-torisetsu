"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { LineUpgradeReceipt } from "./LineUpgradeReceipt";
import { lineUpgradeDeliveryMessages } from "@/lib/line-upgrade-delivery-copy";

export function LineUpgradeDeliveryPreview() {
  const [ready,setReady]=useState(false);
  const [round,setRound]=useState(0);
  useEffect(()=>{const timer=setTimeout(()=>setReady(true),1800);return()=>clearTimeout(timer);},[round]);
  const messages=lineUpgradeDeliveryMessages({
    characterUrl:"/characters/v3/jellyfish_N.webp",previewUrl:"/characters/v3/jellyfish_N.webp",readingUrl:"/dev/result-upgrade-result-preview",
  });
  return <main className="min-h-screen bg-[#F5F4FB] px-4 py-7 text-[#2E2E5C]">
    <div className="mx-auto mb-5 max-w-xl text-center">
      <p className="text-xs font-bold leading-6">ローカル確認用：サンプルの生成・配信表示です。支払い・AI生成・実際のLINE送信は行いません。</p>
      <p className="mt-3 text-sm font-bold">決済完了 → 自動生成 → LINEで受け取り</p>
    </div>
    <LineUpgradeReceipt preview />
    <section id="line-delivery-preview" className="mx-auto mt-7 max-w-xl scroll-mt-5 overflow-hidden rounded-3xl border border-[#DDD7EE] shadow-lg">
      <h2 className="bg-[#06C755] px-5 py-4 font-black text-white">Alice ─ LINEでのお届け</h2>
      <div aria-live="polite" className="space-y-4 bg-[#92ACC7] p-5">
        {!ready ? <p role="status" className="mr-5 rounded-2xl bg-white p-4 text-sm leading-7">キャラクターと鑑定書をつくっているよ…🌙</p> : messages.map((message,index)=>message.type==="text" ?
          <p key={index} className="mr-5 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-7">{message.text.includes("/dev/") ? <>{message.text.split("\n\n")[0]}<br/><Link href="/dev/result-upgrade-result-preview" className="mt-3 inline-block font-bold text-[#0068CC] underline">あなた専用の鑑定書を読む</Link></> : message.text}</p> : message.type==="image" ?
          <div key={index} className="mr-5 overflow-hidden rounded-2xl bg-white"><SmoothImage src={message.originalContentUrl} alt="LINEに届く専用キャラクターのサンプル" width={560} height={560} className="w-full object-contain" /></div>:null)}
      </div>
    </section>
    <nav className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-5 text-sm font-bold">
      <button className="text-[#007A33] underline" onClick={()=>{setReady(false);setRound(value=>value+1);}}>もう一度流れを見る</button>
      <Link href="/dev/line-result-upgrade-chat" className="underline">質問・購入案内に戻る</Link>
    </nav>
  </main>;
}
