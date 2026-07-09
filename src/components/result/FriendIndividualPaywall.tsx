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
}: {
  perceiverName?: string | null;
} = {}) {
  const who = (perceiverName ?? "").trim() || "ともだち";

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
          <h1 className="mt-2 text-[#2E2E5C] font-black text-[27px] md:text-[36px] leading-[1.4]">
            この続きは、
            <br />
            全解放でひらきます。
          </h1>

          {/* ロックの表現 (本文は載せない・完全にダミーの目隠し) */}
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
              🔓 一度きりの ¥299 で、
              <br />
              ぜんぶ読めるようになります。
            </p>
            <ul className="mt-3 space-y-1.5 text-[#5A5A72] font-bold text-[13px] leading-[1.6]">
              <li>・友達ひとりずつの相互理解とギャップ</li>
              <li>・その子からの「ひとこと」全文</li>
              <li>・キャリア／成長タブと相性のくわしい解説</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="w-full max-w-[320px]">
              <FullAccessCta />
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
