"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DiagnosisResult } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { AnalyzingLoader } from "@/components/AnalyzingLoader";

export default function ResultFallbackPage() {
  const router = useRouter();
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const ownerToken = localStorage.getItem("torisetsu_owner_token");
    if (ownerToken) {
      router.replace(`/result/${ownerToken}`);
      return;
    }

    const stored = localStorage.getItem("torisetsu_result");
    if (stored) {
      setResult(JSON.parse(stored));
    }
    setChecking(false);
  }, [router]);

  // Phase 1.5-α Day 10: Brand v2 化 (localStorage フォールバック画面、簡素な見た目のみ)
  // 本来は /me/[ownerToken] に到達するが、ownerToken が無い旧データ用の保険ルート。
  if (checking) {
    return <AnalyzingLoader />;
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center px-5">
        <p className="text-[#3A2D6B]/70 font-bold text-sm mb-6">
          診断結果が見つかりません
        </p>
        <Link
          href="/diagnosis"
          className="bg-[#FFE993] text-[#3A2D6B] font-black px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] transition-all"
        >
          診断する
        </Link>
      </div>
    );
  }

  const typeData = torisetsuTypes[result.typeId];

  return (
    <div className="min-h-screen bg-[#E4E0F5]">
      <main className="flex flex-col items-center px-5 py-8 max-w-[480px] mx-auto w-full">
        <section className="w-full bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6 animate-scale-in">
          <div className="text-center">
            <p className="text-[#FE3C72] font-bold text-sm mb-2">
              アナタのタイプ
            </p>
            <h1 className="text-[#3A2D6B] font-black text-2xl mb-2">
              {typeData.name}
            </h1>
            {typeData.subtitle && (
              <p className="text-[#3A2D6B]/70 text-sm font-bold">
                {typeData.subtitle}
              </p>
            )}
          </div>
        </section>

        <p className="text-[#3A2D6B]/70 font-bold text-sm text-center mb-6">
          結果の全機能を使うには、もう一度診断してください
        </p>

        <Link
          href="/diagnosis"
          className="bg-[#FFE993] text-[#3A2D6B] font-black text-base px-10 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all mb-6"
        >
          診断をやり直す
        </Link>

        <Link
          href="/"
          className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
        >
          トップに戻る
        </Link>
      </main>
    </div>
  );
}
