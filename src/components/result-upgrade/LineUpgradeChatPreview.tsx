"use client";
import { useState, type FormEvent } from "react";
import { LINE_UPGRADE_INTRO, LINE_UPGRADE_CANCEL, LINE_UPGRADE_OFFER_MESSAGE, LINE_UPGRADE_PRICE_MESSAGE, lineUpgradeQuestion } from "@/lib/line-upgrade-dialogue";
import { LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH, RESULT_UPGRADE_QUESTIONS } from "@/lib/result-upgrade";
import { LineUpgradePurchaseCardPreview } from "./LineUpgradePurchaseCardPreview";

type Message = { role: "alice" | "you"; text: string };
export function LineUpgradeChatPreview({ purchaseReady = false }: { purchaseReady?: boolean }) {
  const [messages, setMessages] = useState<Message[]>(purchaseReady
    ? [{ role: "alice", text: LINE_UPGRADE_OFFER_MESSAGE }, { role: "alice", text: LINE_UPGRADE_PRICE_MESSAGE }]
    : [{ role: "alice", text: LINE_UPGRADE_INTRO }, { role: "alice", text: lineUpgradeQuestion(0) }]);
  const [answers, setAnswers] = useState<string[]>(purchaseReady ? Array(5).fill("プレビューの回答") : []);
  const [text, setText] = useState("");
  const [stopped, setStopped] = useState(false);
  function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || text.trim().length > LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH || stopped || answers.length >= RESULT_UPGRADE_QUESTIONS.length) return;
    const next = [...answers, text.trim()]; setAnswers(next);
    const response: Message[] = next.length === RESULT_UPGRADE_QUESTIONS.length
      ? [{ role: "alice", text: LINE_UPGRADE_OFFER_MESSAGE }, { role: "alice", text: LINE_UPGRADE_PRICE_MESSAGE }]
      : [{ role: "alice", text: lineUpgradeQuestion(next.length) }];
    setMessages(previous => [...previous, { role: "you", text: text.trim() }, ...response]);
    setText("");
  }
  return <main className="min-h-screen bg-[#F5F4FB] px-4 py-8 text-[#2E2E5C]">
    <p className="mx-auto mb-4 max-w-xl text-center text-sm font-bold">ローカル確認用：LINEへの送信・登録・決済は行いません。</p>
    <section className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#DDD7EE] shadow-xl">
      <header className="bg-[#06C755] px-5 py-4 text-lg font-black text-white">Alice ─ LINEトーク</header>
      <div aria-live="polite" className="space-y-4 bg-[#92ACC7] p-5">
        {messages.map((message, index) => <p key={index} className={`whitespace-pre-wrap rounded-2xl p-4 text-sm leading-7 ${message.role === "you" ? "ml-12 bg-[#9BE579]" : "mr-6 bg-white"}`}>{message.text}</p>)}
        {answers.length === RESULT_UPGRADE_QUESTIONS.length && <>
          <LineUpgradePurchaseCardPreview />
          <div className="rounded-2xl bg-white p-4 text-sm">
          <p className="mt-3 text-xs text-[#66657B]">Stripeのテスト決済画面で確認できます。実際の課金はありません。</p>
          <a href="/dev/line-result-upgrade-complete-preview" className="mt-3 inline-block font-bold text-[#007A33] underline underline-offset-4">支払いを省略して「作成中→お届け」を確認する</a>
        </div></>}
      </div>
      {!stopped && answers.length < RESULT_UPGRADE_QUESTIONS.length && <form onSubmit={send} className="flex items-end gap-3 bg-white p-4">
        <textarea aria-label="LINEで答える内容" value={text} onChange={event => setText(event.target.value)} maxLength={LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH} rows={3} className="min-w-0 flex-1 rounded-xl border p-3" placeholder="自由に話してね" />
        <button className="rounded-xl bg-[#06C755] px-4 py-3 font-bold text-white" type="submit" disabled={!text.trim()}>送信</button>
      </form>}
    </section>
    <div className="mx-auto mt-5 flex max-w-xl justify-center gap-6 text-sm font-bold">
      <button onClick={() => { setStopped(true); setMessages(previous => [...previous, { role: "alice", text: "うん、ここで中止しておくね。実際のLINEでは、続きから再開できるよ。" }]); }} disabled={stopped || answers.length === 5}>{LINE_UPGRADE_CANCEL}</button>
      <a className="underline" href="/dev/full-access-result-preview">499円解放後の結果へ戻る</a>
    </div>
  </main>;
}
