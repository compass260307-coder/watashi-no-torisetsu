// /tako「みんなの目に映るあなた」= 友達平均キャラ(32タイプ)の自己診断本文を他己視点に再構成。
//   selfContentFor の 取扱説明書(0)/取扱注意ポイント(1) の2セクションを流用し、
//   導入文と見出しだけ他己向けに差し替える (本文はそのまま・AIなし・全タイプ即対応)。
//   タイポグラフィは /me 本文プローズ (body-gothic 17px) と統一。

import { selfContentFor, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";

// 他己向けの小見出し (自己の「取扱説明書 / 取扱注意ポイント」を他己視点に読み替え)。
const TAKO_HEADINGS = ["友達から見たアナタ", "みんなが気づいてるクセ"] as const;

export function MinnaTypeProse({
  type32,
  essence,
}: {
  type32: ThirtyTwoTypeId;
  essence: string;
}) {
  // 取扱説明書 + 取扱注意ポイント の2セクションだけ使う (相性は他己文脈から外す)。
  const sections = selfContentFor(type32).slice(0, 2);
  if (sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-10">
      {/* 他己視点の導入文: 友達の回答から浮かんだタイプ (称号) を提示 */}
      <p className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4]">
        友達の回答から浮かんだのは「{essence}」。まわりの目には、こんなアナタが映っています。
      </p>

      {sections.map((sec, i) => (
        <div key={sec.title}>
          <h3 className="mb-3 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
            {TAKO_HEADINGS[i] ?? sec.title}
          </h3>
          {sec.body.split("\n\n").map((para, p) => (
            <p
              key={p}
              className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
            >
              {para}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
