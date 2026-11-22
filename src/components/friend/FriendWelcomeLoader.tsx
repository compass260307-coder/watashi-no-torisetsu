"use client";

// 友達が招待リンクを開いた直後に出す「ようこそ」画面 (2026-11-22、日本語版のみ)。
//   説明なしで30問が始まると唐突なので、招待した本人の情報を読み込んでいる体裁の
//   待ち時間に、これからの流れ (30問に答える → 回答が本人に送られる → 本人が色々な結果を知る) を、
//   あいさつ1枚 + 説明3枚のスライドで伝える。
//   - 見た目は自己診断の解析待ち画面 (DiagnosisAnalyzingLoader) と同じ部品を使う。
//     カードが輪になって回り、下に進行バーとチェックリストが出る。
//   - 押すボタンは無い。WELCOME_TOTAL_MS が経つと自動で質問へ進む。
//   - 招待した本人の名前は friend-info の応答を待ってから出す (「友達」→ 名前の差し替わりを見せない)。
import { useEffect, useMemo, useRef, useState } from "react";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import type { AnalyzingSlide } from "@/i18n/diagnosis";

// 最初のあいさつ (4秒) と、説明の3枚 (4.5秒・4.5秒・6秒)。合計が画面全体の表示時間 (19秒)。
// 1枚4.5秒は自己診断の解析待ちと同じ (絵の中の動きが最後のスタンプまで見える長さ)。
// 注意: 自己診断の解析待ちは、待ち時間を延ばすたびに離脱が増えた (src/i18n/ja/diagnosis.ts の
// minLoadingMs の経緯を参照)。ここを延ばすときは、反映後の「回答を始めた割合」を必ず見る。
const GREETING_MS = 4000;
const SLIDE_MS = 4500;
// 最後の1枚 (本人が知ることのできる結果) だけ、カードを見終えられるよう少し長く出す。
const LAST_SLIDE_MS = 6000;
const SLIDE_DURATIONS_MS = [GREETING_MS, SLIDE_MS, SLIDE_MS, LAST_SLIDE_MS];
export const WELCOME_TOTAL_MS = SLIDE_DURATIONS_MS.reduce((sum, ms) => sum + ms, 0);
// 始まりの演出 (カードが弾んで出る + 紙吹雪の打ち上げ) を見せる時間。この間は読み込みの表示
// (進行バーとチェックリスト) を出さず、演出が落ち着いてから読み込みを始める。
const ENTRANCE_MS = 1800;

// 名前の応答がこの時間たっても返らなければ、名前なしの文言で始める。
const OWNER_WAIT_MAX_MS = 3000;

// 名前はカードの文や絵の中の札に入る。長い名前は途中で切って、枠からはみ出さないようにする。
const NAME_MAX_CHARS = 6;

// 絵の中の、招待した本人の顔 (ゴーレム)。
const OWNER_FACE = "/characters/face/golem_R.webp";

// 始まりの紙吹雪。画面の左下と右下から、クラッカーのように打ち上がって散る (1回だけ)。
// 位置や色は番号から決める (毎回同じ散り方)。
const BURST_COLORS = ["#F6C544", "#FF8FB1", "#8E8EF5", "#6FBF73", "#7CC8E0", "#F3A46B"];
const BURST_PIECES = Array.from({ length: 36 }, (_, i) => {
  const fromLeft = i % 2 === 0;
  const k = Math.floor(i / 2); // 片側の中での番号 (0〜17)
  const across = 6 + ((k * 37) % 52); // 横へ飛ぶ距離 (vw)
  const up = 34 + ((k * 53) % 50); // 上へ飛ぶ高さ (vh)
  return {
    fromLeft,
    dx: `${fromLeft ? across : -across}vw`,
    dy: `-${up}vh`,
    spin: `${(fromLeft ? 1 : -1) * (360 + ((k * 97) % 540))}deg`,
    size: 7 + (k % 4) * 2,
    round: k % 3 === 0,
    color: BURST_COLORS[i % BURST_COLORS.length],
    delay: 120 + ((k * 29) % 260),
    duration: 2000 + ((k * 71) % 900),
  };
});

