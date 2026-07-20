"use client";

// ¥499 購入完了画面 (ゲスト着地) の出生データ入力セクション。
//
// このページはゲスト専用 (ログイン中/owner_token 保有者は /me/[owner_token] に着地する)。
// birth_profiles は user セッションに紐付けて保存するため、未ログインでは保存できない。
// そこでログイン状態を検知し、
//   - 未ログイン → 上の LoginCard でのログインを促す案内 (フォームは出さない=送信して失敗させない)
//   - ログイン済 → フォームを表示 (任意入力・スキップ可)
//   - 入力済 → 完了メッセージ
// を出し分ける。いずれの場合も詳細レポート/PDF のお届けには一切影響しない (購入物を人質にしない)。

import React, { useEffect, useState } from "react";
import BirthProfileForm from "@/components/birth/BirthProfileForm";

type View = "checking" | "guest" | "form" | "saved";

export default function PurchaseCompleteBirthSection() {
  const [view, setView] = useState<View>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/birth-profile", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setView("guest");
          return;
        }
        if (res.ok) {
          const j = await res.json().catch(() => null);
          // 既に登録済みなら完了表示、未登録ならフォーム
          setView(j?.profile ? "saved" : "form");
          return;
        }
        // その他 (503 等) はフォールバックでログイン案内に寄せる
        setView("guest");
      } catch {
        if (!cancelled) setView("guest");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-8 w-full max-w-[640px] rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-3 text-lg font-black">レポートのお届けにあたって</h2>

      {view === "checking" && (
        <p className="text-sm text-gray-400">読み込み中…</p>
      )}

      {view === "guest" && (
        <p className="text-sm leading-relaxed text-gray-600">
          出生データ（生年月日・出生時刻・出生地）を登録すると、あなたの出生図を計算できます。
          <br />
          上のカードからログインすると、いつでも設定から登録・編集・削除できます。
          <span className="mt-2 block text-xs text-gray-400">
            ※ 登録は任意です。スキップしても詳細レポートのお届けには一切影響しません。
          </span>
        </p>
      )}

      {view === "form" && (
        <>
          <p className="mb-4 text-sm text-gray-600">
            よければ出生データを教えてください（任意）。あとで設定から編集・削除できます。
          </p>
          <BirthProfileForm
            onSaved={() => setView("saved")}
            onSkipped={() => setView("saved")}
          />
        </>
      )}

      {view === "saved" && (
        <p className="text-sm leading-relaxed text-gray-700">
          出生データを受け付けました。設定からいつでも編集・削除できます。
        </p>
      )}
    </div>
  );
}
