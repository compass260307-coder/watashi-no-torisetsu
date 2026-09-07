// 相性診断全体の表示権限と、解放後の「シーン別トリセツ」本文を返すサーバゲート。
//
// GET /api/aisho/scenes?a=<32type>&b=<32type>
//   - 認可: 現行の完全版、プレミアム権限、または購入時に相性込みだった旧権利を持つ本人だけ
//     scenes 本文を返す。
//   - 匿名・未課金は locked=true とし、本文を一切返さない。
//
// なぜサーバに残すか: /aisho は完全静的・クライアントページで、従来 sceneLines() を
//   クライアント import して④本文を全部バンドルに載せていた (= View Source で漏れる)。
//   本 route に④生成を残すことで、④本文はクライアントバンドルには出さない。
//   本文をクライアントバンドルや未課金応答へ載せないため、生成はサーバ側に置く。
//
// /aisho 側は locked=false を確認したときだけ、相性ランク・総評・バランス・いいところ・
//   シーン別・注意点を含む結果全体を表示する。

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasAishoAccess } from "@/lib/entitlements";
import { isSafeOpaqueToken } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
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

  // session を優先し、Cookie が無いSPでは owner_token で本人を解決する。
  // hasAishoAccess は購入時の相性診断ポリシーに基づいて判定する。
  // 匿名・未課金は fail-closed で本文を返さない。
  const session = await getSession(request);
  let userId: string | null = session?.id ?? null;
  if (!userId) {
    const rawToken = searchParams.get("owner_token");
    if (isSafeOpaqueToken(rawToken)) {
      const { data } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("owner_token", rawToken)
        .maybeSingle();
      userId = (data?.id as string | null) ?? null;
    }
  }

  const unlocked = userId ? await hasAishoAccess(userId) : false;
  if (!unlocked) {
    return NextResponse.json(
      { locked: true, ownerToken: session?.owner_token ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

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
