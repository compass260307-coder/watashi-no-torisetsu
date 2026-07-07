// ログイン確認インタースティシャルの表示部 (presentational)。
// page.tsx (実データ+getSession) と POC の両方から使えるよう container と分離。
// 世界観は /me・/tako と統一 (白背景・M PLUS Rounded(global)・ネイビー見出し・共通トークン)。

import Link from "next/link";
import { RecoveryUrlBox } from "./RecoveryUrlBox";

export function ConfirmSwitchView({
  aName,
  maskedEmail,
  recoveryUrl,
  continueHref,
  cancelHref,
  isConflict,
}: {
  /** 現デバイスのアカウント A の表示名。 */
  aName: string;
  /** リンク先アカウント B のマスク済みメール。 */
  maskedEmail: string;
  /** A のデータへ戻れる復帰URL (/me/[owner_token] の絶対URL)。無ければ null。 */
  recoveryUrl: string | null;
  /** 「続ける」= ?confirm=1 付き verify への遷移先。 */
  continueHref: string;
  /** 「キャンセル」= A の /me (無ければトップ) への遷移先。 */
  cancelHref: string;
  /** 現 Cookie(A) が B と別 user_id か (= 切替警告を出すか)。 */
  isConflict: boolean;
}) {
  return (
    <main className="min-h-dvh bg-white px-4 py-12">
      <div className="mx-auto max-w-[420px]">
        {/* 注意アイコン (ネイビー丸 + 三角) */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#2E2E5C]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3.5 21 20H3L12 3.5z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M12 10v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16.6" r="1.1" fill="#fff" />
          </svg>
        </div>

        <h1 className="text-center text-[#2E2E5C] font-black text-2xl leading-tight mb-3">
          ログインの前に
          <br />
          確認してください
        </h1>

        {isConflict ? (
          <p className="text-center text-[#2E2E5C]/75 font-bold text-sm leading-relaxed mb-6">
            このデバイスには{" "}
            <span className="text-[#2E2E5C] font-black">{aName}</span>{" "}
            の診断データがあります。
            <br />
            <span className="text-[#2E2E5C] font-black">{maskedEmail}</span>{" "}
            でログインすると、表示がそのアカウントに切り替わります。
          </p>
        ) : (
          <p className="text-center text-[#2E2E5C]/75 font-bold text-sm leading-relaxed mb-6">
            <span className="text-[#2E2E5C] font-black">{maskedEmail}</span>{" "}
            でログインします。
          </p>
        )}

        {/* 復帰URL (事故防止の主役・必ず目立たせる) */}
        {isConflict &&
          (recoveryUrl ? (
            <div className="mb-8">
              <p className="text-[#2E2E5C] font-black text-sm mb-2">
                いまの「{aName}」のデータは、このURLから後で戻れます。
                <span className="text-[#5B5BEF]">必ず保存してください。</span>
              </p>
              <RecoveryUrlBox url={recoveryUrl} />
              <p className="text-[#2E2E5C]/55 font-bold text-xs mt-2 leading-relaxed">
                ※ このURLを控えないと、切り替え後に「{aName}」のデータへ戻れなくなる場合があります。
              </p>
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border-2 border-[#F25E62]/40 bg-[#F25E62]/5 p-4">
              <p className="text-[#2E2E5C] font-black text-sm leading-relaxed">
                このデバイスのデータには復帰URLが見つかりませんでした。切り替えると、いまのデータへ戻れなくなる可能性があります。
              </p>
            </div>
          ))}

        {/* アクション: 続ける (消費+rotate) / キャンセル */}
        <a
          href={continueHref}
          className="flex w-full items-center justify-center rounded-full bg-[#2E2E5C] px-6 py-3.5 text-base font-black text-white shadow-[0_4px_0_#1b1b3e] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-none transition-all"
        >
          このままログインを続ける
        </a>
        <Link
          href={cancelHref}
          className="mt-3 flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-base font-black text-[#2E2E5C] border-2 border-[#2E2E5C] shadow-[0_4px_0_#2E2E5C] hover:translate-y-0.5 hover:shadow-[0_2px_0_#2E2E5C] active:translate-y-1 active:shadow-none transition-all"
        >
          キャンセル（いまのデータのまま）
        </Link>
      </div>
    </main>
  );
}
