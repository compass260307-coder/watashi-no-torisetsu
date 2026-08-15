import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
import TopHeader from "@/components/top/TopHeader";
import type { ResultLocale } from "@/i18n/result";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { buildPerceptionView } from "@/lib/perception-view";
import { sixteenTypes } from "@/lib/sixteen-types";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { PerceptionResultBody } from "./PerceptionResultBody";

export interface FriendIndividualPageProps {
  params: Promise<{ token: string; perceptionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type PerceptionRow = {
  id: string;
  target_user_id: string;
  perceiver_name: string | null;
  perceived_scores: unknown;
  qualitative_data: unknown;
};

function rankNote(
  rank: number,
  total: number,
  mutual: number,
  locale: ResultLocale,
): string {
  if (locale === "ko") {
    if (total <= 1) return "지금은 단 한 명뿐인 소중한 시선이에요.";
    if (rank === 1) return `${total}명 중 가장 서로를 잘 이해하는 친구예요.`;
    if (rank === total && mutual < 60) {
      return `${total}명 중에서 예상 밖의 모습을 가장 많이 발견해 준 친구예요.`;
    }
    return `${total}명 중 관점 일치도가 ${rank}번째로 높은 친구예요.`;
  }
  if (total <= 1) return "いまのところ、たった一人の大事な視点。";
  if (rank === 1) return `${total}人の中で、いちばん分かり合えている相手。`;
  if (rank === total && mutual < 60) {
    return `${total}人の中では意外な一面を見てくれている相手。`;
  }
  return `${total}人中 ${rank}番目に分かり合えている相手。`;
}

export async function FriendIndividualResultPage({
  params,
  searchParams,
  locale = "ja",
  variant = "individual",
}: FriendIndividualPageProps & {
  locale?: ResultLocale;
  variant?: "evaluate" | "individual";
}) {
  const { token, perceptionId } = await params;
  const sp = await searchParams;
  const isKo = locale === "ko";
  const isIndividual = variant === "individual";
  const localePrefix = isKo ? "/ko" : "";
  const takoHref = `${localePrefix}/tako/${encodeURIComponent(token)}`;

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  let selfScores: BigFiveScores;
  let otherScores: BigFiveScores;
  let perceiverName: string | null;
  let ownerDisplayName: string | null;
  let qualitative: Record<string, string> | null;
  let ownerMessage = "";
  let rank = 1;
  let total = 1;

  if (previewType) {
    const code = sixteenTypes[baseIdOf(previewType)].code;
    const hi = (axis: string) => (code.includes(`${axis}＋`) ? 8 : 2);
    const clamp = (value: number) => Math.max(0, Math.min(10, value));
    otherScores = {
      O: hi("O"),
      C: hi("C"),
      E: hi("E"),
      A: hi("A"),
      N: nAxisOf(previewType) === "N" ? 8 : 2,
    };
    selfScores = {
      O: clamp(otherScores.O! - 3),
      C: otherScores.C,
      E: clamp(otherScores.E! + 3),
      A: clamp(otherScores.A! - 2),
      N: otherScores.N,
    };
    perceiverName = isKo ? "태킨" : "たっきん";
    ownerDisplayName = isKo ? "유와 인도" : "ゆうわインド";
    qualitative = isKo
      ? {
          favorite_point: "항상 침착하고 믿음직한 점",
          animal: "부엉이",
          impression_scene: "모두가 당황했을 때 혼자 침착했던 순간",
        }
      : {
          favorite_point: "いつも落ち着いてて頼れるところ",
          animal: "ふくろう",
          impression_scene: "みんなが慌ててる時に一人だけ冷静だった",
        };
    ownerMessage = isKo
      ? "진단 끝났어! 항상 고마워. 다음에 또 밥 먹으러 가자~"
      : "評価おわったよ！いつも助かってます。またごはん行こ〜";
    rank = 1;
    total = 3;
  } else {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name, owner_token")
      .eq("owner_token", token)
      .maybeSingle();
    if (!user) notFound();

    selfScores = (user.scores ?? {}) as BigFiveScores;
    ownerDisplayName = (user.display_name as string | null) ?? null;

    const { data: perceptionRow } = await supabaseAdmin
      .from("friend_perceptions")
      .select(
        "id, target_user_id, perceiver_name, perceived_scores, qualitative_data",
      )
      .eq("id", perceptionId)
      .maybeSingle();
    const perception = perceptionRow as PerceptionRow | null;
    if (!perception || perception.target_user_id !== (user.id as string)) {
      notFound();
    }
    otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
    perceiverName = perception.perceiver_name;
    qualitative =
      (perception.qualitative_data as Record<string, string> | null) ?? null;

    const [allRowsResult, messageResult] = await Promise.all([
      supabaseAdmin
        .from("friend_perceptions")
        .select("id, perceived_scores")
        .eq("target_user_id", user.id),
      (async () => {
        try {
          return await supabaseAdmin
            .from("friend_perceptions")
            .select("owner_message")
            .eq("id", perceptionId)
            .maybeSingle();
        } catch {
          return { data: null };
        }
      })(),
    ]);
    const allRows = allRowsResult.data;
    const ranked = (allRows ?? [])
      .map((row) => ({
        id: row.id as string,
        mutual: calcMutualUnderstanding(
          buildDimensionGaps(
            selfScores,
            (row.perceived_scores ?? {}) as BigFiveScores,
          ),
        ),
      }))
      .sort((a, b) => b.mutual - a.mutual);
    total = ranked.length || 1;
    rank = Math.max(1, ranked.findIndex((row) => row.id === perceptionId) + 1);
    ownerMessage =
      ((messageResult.data?.owner_message as string | null) ?? "").trim();
  }

  const view = buildPerceptionView({
    selfScores,
    otherScores,
    perceiverName,
    ownerDisplayName,
    ownerToken: token,
    qualitative,
    locale,
  });
  const mutual = calcMutualUnderstanding(
    buildDimensionGaps(selfScores, otherScores),
  );

  return (
    <>
      {isIndividual ? (
        <ScrollHideHeader>
          {isKo ? <KoTopHeader /> : <TopHeader />}
        </ScrollHideHeader>
      ) : null}
      <main
        className="relative min-h-dvh overflow-x-clip px-4 pb-10 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        <div
          className={`relative z-10 mx-auto max-w-[560px] ${
            isIndividual ? "pt-4" : "pt-6"
          }`}
        >
          {isIndividual ? (
            <Link
              href={takoHref}
              className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-[#2A3A5C]/70 transition-colors hover:text-[#2A3A5C]"
            >
              {isKo ? "← 친구들이 본 나로 돌아가기" : "← みんなから見た自分に戻る"}
            </Link>
          ) : (
            <div className="mb-5 flex items-center justify-between">
              <Link href={isKo ? "/ko" : "/"} aria-label={isKo ? "홈으로" : "トップへ"}>
                <Image
                  src="/logo.png"
                  alt={isKo ? "나의 사용설명서" : "ワタシのトリセツ"}
                  width={280}
                  height={80}
                  priority
                  className="h-auto w-[120px]"
                />
              </Link>
            </div>
          )}

          <PerceptionResultBody
            view={view}
            selfScores={selfScores}
            otherScores={otherScores}
            variant={variant}
            rankNote={
              isIndividual ? rankNote(rank, total, mutual, locale) : undefined
            }
            ownerMessage={isIndividual ? ownerMessage : undefined}
            locale={locale}
            footer={
              <div className="pb-2 pt-2 text-center">
                <Link
                  href={isIndividual ? takoHref : view.myTrisetsuUrl}
                  className="text-sm font-bold text-[#2E2E5C]/60 underline transition-colors hover:text-[#5B5BEF]"
                >
                  {isIndividual
                    ? isKo
                      ? "친구들이 본 나로 돌아가기"
                      : "みんなから見た自分に戻る"
                    : isKo
                      ? `${view.displayName}의 사용설명서로 돌아가기`
                      : `${view.displayName}のトリセツに戻る`}
                </Link>
              </div>
            }
          />
        </div>
      </main>
    </>
  );
}
