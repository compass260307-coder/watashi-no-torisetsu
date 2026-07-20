// /tako 友達別シートの本文 = その友達が見たキャラ(32タイプ)の自己診断本文を他己視点に再構成。
//   selfContentFor の 取扱説明書(0)/取扱注意ポイント(1) の2セクションを流用。
//   2026-07-18: セクション見出し・導入文を廃止し、/me と同じく本文からいきなり始める。
//   冒頭の「アナタは、/アナタの根っこにあるのは、」に「◯◯さんから見た」を前置して
//   友達視点へ変換 (32タイプすべてこの2パターンで始まることを確認済み)。
//   2026-07-19: /me と同じシーン挿絵 (normal1=本文中間 / normal2=クセ見出し直下) を追加。
//   タイポグラフィは /me 本文プローズ (body-gothic 17px) と統一。

import { Fragment, type ReactNode } from "react";
import characterImages from "@/generated/character-images.json";
import { SmoothImage } from "@/components/ui/SmoothImage";
import {
  selfContentFor,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";

const PARA_CLASS =
  "body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0";

// /me の sceneImage と同じ解決順: キャラ別 <slug>_<variant>.webp → グループ共通 <group>_<variant>.webp。
// public/characters/scenes/ に「置くだけで自動表示」(無ければ非表示)。
export function sceneImageFor(
  type32: ThirtyTwoTypeId,
  variant: string,
): string | null {
  const slug = (thirtyTwoImagePath(type32).split("/").pop() ?? "").replace(
    /\.\w+$/,
    "",
  );
  const group = thirtyTwoGroup(type32);
  const candidates = [`${slug}_${variant}.webp`, `${group}_${variant}.webp`];
  for (const name of candidates) {
    if (characterImages.scenes.includes(name)) {
      return `/characters/scenes/${name}`;
    }
  }
  return null;
}

export function MinnaTypeProse({
  type32,
  viewer,
  midSlot,
  afterBodySlot,
}: {
  type32: ThirtyTwoTypeId;
  /** 「誰から見たか」の表示名 (例 "ゆかさん")。省略時は総称 (友達/みんな)。 */
  viewer?: string;
  /** 本文中間 (挿絵の直後) に差し込むブロック (例: ①五つの性格傾向のギャップ グラフ)。 */
  midSlot?: ReactNode;
  /** 本文の締めの後・「クセ」見出しの前に差し込むブロック (例: ②恋愛傾向)。 */
  afterBodySlot?: ReactNode;
}) {
  // 取扱説明書 + 取扱注意ポイント の2セクションだけ使う (相性は他己文脈から外す)。
  const sections = selfContentFor(type32).slice(0, 2);
  if (sections.length === 0) return null;
  const who = viewer ?? "友達";

  // 取扱説明書: 冒頭を「◯◯さんから見たアナタは、〜」へ変換し、友達視点の締めを添える。
  const [manual, kuse] = sections;
  const manualParas = manual.body.split("\n\n");
  if (manualParas[0]?.startsWith("アナタ")) {
    manualParas[0] = `${who}から見た${manualParas[0]}`;
  }

  // 挿絵 normal1 は /me と同じく本文の途中 (中間の段落の後) に差し込む。
  const introImage = sceneImageFor(type32, "normal1");
  const imageAfter = Math.max(0, Math.floor(manualParas.length / 2) - 1);
  const kuseImage = sceneImageFor(type32, "normal2");

  // グラフ (midSlot) の直後で本文を再開する段落は、接続詞 (そして/しかも 等) を落として
  // 「◯◯さんから見たアナタは〜」で仕切り直す (2026-07-20 指示)。
  const reopenIdx = imageAfter + 1;
  if (viewer && reopenIdx < manualParas.length) {
    let t = manualParas[reopenIdx];
    for (const conn of ["そして、", "そして", "しかも", "さらに"]) {
      if (t.startsWith(conn)) {
        t = t.slice(conn.length);
        break;
      }
    }
    manualParas[reopenIdx] = t.startsWith("アナタは")
      ? `${who}から見たアナタは${t.slice("アナタは".length)}`
      : `${who}から見ると、${t}`;
  }

  return (
    <div className="flex flex-col gap-10">
      {/* 見出しなし・本文からいきなり始める (/me の本文と同じ見た目) */}
      <div>
        {manualParas.map((para, p) => (
          <Fragment key={p}>
            <p className={PARA_CLASS}>{para}</p>
            {p === imageAfter && (
              <>
                {introImage && (
                  <SmoothImage
                    src={introImage}
                    alt=""
                    width={960}
                    height={640}
                    className="mx-auto my-8 h-auto w-full max-w-[560px] md:max-w-[760px]"
                  />
                )}
                {/* /me と同様、本文の途中 (挿絵の後) にグラフ等を差し込む */}
                {midSlot && <div className="my-10">{midSlot}</div>}
              </>
            )}
          </Fragment>
        ))}
      </div>

      {/* 本文の締めとクセの間に差し込むブロック (例: ②恋愛傾向) */}
      {afterBodySlot}

      {/* 取扱注意ポイント → 「③ ◯◯さんが気になっているクセ」(番号付きセクション見出し。
          番号は /tako シートの並び ①ギャップ/②恋愛/③クセ に対応) */}
      {kuse && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
            >
              3
            </span>
            <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
              {viewer ?? "みんな"}が気になっているクセ
            </h2>
          </div>
          {/* 挿絵 normal2: /me の「あなたの注意点」と同じくタイトル直下 (本文の前) */}
          {kuseImage && (
            <SmoothImage
              src={kuseImage}
              alt=""
              width={960}
              height={640}
              className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
            />
          )}
          {kuse.body.split("\n\n").map((para, p) => (
            <p key={p} className={PARA_CLASS}>
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
