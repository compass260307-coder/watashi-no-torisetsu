import Image from "next/image";
import { notFound } from "next/navigation";

// 課金カード覗き見モーダル (Alice) 用の「チャット中の様子」3シーンを撮影する
// ローカル専用ページ。HoshiyomiClient の ChatShell / AssistantMessage と同じ
// クラス構成の静的レプリカで、実際のチャットUIと見た目を揃える
// (実チャットは課金+AI呼び出しが必要なため、撮影用に静的再現する)。
// 撮影: /tmp/diag/alice-scenes.mjs が #scene-1〜3 を element screenshot する。

type Bubble = { role: "user" | "alice"; text: string };

// 3シーン: ①恋愛 ②人間関係 ③進路。Alice は診断結果を踏まえて寄り添う
// (断定しない・答えを決めつけない、実プロンプトのトーンに合わせる)。
const SCENES: { id: string; bubbles: Bubble[] }[] = [
  {
    id: "scene-1",
    bubbles: [
      { role: "user", text: "気になる人がいるんだけど、脈ありかわからなくて…" },
      {
        role: "alice",
        text: "きらめきクラゲタイプのあなたは、相手の小さな変化によく気づくはず。最近「おっ」と思った瞬間はありましたか？そこにヒントがありそうです。",
      },
    ],
  },
  {
    id: "scene-2",
    bubbles: [
      { role: "user", text: "友達にどう思われてるか気になって、ちょっと疲れちゃう" },
      {
        role: "alice",
        text: "周りの空気に敏感なあなたらしい悩みですね。診断では「一緒にいると安心する」と映っていましたよ。まずはその言葉を、そのまま受け取ってみませんか？",
      },
    ],
  },
  {
    id: "scene-3",
    bubbles: [
      { role: "user", text: "就活も進路もまだピンとこない。私って何がしたいんだろう？" },
      {
        role: "alice",
        text: "焦らなくて大丈夫。あなたの傾向だと「人の役に立てた瞬間」に力が湧くタイプ。最近うれしかった出来事から、一緒に紐解いてみましょうか。",
      },
    ],
  },
];

function GuideAvatar() {
  return (
    <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-[#F0EDFF]">
      <Image src="/mascot/hoshiyomi-guide.png" alt="" fill sizes="36px" className="object-contain" />
    </div>
  );
}

function ChatSceneFrame({ scene }: { scene: { id: string; bubbles: Bubble[] } }) {
  return (
    <div
      id={scene.id}
      className="flex h-[500px] w-[390px] flex-none flex-col overflow-hidden bg-white"
    >
      {/* ヘッダー (ChatShell と同構成) */}
      <header className="flex items-center gap-3 border-b border-[#2E2E5C]/[0.07] bg-white px-4 py-3">
        <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full bg-[#F0EDFF] shadow-sm ring-2 ring-white">
          <Image src="/mascot/hoshiyomi-guide.png" alt="" fill sizes="48px" className="object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-black text-[#2E2E5C]">Alice</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-[#2E2E5C]/42">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> オンライン
          </p>
        </div>
      </header>

      {/* 会話ビュー */}
      <div className="flex-1 overflow-hidden bg-[#FAFAFE] px-4 py-6">
        <div className="space-y-5">
          {scene.bubbles.map((bubble, index) =>
            bubble.role === "user" ? (
              <div key={index} className="flex justify-end">
                <div className="max-w-[86%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-[#5B5BEF] px-4 py-3 text-[14px] font-medium leading-[1.75] text-white">
                  {bubble.text}
                </div>
              </div>
            ) : (
              <div key={index} className="flex items-end gap-2.5">
                <GuideAvatar />
                <div className="max-w-[86%] whitespace-pre-wrap rounded-[22px] rounded-bl-md bg-white px-4 py-3 text-[14px] font-medium leading-[1.8] text-[#2E2E5C]/80 shadow-sm ring-1 ring-[#2E2E5C]/[0.05]">
                  {bubble.text}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* 入力欄 (静的) */}
      <div className="border-t border-[#2E2E5C]/[0.07] bg-white px-4 pb-4 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-[#2E2E5C]/12 bg-[#FAFAFE] p-2">
          <p className="min-h-11 min-w-0 flex-1 px-2 py-2.5 text-[15px] leading-relaxed text-[#2E2E5C]/30">
            今、何が気になっていますか？
          </p>
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#5B5BEF] text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AlicePeekScenesPage() {
  // UI撮影専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="flex min-h-dvh items-start gap-10 bg-[#3A3A6E] p-10">
      {SCENES.map((scene) => (
        <ChatSceneFrame key={scene.id} scene={scene} />
      ))}
    </main>
  );
}
