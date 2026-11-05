"use client";

import { useState } from "react";

const scenes = [
  { label: "① 入力から生成開始", key: "paid", note: "出生情報を入力し、確認するとチャット内の生成待ちに進みます。入力内容は保存しません。" },
  { label: "② 生成中", key: "pending", note: "確認用に約24秒で完成状態になります。本番では実際の生成完了を待ちます。" },
  { label: "③ 完成・結果を見る", key: "complete", note: "金色の「結果を見る」を押すと結果へ進みます。鑑定文と出生図はサンプルです。" },
  { label: "時間がかかった場合", key: "timeout", note: "生成に時間がかかった場合の表示です。再度試すボタンで生成中の表示に戻れます。" },
] as const;

export default function UnmeiGenerationPreview() {
  const [selected, setSelected] = useState(1);
  const [mobile, setMobile] = useState(true);
  const scene = scenes[selected];
  const src = `/unmei?preview=${scene.key}`;
  return (
    <main className="min-h-screen bg-[#F5F4FB] p-3 text-[#2E2E5C] md:p-6">
      <h1 className="text-xl font-bold">運命の設計図：生成開始から完成まで</h1>
      <p className="mt-2 text-sm">ローカル確認用です。保存・決済・AI生成は行いません。場面を切り替えて、現在の画面を確認できます。</p>
      <nav aria-label="確認する場面" className="mt-4 flex flex-wrap gap-2">
        {scenes.map((item, index) => <button key={item.key} aria-pressed={selected === index} onClick={() => setSelected(index)} className={`rounded-full px-4 py-2 text-sm font-bold ${selected === index ? "bg-[#2E2E5C] text-white" : "bg-white"}`}>{item.label}</button>)}
        <button onClick={() => setMobile(!mobile)} className="rounded-full border px-4 py-2 text-sm">{mobile ? "PC幅に切り替える" : "スマホ幅に切り替える"}</button>
      </nav>
      <p className="my-3 text-sm leading-6">{scene.note}</p>
      <iframe key={scene.key} title={scene.label} src={src} className={`mx-auto h-[78vh] w-full rounded-xl border border-[#2E2E5C]/15 bg-white ${mobile ? "max-w-[390px]" : "max-w-[1200px]"}`} />
      <a href={src} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline">この画面を別タブで開く</a>
    </main>
  );
}
