// タコ個別ページ /tako/[token]/friend/[perceptionId] の「非本人向け案内ページ」。
// 本人 (isOwner) 以外 — 評価してくれた友達 / owner_token URL を共有された第三者 — が
// アクセスしたとき、中身 (相互理解・ギャップ・贈りもの全文等) を一切見せず、
// 「診断してくれてありがとう / あなたも診断してみない?」の感謝 + 誘い画面を出す。
// 締め出しではなく、評価者を新規診断・ログインへ誘導する拡散導線にする。
// 世界観は /me・/tako・評価者ページと統一 (白背景・M PLUS Rounded(global)・ネイビー見出し・共通トークン)。

import Link from "next/link";
import TopHeader from "@/components/top/TopHeader";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
import { GuideDiagnoseButton } from "./GuideDiagnoseButton";

export function FriendIndividualGuide({
  // 診断CTAの遷移先。評価者ページは ?source=<owner invite_code> を付けてバイラル計測を維持。
  // 未指定 (個別ページの案内) は素の /diagnosis = 従来挙動。
  diagnoseHref = "/diagnosis",
  // 指定時のみ診断CTAクリックを friend_to_diagnosis_clicked で計測 (評価者→診断の転換KPI)。
  diagnoseTrackSource,
}: {
  diagnoseHref?: string;
  diagnoseTrackSource?: string;
} = {}) {
  return (
    <>
      <ScrollHideHeader>
        <TopHeader />
      </ScrollHideHeader>
      <main
        className="relative min-h-dvh overflow-x-clip px-4 pb-10 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        <div className="relative z-10 mx-auto flex max-w-[420px] flex-col items-center pt-16 text-center">
          {/* 感謝アイコン (ネイビー丸 + ハート) */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#2E2E5C]">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 20s-6.5-4.35-9-8.5C1.5 8.5 3 5.5 6 5.5c1.9 0 3.1 1.1 4 2.3.9-1.2 2.1-2.3 4-2.3 3 0 4.5 3 3 6-2.5 4.15-9 8.5-9 8.5z"
                fill="#fff"
              />
            </svg>
          </div>

          <h1 className="text-[#2E2E5C] font-black text-[26px] leading-tight mb-3">
            診断してくれて
            <br />
            ありがとう！
          </h1>
          <p className="text-[#2E2E5C]/70 font-bold text-sm leading-relaxed mb-9 px-2">
            相手のことが見えたなら、今度は
            <br />
            あなた自身も、まわりの目から
            <br />
            見てみない？自分では気づかない
            <br />
            自分が、見えてくるかも。
          </p>

          {/* アクション: 診断する (主) / ログイン (従) */}
          <div className="flex w-full flex-col gap-3">
            <GuideDiagnoseButton
              href={diagnoseHref}
              trackSource={diagnoseTrackSource}
            >
              わたしも診断する
            </GuideDiagnoseButton>
            <Link
              href="/login"
              className="flex items-center justify-center w-full bg-white text-[#2E2E5C] font-black text-base px-6 py-3.5 rounded-full border-2 border-[#2E2E5C] shadow-[0_4px_0_#2E2E5C] hover:translate-y-0.5 hover:shadow-[0_2px_0_#2E2E5C] active:translate-y-1 active:shadow-[0_0_0_#2E2E5C] transition-all"
            >
              ログイン
            </Link>
          </div>
          <p className="text-[#2E2E5C]/50 font-bold text-xs mt-5">
            すでに診断した人は、ログインで自分の結果に戻れます
          </p>
        </div>
      </main>
    </>
  );
}
