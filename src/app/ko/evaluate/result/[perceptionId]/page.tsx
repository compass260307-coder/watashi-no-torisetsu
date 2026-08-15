import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FriendIndividualResultPage } from "@/components/result/FriendIndividualResultPage";
import { hasTakoAccess } from "@/lib/entitlements";
import { localizedAlternates } from "@/lib/locale-seo";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{ perceptionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type PerceptionOwnerRow = {
  target_user_id: string;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { perceptionId } = await params;
  const idPath = encodeURIComponent(perceptionId);
  return {
    title: "친구가 본 결과 | 나의 사용설명서",
    alternates: localizedAlternates(
      "ko",
      `/evaluate/result/${idPath}`,
      `/ko/evaluate/result/${idPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function KoreanEvaluationResultPage({
  params,
  searchParams,
}: PageProps) {
  const { perceptionId } = await params;
  const idPath = encodeURIComponent(perceptionId);
  const resolvedSearchParams = await searchParams;
  const rawPreview =
    typeof resolvedSearchParams.previewType === "string"
      ? resolvedSearchParams.previewType
      : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" ||
    resolvedSearchParams.fromPreview === "1";

  if (previewAllowed && /^[a-z-]+__[NR]$/.test(rawPreview)) {
    return (
      <FriendIndividualResultPage
        params={Promise.resolve({ token: "preview", perceptionId })}
        searchParams={Promise.resolve(resolvedSearchParams)}
        locale="ko"
        variant="evaluate"
      />
    );
  }

  const { data, error } = await supabaseAdmin
    .from("friend_perceptions")
    .select("target_user_id")
    .eq("id", perceptionId)
    .maybeSingle();
  if (error) {
    console.error("[/ko/evaluate/result] perception lookup error:", error);
  }
  const perception = data as PerceptionOwnerRow | null;
  if (!perception) {
    notFound();
  }

  const session = await getSession();
  const isOwner = !!session && session.id === perception.target_user_id;
  if (!isOwner) {
    redirect(`/ko/evaluate/sent/${idPath}`);
  }

  const { data: ownerRow } = await supabaseAdmin
    .from("users")
    .select("owner_token")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  const ownerToken = ((ownerRow?.owner_token as string | null) ?? "").trim();
  if (!ownerToken) {
    notFound();
  }

  if (!(await hasTakoAccess(perception.target_user_id))) {
    redirect(`/ko/me/${encodeURIComponent(ownerToken)}?paywall=1`);
  }

  return (
    <FriendIndividualResultPage
      params={Promise.resolve({ token: ownerToken, perceptionId })}
      searchParams={Promise.resolve(resolvedSearchParams)}
      locale="ko"
      variant="evaluate"
    />
  );
}
