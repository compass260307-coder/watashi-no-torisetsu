import type { Metadata } from "next";

import { recordLineEvent } from "@/lib/line-events";
import { lineLoveFootprintFromRow } from "@/lib/line-love-footprints";
import {
  buildLinePlusPageUrl,
  hasActiveLinePlus,
  verifyLinePlusToken,
} from "@/lib/line-plus";
import { supabaseAdmin } from "@/lib/supabase-server";

import LineLoveFootprintsClient from "./LineLoveFootprintsClient";

export const metadata: Metadata = {
  title: "恋の足あと | Alice",
  robots: { index: false, follow: false },
};

const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";

const PREVIEW_ENTRIES = [
  {
    id: "preview-1",
    happenedOn: "2026-09-14",
    partnerName: "あの人",
    kind: "happy" as const,
    mood: "flutter" as const,
    title: "帰り道に、少しだけ話せた",
    note: "いつもより自然に話せた気がする。名前を呼んでくれたのが、ずっと心に残ってる。",
    createdAt: "2026-09-14T12:00:00.000Z",
  },
  {
    id: "preview-2",
    happenedOn: "2026-09-08",
    partnerName: "あの人",
    kind: "worry" as const,
    mood: "uncertain" as const,
    title: "返信が来なくて、少し不安になった",
    note: "考えすぎないようにしたいけど、やっぱり気になってしまう。",
    createdAt: "2026-09-08T12:00:00.000Z",
  },
  {
    id: "preview-3",
    happenedOn: "2026-08-27",
    partnerName: "あの人",
    kind: "meeting" as const,
    mood: "hopeful" as const,
    title: "この人のこと、もっと知りたいと思った日",
    note: null,
    createdAt: "2026-08-27T12:00:00.000Z",
  },
];

function FallbackCard({
  title,
  body,
  href = LINE_TALK_URL,
  action = "LINEに戻る",
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F6F3FB] px-6 py-10">
      <section className="w-full max-w-sm rounded-[28px] border border-[#DDD7EE] bg-white p-7 text-center shadow-[0_18px_50px_rgba(38,24,78,0.12)]">
        <p className="text-[11px] font-black tracking-[0.18em] text-[#7C70D9]">
          ✦ ALICE PLUS
        </p>
        <h1 className="mt-3 text-xl font-black text-[#302847]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#69627D]">{body}</p>
        <a
          href={href}
          className="mt-7 block rounded-2xl bg-gradient-to-r from-[#5C4FC6] to-[#8068D8] px-6 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(80,63,170,0.24)]"
        >
          {action}
        </a>
      </section>
    </main>
  );
}

export default async function LineLoveFootprintsPage({
  searchParams,
}: {
  searchParams: Promise<{
    u?: string;
    e?: string;
    s?: string;
    preview?: string;
  }>;
}) {
  const { u, e, s, preview } = await searchParams;

  if (process.env.NODE_ENV === "development" && preview === "1") {
    return (
      <LineLoveFootprintsClient
        auth={{ u: "preview", e: "0", s: "preview" }}
        initialEntries={PREVIEW_ENTRIES}
        preview
      />
    );
  }

  const lineUserId = u ?? "";
  const expiresAtMs = Number(e);
  const signature = s ?? "";
  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return (
      <FallbackCard
        title="リンクの有効期限が切れています"
        body="Aliceとのトークから「恋の足あと」をもう一度開いてみてね。"
      />
    );
  }

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    return (
      <FallbackCard
        title="まだ連携が済んでいないみたいです"
        body="診断結果とLINEを連携すると、恋の足あとを残せるようになります。"
      />
    );
  }
  const userId = account.user_id;
  if (!(await hasActiveLinePlus(userId))) {
    return (
      <FallbackCard
        title="恋の足あとはAlice Plus限定です"
        body="うれしかった日も、迷った夜も。あなたの恋を、自分だけの場所に残しておけます。"
        href={buildLinePlusPageUrl(lineUserId)}
        action="Alice Plusを見る"
      />
    );
  }

  const { data, error } = await supabaseAdmin
    .from("line_love_footprints")
    .select(
      "id, happened_on, partner_name, kind, mood, title, note, created_at",
    )
    .eq("user_id", userId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[line-love-footprints] list failed", {
      message: error.message,
    });
  }
  const entries = (data ?? [])
    .map(lineLoveFootprintFromRow)
    .filter((entry) => entry !== null);

  await recordLineEvent({
    eventName: "line_love_footprints_page_viewed",
    metadata: {
      line_user_id: lineUserId,
      user_id: userId,
      entries: entries.length,
    },
  });

  return (
    <LineLoveFootprintsClient
      auth={{ u: lineUserId, e: String(expiresAtMs), s: signature }}
      initialEntries={entries}
    />
  );
}
