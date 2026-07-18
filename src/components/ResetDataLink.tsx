"use client";

// 「データをリセット」導線 (フッター上に置く版)。
// 誤操作防止に、押すとインラインの確認ステップに切り替わる。
// SP ハンバーガーメニュー内にも同等の導線があるが、あちらはドロワーのレイアウトに
// 合わせて TopHeader に直接組み込んでいる。ロジック (キー / 実行) は reset-data.ts で共有。

import { useState } from "react";
import { resetLocalData } from "@/lib/reset-data";
import type { ResultLocale } from "@/i18n/result";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

export function ResetDataLink({
  locale = "ja",
}: {
  locale?: ResultLocale;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div
      className="mx-auto w-full max-w-[420px] px-6 py-8 text-center"
      style={{ fontFamily: FONT_STACK }}
    >
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#B4415C] transition-colors hover:text-[#8f2f45]"
        >
          <ResetIcon />
          {locale === "ko"
            ? "진단 데이터를 초기화하고 처음부터 다시 하기"
            : "診断データをリセットして最初からやり直す"}
        </button>
      ) : (
        <div className="rounded-2xl bg-[#FBE9EC] p-5 text-left">
          <p className="text-[13px] font-bold leading-relaxed text-[#8f2f45]">
            {locale === "ko"
              ? "진단 결과와 초대 링크가 이 기기에서 삭제되며 되돌릴 수 없어요."
              : "診断結果や招待リンクがこの端末から消えます。もとに戻せません。"}
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={resetLocalData}
              className="flex-1 rounded-full bg-[#B4415C] py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#8f2f45]"
            >
              {locale === "ko" ? "초기화" : "リセットする"}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="flex-1 rounded-full bg-white py-3 text-[14px] font-bold transition-colors hover:bg-[#f3f3f7]"
              style={{ color: NAVY }}
            >
              {locale === "ko" ? "취소" : "キャンセル"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// リセット (ぐるっと回る矢印) アイコン。currentColor で文字色に追従。
function ResetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12a8 8 0 1 1 2.3 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 20v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
