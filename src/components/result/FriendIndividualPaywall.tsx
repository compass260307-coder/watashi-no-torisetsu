// タコ個別ページ /tako/[token]/friend/[perceptionId] の「本人・未課金向け課金導線」。
// 本人 (isOwner) だが ¥299 全解放 (plan='full') を持っていないときに表示する。
//
// 重要 (PR2 サーバゲートの肝):
//   このコンポーネントには perception 本文・owner_message 全文を一切渡さない。
//   受け取ってよいのは無料メタ (誰からの結果か = perceiverName) だけ。
//   本文はそもそもサーバで SELECT しない → payload / View Source に載る余地がない。
//
// 見た目は PR2 では最小限 (本文ゼロ + ¥299 導線)。作り込みは PR3。
// 世界観は /me・/tako・案内ページと統一 (白背景・M PLUS Rounded(global)・ネイビー見出し)。

import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { FullAccessCta } from "./FullAccessCta";

export function FriendIndividualPaywall({
  // 無料で見せてよいメタ。誰からの結果かの「引き」に使う。null なら「ともだち」。
  perceiverName = null,
  // A案: 相手からのメッセージ全文 (owner_message)。相手が自分に向けた言葉＝恵みなので
  // 未課金でも無料で全文表示する (引き)。null/空なら非表示。診断の中身はロックのまま。
  ownerMessage = null,
  // このページの owner_token。¥299 課金導線に本人解決用として渡す (Cookie 不在対策)。
  ownerToken,
}: {
  perceiverName?: string | null;
  ownerMessage?: string | null;
  ownerToken?: string;
} = {}) {
  const who = (perceiverName ?? "").trim() || "ともだち";
  const message = (ownerMessage ?? "").trim();

  return (
    <>
      <TopHeader />
      <main
        className="relative overflow-x-clip px-4 pb-16 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        <section className="mx-auto max-w-[520px] pt-10 md:pt-16 text-center">
          <p className="text-[#8A8AA3] font-bold text-[13px] md:text-base leading-relaxed">
            {who}さんからの
            <br className="md:hidden" />
            個別の結果
          </p>

          {/* A案: 相手からのメッセージ全文 (無料の引き)。診断の中身より先に、恵みとして見せる。 */}
          {message && (
            <div className="mt-5 rounded-3xl border-2 border-[#EFE3C8] bg-[#FFFBF0] px-5 py-6 text-left">
              <p className="text-[#B08A2E] font-black text-[12px] tracking-wide">
                {who}さんからのメッセージ
              </p>
              <p className="mt-2 body-gothic text-[#1A1A1A] font-normal text-[16px] leading-[1.7] whitespace-pre-wrap">
                {message}
              </p>
            </div>
          )}

          <h1 className="mt-8 text-[#2E2E5C] font-black text-[27px] md:text-[36px] leading-[1.4]">
            この続きは、
            <br />
            全解放でひらきます。
          </h1>

          {/* ロックの表現 (診断の中身は載せない・完全にダミーの目隠し) */}
          <div
            aria-hidden="true"
            className="mt-8 space-y-3 select-none"
          >
            {[92, 78, 85, 64].map((w, i) => (
              <div
                key={i}
                className="mx-auto h-4 rounded-full bg-[#EDEDF4] blur-[2px]"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-[#F7F7FB] px-5 py-6 text-left">
            <p className="text-[#2E2E5C] font-black text-[15px] leading-[1.6]">
              🔓 一度きりの ¥199 で、
              <br />
              ぜんぶ読めるようになります。
            </p>
            <ul className="mt-3 space-y-1.5 text-[#5A5A72] font-bold text-[13px] leading-[1.6]">
              <li>・友達ひとりずつの相互理解とギャップ</li>
              <li>・スコアで見る「見え方のズレ」の全部</li>
              <li>・自己診断のキャリア／成長タブ</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="w-full max-w-[320px]">
              <FullAccessCta ownerToken={ownerToken} />
            </div>
            <p className="mt-3 text-[#A0A0B4] font-bold text-[12px]">
              買い切り・追加課金なし
            </p>
          </div>
        </section>
      </main>
      <TopFooter />
    </>
  );
}
