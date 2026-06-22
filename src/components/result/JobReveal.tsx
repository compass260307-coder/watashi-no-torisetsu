// 友達タブの「職業の発表」。動物＋職業システムの他者診断側の見せ場。
// presentational な Server Component。
//
// - 確定 (友達3人以上): 「友達から見たアナタ＝{職業}」を発表 (絵文字 + 職業名 + 動物 + 一言)。
// - 未定: 「？{動物}」のティーザー。"開けたくなる扉" にする (ゲージ/招待は下の他者評価セクション)。

import type { Job } from "@/lib/job";
import { formatJobGapNote } from "@/lib/job";

interface JobRevealProps {
  job: Job | null;
  animal: string;
  threshold: number;
  friendCount: number;
}

export function JobReveal({
  job,
  animal,
  threshold,
  friendCount,
}: JobRevealProps) {
  if (job) {
    return (
      <article className="bg-white rounded-3xl border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] p-6 mb-6 text-center">
        <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-3">
          友達から見たアナタ
        </p>
        <div
          className="mx-auto w-14 h-14 rounded-full bg-[#FFF0F3] border-2 border-[#3A2D6B] flex items-center justify-center text-3xl mb-3"
          role="img"
          aria-label={`職業: ${job.name}`}
        >
          <span aria-hidden="true">{job.emoji}</span>
        </div>
        <h2 className="text-[#3A2D6B] font-black text-2xl leading-tight mb-2">
          {job.name}
          {animal}
        </h2>
        <p className="body-mincho text-[#3A2D6B] font-medium text-lg leading-[1.6] mb-3">
          {job.oneLiner}
        </p>
        {/* 統合考察の一言: 動物(自己) × 職業(他者) のズレ (仮・job.ts の定数で差替可) */}
        <p className="body-mincho text-[#3A2D6B] font-medium text-sm leading-[1.6] bg-[#FFF9F0] rounded-2xl border border-[#FFE993] px-4 py-3">
          {formatJobGapNote(animal, job.name)}
        </p>
      </article>
    );
  }

  // 未定 (ティーザー)
  const remaining = Math.max(0, threshold - friendCount);
  return (
    <article className="bg-white rounded-3xl border-2 border-dashed border-[#3A2D6B]/35 shadow-md p-6 mb-6 text-center">
      <p className="text-[#3A2D6B]/55 font-black text-[10px] tracking-[0.3em] mb-3">
        友達から見たアナタの職業
      </p>
      <div className="mx-auto w-14 h-14 rounded-full bg-[#F3F0FA] border-2 border-dashed border-[#3A2D6B]/35 flex items-center justify-center text-3xl text-[#3A2D6B]/40 mb-3">
        <span aria-hidden="true">？</span>
      </div>
      <h2 className="text-[#3A2D6B] font-black text-2xl leading-tight mb-2">
        ？{animal}
      </h2>
      <p className="body-mincho text-[#3A2D6B] font-medium text-base leading-[1.6]">
        友達 {threshold} 人の評価で、アナタの「職業」が判明します（あと {remaining} 人）。
      </p>
    </article>
  );
}
