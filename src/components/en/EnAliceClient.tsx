"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { useMemo, useRef, useState, type FormEvent } from "react";

export default function EnAliceClient({ initialRemaining, total }: { initialRemaining: number; total: number }) {
  const [conversationId] = useState(() => generateId());
  const [remaining, setRemaining] = useState(initialRemaining);
  const [input, setInput] = useState("");
  const rolledBack = useRef(false);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/hoshiyomi/chat", prepareSendMessagesRequest({ id, messages }) { return { body: { id, message: messages.at(-1), locale: "en" } }; } }), []);
  const { messages, sendMessage, status, error, clearError } = useChat({ id: conversationId, transport, onFinish({ isAbort, isDisconnect, isError }) { if ((isAbort || isDisconnect || isError) && !rolledBack.current) { rolledBack.current = true; setRemaining((value) => Math.min(total, value + 1)); } }, onError() { if (!rolledBack.current) { rolledBack.current = true; setRemaining((value) => Math.min(total, value + 1)); } } });
  const busy = status === "submitted" || status === "streaming";
  function submit(event: FormEvent) { event.preventDefault(); const text = input.trim(); if (!text || busy || remaining <= 0) return; rolledBack.current = false; clearError(); setRemaining((value) => Math.max(0, value - 1)); setInput(""); void sendMessage({ text }); }
  return <main className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-[900px] flex-col bg-white text-[#2E2E5C] shadow-[0_0_40px_rgba(46,46,92,.06)]">
    <header className="border-b border-[#E8E8F1] px-5 py-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#5B5BEF]">Your personal AI astrologer</p><div className="mt-1 flex items-end justify-between gap-4"><h1 className="text-3xl font-black">Alice</h1><p className="text-sm font-bold text-[#717187]">{remaining} of {total} answers left</p></div></header>
    <div className="flex-1 space-y-5 overflow-y-auto bg-[#FAFAFE] px-5 py-7">
      {messages.length === 0 ? <div className="mx-auto max-w-xl rounded-[24px] bg-[#F1EEFF] p-6 text-[16px] leading-relaxed"><strong>Hi, I’m Alice.</strong><br />Tell me what has been on your mind. I’ll reflect with you using your personality profile and Destiny Blueprint.</div> : null}
      {messages.map((message) => { const text = message.parts.filter((part) => part.type === "text").map((part) => part.type === "text" ? part.text : "").join(""); if (!text) return null; return <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[82%] whitespace-pre-wrap rounded-[22px] px-5 py-4 text-[15px] leading-relaxed ${message.role === "user" ? "rounded-br-md bg-[#5B5BEF] text-white" : "rounded-bl-md bg-white shadow-sm"}`}>{text}</p></div>; })}
      {busy ? <p className="text-sm font-bold text-[#717187]">Alice is reading…</p> : null}{error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">I couldn’t respond just now. Please try again.</p> : null}
    </div>
    <form onSubmit={submit} className="border-t border-[#E8E8F1] p-4"><div className="flex items-end gap-2 rounded-2xl bg-[#F4F4F9] p-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={1200} rows={2} disabled={busy || remaining <= 0} placeholder={remaining > 0 ? "What's on your mind?" : "You've used all 30 answers"} className="min-w-0 flex-1 resize-none bg-transparent px-3 py-2 outline-none"/><button disabled={!input.trim() || busy || remaining <= 0} className="rounded-xl bg-[#5B5BEF] px-5 py-3 font-black text-white disabled:opacity-40">Send</button></div><p className="mt-2 text-center text-[11px] text-[#77778D]">Alice is for reflection and entertainment, not professional advice.</p></form>
  </main>;
}
