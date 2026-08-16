// 相性④「シーン別トリセツ」本文を返すサーバ route。
//
// GET /api/aisho/scenes?a=<32type>&b=<32type>
//   - 2026-08-16: 相性診断はデフォルトで無料開放。認可ゲートを撤去し、全員へ
//     locked=false で scenes 本文を返す。
//
// なぜサーバに残すか: /aisho は完全静的・クライアントページで、従来 sceneLines() を
//   クライアント import して④本文を全部バンドルに載せていた (= View Source で漏れる)。
//   本 route に④生成を残すことで、④本文はクライアントバンドルには出さない。
//   無料化後も生成をサーバ側に置く方針は据え置く。
//
// ①〜③ (バランス/いいところ/注意)・相性度・ランク・ヒーローは従来どおり /aisho 側で
//   compat() をクライアント計算し全員無料 (= バイラル核)。

import { NextRequest, NextResponse } from "next/server";
import {
  allThirtyTwoTypeIds,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { compat, type AxisKey } from "@/lib/aisho-compat";
import { sceneLines, type SceneKey } from "@/lib/aisho-scene-copy";
import type { ResultLocale } from "@/i18n/result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set<string>(allThirtyTwoTypeIds());
function isValid(id: string | null): id is ThirtyTwoTypeId {
  return id !== null && VALID.has(id);
}

// シーン主役2軸 (aisho/page.tsx から移設)。sceneVerdict の判定に使う。
const SCENE_AXES: Record<SceneKey, [AxisKey, AxisKey]> = {
  love: ["A", "N"],
  friend: ["O", "E"],
  work: ["C", "E"],
  clash: ["N", "O"],
};

// 各シーン文章の頭に置く「言い切り」。主役2軸の平均で高/中/低を判定 (aisho/page.tsx から移設)。
function sceneVerdict(
  key: SceneKey,
  s: Record<AxisKey, number>,
  locale: ResultLocale,
): string {
  const [x, y] = SCENE_AXES[key];
  const v = (s[x] + s[y]) / 2;
  const hi = v >= 0.75;
  const lo = v < 0.5;
  switch (key) {
    case "love":
      if (locale === "ko")
        return hi
          ? "연애에서는 꽤 잘 맞아요. "
          : lo
            ? "연애에서는 엇갈림을 조심해야 해요. "
            : "연애에서는 천천히 맞춰 가면 더 깊어져요. ";
      return hi
        ? "恋愛では、かなり相性がいい。"
        : lo
          ? "恋愛は、すれ違いに気をつけたい。"
          : "恋愛は、丁寧にいけば深まる。";
    case "friend":
      if (locale === "ko")
        return hi
          ? "친구로서는 최고의 두 사람이에요. "
          : lo
            ? "우정에서는 서로의 다름을 즐기는 게 핵심이에요. "
            : "친구로서는 좋은 거리를 지킬 수 있어요. ";
      return hi
        ? "友達としては、最高のふたり。"
        : lo
          ? "友情は、違いを面白がれるかがカギ。"
          : "友達としては、いい距離感。";
    case "work":
      if (locale === "ko")
        return hi
          ? "함께 움직이면 일이 정말 잘 풀려요. "
          : lo
            ? "일할 때는 역할 분담이 핵심이에요. "
            : "함께 움직이면 좋은 팀이 돼요. ";
      return hi
        ? "一緒に動くと、めっちゃ捗る。"
        : lo
          ? "作業は、役割分担がカギ。"
          : "一緒に動けば、いいコンビ。";
    case "clash":
      if (locale === "ko")
        return hi
          ? "엇갈려도 금방 다시 균형을 찾아요. "
          : lo
            ? "한번 엇갈리면 조금 길어지기 쉬워요. "
            : "엇갈려도 제대로 다시 돌아올 수 있어요. ";
      return hi
        ? "すれ違っても、すぐ立て直せる。"
        : lo
          ? "すれ違うと、少し長引きがち。"
          : "すれ違っても、ちゃんと戻れる。";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  const locale: ResultLocale =
    searchParams.get("locale") === "ko" ? "ko" : "ja";
  if (!isValid(a) || !isValid(b) || a === b) {
    return NextResponse.json({ error: "invalid pair" }, { status: 400 });
  }

  // 相性診断は無料開放 (2026-08-16)。認可ゲートを撤去し全員へ本文を返す。
  const r = compat(a, b, locale);
  const scenes = sceneLines(a, b, locale).map((line) => ({
    key: line.key,
    label: line.label,
    text: `${sceneVerdict(line.key, r.s, locale)}${line.text}`,
  }));
  return NextResponse.json(
    { locked: false, scenes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
