"use client";

import { useEffect, useState } from "react";
import { LoginCard } from "@/components/LoginCard";
import { BirthProfileForm } from "@/components/birth/BirthProfileForm";

type Mode = "server" | "network" | "rate";

const MODES: { id: Mode; label: string }[] = [
  { id: "server", label: "送信・保存の失敗" },
  { id: "network", label: "通信の失敗" },
  { id: "rate", label: "続けて送ったとき" },
];

// 実際の画面と同じ文字の見た目。
const LOGIN_STYLE =
  "whitespace-pre-line rounded-lg bg-red-50 p-3 text-[13px] leading-relaxed text-red-700";
const BIRTH_STYLE = "text-sm text-red-500";
const IMAGE_STYLE = "text-center text-xs text-[#5B5BEF] font-bold";

const LIST: { where: string; before: string; after: string; style: string }[] = [
  {
    where: "ログイン（送信の失敗）",
    before: "送信に失敗しました",
    after: "送信できませんでした。少し待ってから、もう一度お試しください。",
    style: LOGIN_STYLE,
  },
  {
    where: "ログイン（通信の失敗）",
    before: "通信エラー（実際はブラウザの英語の文が出ていた）",
    after: "通信できませんでした。電波のいい場所で、もう一度お試しください。",
    style: LOGIN_STYLE,
  },
  {
    where: "ログイン（続けて送ったとき）",
    before: "新しいコードは60秒後にリクエストできます。",
    after: "続けては送れません。60秒待ってから、もう一度お試しください。",
    style: LOGIN_STYLE,
  },
  {
    where: "生年月日の保存（失敗）",
    before: "保存に失敗しました（実際は db error などの英語が出ていた）",
    after: "保存できませんでした。入力内容を確かめて、もう一度お試しください。",
    style: BIRTH_STYLE,
  },
  {
    where: "生年月日の保存（続けて保存したとき）",
    before: "Too many attempts",
    after: "続けては保存できません。少し待ってから、もう一度お試しください。",
    style: BIRTH_STYLE,
  },
  {
    where: "生年月日の保存（通信の失敗）",
    before: "ネットワークエラー",
    after: "通信できませんでした。電波のいい場所で、もう一度お試しください。",
    style: BIRTH_STYLE,
  },
  {
    where: "結果カードの画像保存",
    before: "画像の保存に失敗しました",
    after: "画像を保存できませんでした。もう一度お試しください。",
    style: IMAGE_STYLE,
  },
];

const FAIL_PATHS = ["/api/auth/request-magic-link", "/api/birth-profile"];

export function InlineErrorPreview() {
  const [mode, setMode] = useState<Mode>("server");

  // このページを開いている間だけ、ログインの送信と生年月日の保存をわざと失敗させる (実際には送らない)。
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const isWrite = (init?.method ?? "GET").toUpperCase() !== "GET";
      if (isWrite && FAIL_PATHS.some((path) => url.includes(path))) {
        if (mode === "network") throw new TypeError("Failed to fetch");
        return new Response(
          JSON.stringify({ error: mode === "rate" ? "Too many attempts" : "db error" }),
          {
            status: mode === "rate" ? 429 : 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, [mode]);

  return (
    <main className="min-h-dvh bg-[#F1F1F7] px-4 pb-24 pt-8 text-[#2E2E5C]">
      <div className="mx-auto max-w-[540px]">
        <h1 className="text-[20px] font-black">画面内のエラー文（確認用）</h1>

        <h2 className="mt-7 text-[15px] font-black">1. 文言の一覧</h2>
        <p className="mt-1 text-[12px] leading-[1.7] text-[#5C5C7A]">
          色のついた文が、実際の画面と同じ見た目の新しい文言です。
        </p>
        <ul className="mt-3 space-y-3">
          {LIST.map((item) => (
            <li key={item.where} className="rounded-2xl bg-white p-4">
              <p className="text-[12px] font-black text-[#5B5BEF]">{item.where}</p>
              <p className="mt-1 text-[11px] leading-[1.6] text-[#8A8AA3]">
                変更前: {item.before}
              </p>
              <p className={`mt-2 ${item.style}`}>{item.after}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-9 text-[15px] font-black">2. 本物の画面で出してみる</h2>
        <p className="mt-1 text-[12px] leading-[1.7] text-[#5C5C7A]">
          失敗のしかたを選んでから、下のカードで送信・保存を押してください。このページでは実際には送られません。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              aria-pressed={mode === item.id}
              className="rounded-full px-3.5 py-2 text-[12.5px] font-bold"
              style={
                mode === item.id
                  ? { background: "#5B5BEF", color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: "#2E2E5C" }
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-[12px] font-black text-[#5B5BEF]">
          ログイン（適当なメールアドレスを入れて「リンクを送る」）
        </p>
        <div className="mt-2">
          <LoginCard locale="ja" />
        </div>

        <p className="mt-8 text-[12px] font-black text-[#5B5BEF]">
          生年月日の保存（そのまま保存ボタンを押す）
        </p>
        <div className="mt-2 rounded-2xl bg-white p-5">
          <BirthProfileForm
            initial={{
              birth_date: "2000-01-01",
              birth_time: "12:00",
              time_unknown: false,
              prefecture: "東京都",
              city: "",
            }}
          />
        </div>
      </div>
    </main>
  );
}