function WelcomeBurst() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[61] overflow-hidden" aria-hidden>
      {BURST_PIECES.map((piece, i) => (
        <span
          key={i}
          className="friend-welcome-burst absolute bottom-[-12px]"
          style={
            {
              [piece.fromLeft ? "left" : "right"]: "-6px",
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 1.7,
              borderRadius: piece.round ? "50%" : 2,
              backgroundColor: piece.color,
              "--dx": piece.dx,
              "--dy": piece.dy,
              "--spin": piece.spin,
              animationDelay: `${piece.delay}ms`,
              animationDuration: `${piece.duration}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function buildSlides(who: string, hasName: boolean): AnalyzingSlide[] {
  return [
    {
      // 最初のあいさつ。本人 (ゴーレム) が両腕を広げて迎え、WELCOME の旗が掛かる絵。
      visual: {
        kind: "welcome",
        image: "/mascot/friend-welcome-hello.webp",
      },
      // 帯は温かいクリーム色 (紫だと、紫のゴーレムが地色に沈む)。
      tint: "#FFF3D6",
      // 名前が取れなかったときは「友達の友達診断」にならないよう、名前なしの文にする。
      text: hasName ? `${who}の\n友達診断へようこそ！` : "友達診断へ\nようこそ！",
      highlight: "ようこそ！",
    },
    {
      // ① やること: 友達 (招待した本人) について30問に答える。
      visual: {
        kind: "questions",
        // 実際の質問 (src/lib/friend-questions-v2.ts の Q1) を、図に収まる長さに縮めたもの。
        question: `${who}は\nグループでも意見を言うほうだ`,
        total: 30,
        unit: "問",
        badge: "回答完了！",
      },
      tint: "#EEF7E9",
      text: `まずは、${who}について\n30問の質問に答えてね！`,
      highlight: "30問",
    },
    {
      // ② 回答の行き先: 自分の回答が、招待した本人に届く。
      visual: {
        kind: "deliver",
        sheetLabel: "あなたの回答",
        recipientName: who,
        recipientFace: OWNER_FACE,
      },
      tint: "#EAF6F9",
      text: `${who}に\nあなたの回答が送られるよ！`,
      highlight: "あなたの回答",
    },
    {
      // ③ 本人が得るもの: 友達から見たキャラ・理解度・ギャップなど、色々な結果
      //    (実際の結果ページ src/components/result/TakoResultPage.tsx に出る項目)。
      visual: {
        kind: "results",
        labels: ["キャラ", "理解度", "ギャップ"],
        face: "/characters/face/fox_N.webp",
        faceColor: "#E8B84A",
        word: "リーダー気質",
        score: 82,
        more: "恋愛傾向・相性なども！",
      },
      tint: "#F1ECFA",
      text: `${who}は色々な結果を\n知ることができるよ！`,
      highlight: "色々な結果",
    },
  ];
}

export function FriendWelcomeLoader({
  ownerName,
  ownerReady,
  onDone,
}: {
  // 招待した本人の名前。取得できなかったときは null (「友達」と表示する)。
  ownerName: string | null;
  // friend-info の応答が返ったか。返るまでは名前を含む文を出さない。
  ownerReady: boolean;
  onDone: () => void;
}) {
  // 名前の応答を待つ。返らないまま OWNER_WAIT_MAX_MS が過ぎたら待つのをやめる。
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setWaitedOut(true), OWNER_WAIT_MAX_MS);
    return () => clearTimeout(timeout);
  }, []);
  const started = ownerReady || waitedOut;

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!started) return;
    const timeout = setTimeout(() => onDoneRef.current(), WELCOME_TOTAL_MS);
    return () => clearTimeout(timeout);
  }, [started]);

  // 名前は始めた時点のもので決める。始めたあとに届いても、途中で文言を差し替えない。
  const content = useMemo(
    () => {
      const chars = ownerName ? Array.from(ownerName) : [];
      const short =
        chars.length > NAME_MAX_CHARS ? `${chars.slice(0, NAME_MAX_CHARS).join("")}…` : chars.join("");
      const who = short ? `${short}さん` : "友達";
      return {
        slides: buildSlides(who, Boolean(short)),
        steps: [`${who}の結果を確認`, "30問の質問を準備", "回答ページを作成"],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [started],
  );

  if (!started) {
    // 名前が届くまでの一瞬だけ出る。
    return <div className="min-h-screen flex-1 bg-[#FCFCFC]" aria-busy="true" />;
  }

  return (
    <>
      {/* 始まり: カードの山が下から弾んで出て、同時に紙吹雪が打ち上がる。 */}
      <div className="friend-welcome-enter flex flex-1 flex-col">
        <DiagnosisAnalyzingLoader
          steps={content.steps}
          totalMs={WELCOME_TOTAL_MS - ENTRANCE_MS}
          startDelayMs={ENTRANCE_MS}
          slides={content.slides}
          slideDurationsMs={SLIDE_DURATIONS_MS}
          slidesLabel="ワタシのトリセツ"
        />
      </div>
      <WelcomeBurst />
    </>
  );
}
