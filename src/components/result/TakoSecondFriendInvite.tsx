"use client";

// 友達診断ページ (/tako) の本文の終わりに置く「2人目に診断してもらう」の案内
// (日本語・未購入・回答1人のときだけ)。
//
// 見た目は、自己診断結果ページ (/me) の「友達診断」への案内と同じ: 見出し + 1文 + ボタン1つ。
// (カードや絵を足した版は「微妙」と本人指摘。あちらと同じくらいシンプルにする・2026-11-26)
// ボタンを押すと、友達0人のときと同じ招待カード (InviteCardDialog) を画面中央に開く。
//
// 背景 (11/19〜11/25 診断): 回答が1人以上届いた 4,633 人のうち、2人以上になったのは 38%。
//   1人目が届いたあとに招待ボタンを押したのは 6.9% だけだが、押した人の 75% は2人以上になっていた。
//   回答1人の画面は、1人目の結果を読み終えるとそのままフッターで、次の促しが無かった。
// 計測: 招待カードの中身 (LockedInviteShare) が、既存の tako_invite_ui_shown / friend_invite_clicked を
//   surface / source = "tako_read_end" で送る (新しいイベント名は足さない)。

import { useCallback, useState } from "react";
import { InviteCardDialog } from "@/components/result/InviteCardDialog";

const TITLE_ID = "tako-second-friend-invite-title";
const TRACK_SOURCE = "tako_read_end";

export function TakoSecondFriendInvite({
  viewer,
  inviteUrl,
  ownerToken,
  inviteCode,
}: {
  /** 1人目の友達の呼び名 (例「ゆいさん」)。 */
  viewer: string;
  /** 友達診断への招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
  ownerToken: string;
  inviteCode: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <section className="mb-14 mt-14">
      <h2 className="mb-3 text-[22px] font-black leading-tight text-[#2E2E5C] md:text-[26px]">
        2人目の友達診断
      </h2>
      <p className="body-gothic mb-5 text-[15px] leading-[1.8] text-[#1A1A1A] md:text-[16px]">
        ほかの友達や家族にも答えてもらって、{viewer}から見たあなたとの違いを比べてみましょう。
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-6 py-3 text-[14px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
      >
        2人目に診断してもらう
        <span aria-hidden="true">→</span>
      </button>
      {open ? (
        <InviteCardDialog
          titleId={TITLE_ID}
          onClose={close}
          inviteUrl={inviteUrl}
          trackSource={TRACK_SOURCE}
          ownerToken={ownerToken}
          inviteCode={inviteCode}
        />
      ) : null}
    </section>
  );
}
