"use client";

// 完全版の購入後の「解放の発表」。準備画面 (PurchaseLoadingScreen) が終わってから、結果ページへ移る前に1回だけ出す。
// 自己診断の結果発表 (ResultRevealStage) と同じ運び: 明かりが落ちてじらす → ぱっと光って発表 → 少し見せて消える。
//
//   1. 星空の中に、閉じた宝箱 (購入前の案内で見せていた宝箱) が出る。ふたのすき間から金色の光がもれ、
//      かたかた揺れがだんだん強くなる。「ご購入ありがとう！」
//   2. ぱっと光って金色の舞台に変わり、宝箱が開く。買った7つの特典 (購入前に宝箱で見せていた絵) が
//      1つずつ宝箱から飛び出して上に並ぶ。「完全版が解放されたよ！」と紙吹雪、Alice が喜ぶ
//   3. 少し見せてから、うしろの自己診断結果ページへ移る: 宝箱・特典・言葉が先に引き、少し遅れて
//      金色の舞台がゆっくり晴れて、結果ページが見えてくる。結果ページのキャラクターと名前は動かさない
//      (2026-11-26 本人指示。はじめは宝箱から結果ページの位置へ飛ばしていた)。
//      動きを減らす設定などのときは、全体がふわっと消える。
//
// 画面を押すと先へ進む (じらしの途中なら発表へ、見せている途中なら結果ページへ)。
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Confetti } from "@/components/result/ResultRevealStage";
import styles from "./PurchaseUnlockedReveal.module.css";

const CHEST_CLOSED_SRC = "/result-upgrade/treasure-closed.webp";
const CHEST_OPEN_SRC = "/result-upgrade/treasure-open.webp";
const ALICE_SRC = "/result-upgrade/alice-cheer.webp";

// 7つの特典 (絵は FullAccessTreasure の FULL_ACCESS_BENEFITS と同じもの)。
// x, y は宝箱の真ん中からの位置 (宝箱の幅を1とする。上がマイナス)。下から2つ・3つ・2つの3段に並べる。
// order は飛び出す順番 (真ん中から外へ)。
const BENEFITS: { src: string; x: number; y: number; order: number; tilt: number }[] = [
  { src: "/result-upgrade/benefit-sample-sections.webp", x: 0, y: -1.54, order: 0, tilt: 0 },
  { src: "/result-upgrade/benefit-sample-book.webp", x: -0.35, y: -0.93, order: 1, tilt: -4 },
  { src: "/result-upgrade/benefit-sample-chat.webp", x: 0.35, y: -0.93, order: 2, tilt: 4 },
  { src: "/result-upgrade/benefit-sample-fortune.webp", x: -0.67, y: -1.52, order: 3, tilt: -5 },
  { src: "/result-upgrade/benefit-sample-aisho.webp", x: 0.67, y: -1.52, order: 4, tilt: 5 },
  { src: "/result-upgrade/benefit-sample-friends.webp", x: -0.35, y: -2.13, order: 5, tilt: -4 },
  { src: "/result-upgrade/benefit-sample-report.webp", x: 0.35, y: -2.13, order: 6, tilt: 4 },
];
export const PURCHASE_REVEAL_IMAGES = [
  CHEST_CLOSED_SRC,
  CHEST_OPEN_SRC,
  ALICE_SRC,
  ...BENEFITS.map((b) => b.src),
];

const TEASE_MS = 2100; // 閉じた宝箱でじらす
const HOLD_MS = 3800; // 開いてから消え始めるまで
const LEAVE_MS = 560; // (動きを減らす設定のとき) ふわっと消える
const CONTENT_OUT_MS = 800; // 宝箱・特典・言葉が引く
const BACKDROP_OUT_DELAY_MS = 600; // 金色の舞台が晴れ始めるまで
const BACKDROP_OUT_MS = 1600; // 金色の舞台が晴れる
const LAND_TAIL_MS = 2400; // 晴れたあと、残った紙吹雪が落ちきるまで
const COVER_MS = 420; // 夜空がうしろの画面を覆いきるまで
const SKIP_GUARD_MS = 700; // 開いた直後の押しまちがいで飛ばさない
const BENEFIT_FIRST_MS = 260; // 開いてから1つ目の特典が飛び出すまで
const BENEFIT_STEP_MS = 95; // 特典が1つずつ飛び出す間隔
const BENEFIT_FLY_MS = 620;

const HEADLINE = "完全版が解放されたよ！";
// 紙吹雪の色の芯 (準備画面の金)。
const GOLD_RGB: [number, number, number] = [217, 164, 58];

// leave: ふわっと消える / land: 中身が引いてから、金色の舞台が晴れる
type Phase = "tease" | "open" | "leave" | "land";

function canLand() {
  if (typeof Element === "undefined" || !("animate" in Element.prototype)) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PurchaseUnlockedReveal({
  onCovered,
  onDone,
}: {
  // 夜空がうしろの画面を覆いきった (うしろを差し替えてよい)。
  onCovered?: () => void;
  // 演出が終わった。
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("tease");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chestRef = useRef<HTMLDivElement | null>(null);
  const openedAtRef = useRef(0);
  const doneRef = useRef(false);
  const onCoveredRef = useRef(onCovered);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onCoveredRef.current = onCovered;
    onDoneRef.current = onDone;
  });
  const done = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  useEffect(() => {
    const t = setTimeout(() => onCoveredRef.current?.(), COVER_MS);
    return () => clearTimeout(t);
  }, []);

  // 見せ終わったら、うしろの結果ページへ移る。
  const startLeaving = () => setPhase(canLand() ? "land" : "leave");

  // 段階を時間で進める (結果ページへ移るところは下の effect が終わりを決める)。
  useEffect(() => {
    if (phase === "land") return;
    const ms = phase === "tease" ? TEASE_MS : phase === "open" ? HOLD_MS : LEAVE_MS;
    const t = setTimeout(() => {
      if (phase === "tease") setPhase("open");
      else if (phase === "open") startLeaving();
      else done();
    }, ms);
    return () => clearTimeout(t);
  }, [phase]);

  // 結果ページへ: 宝箱・特典・言葉が先に引き、少し遅れて金色の舞台が晴れる。
  useEffect(() => {
    if (phase !== "land") return;
    const root = rootRef.current;
    if (!root) {
      done();
      return;
    }
    const anims: Animation[] = [];
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      anims.push(el.animate(keyframes, { fill: "both", ...options }));
    };
    for (const el of root.querySelectorAll("[data-reveal-content]")) {
      play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: CONTENT_OUT_MS, easing: "ease-in" });
    }
    for (const el of root.querySelectorAll("[data-reveal-backdrop]")) {
      play(el, [{ opacity: 1 }, { opacity: 0 }], {
        duration: BACKDROP_OUT_MS,
        delay: BACKDROP_OUT_DELAY_MS,
        easing: "ease-out",
      });
    }
    const cleared = BACKDROP_OUT_DELAY_MS + BACKDROP_OUT_MS;
    // 残った紙吹雪は、結果ページの上に落ちきってから消える
    if (canvasRef.current) {
      play(canvasRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 1000, delay: cleared + 1300, easing: "ease-in" });
    }
    const timers = [
      // 晴れたら、結果ページをすぐ触れるようにする。
      setTimeout(() => {
        root.style.pointerEvents = "none";
      }, cleared),
      setTimeout(done, cleared + LAND_TAIL_MS),
    ];
    return () => {
      timers.forEach(clearTimeout);
      for (const a of anims) a.cancel();
      root.style.pointerEvents = "";
    };
  }, [phase]);

  // 開いた瞬間の紙吹雪と、特典が並ぶたびのきらめき。
  const opened = phase !== "tease";
  useEffect(() => {
    if (!opened) return;
    openedAtRef.current = performance.now();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const confetti = new Confetti(canvas, GOLD_RGB);
    const onResize = () => confetti.resize();
    window.addEventListener("resize", onResize);
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = chestRef.current?.getBoundingClientRect();
    const w = r?.width ?? 180;
    const cx = r ? r.left + r.width / 2 : vw / 2;
    const cy = r ? r.top + r.height / 2 : vh * 0.6;
    const up = -Math.PI / 2;
    confetti.burst(cx, cy - w * 0.1, 120, up, Math.PI * 1.1, [620, 1400]);
    confetti.sparkle(cx, cy, w * 0.62, 12);
    confetti.dust(vw / 2, vh * 0.5, vw * 0.55, vh * 0.5, 10, [30, 90], 2600);
    const timers = [
      setTimeout(() => {
        confetti.burst(-10, vh * 0.9, 56, up + 0.6, 0.7, [950, 1550]);
        confetti.burst(vw + 10, vh * 0.9, 56, up - 0.6, 0.7, [950, 1550]);
      }, 300),
      // 2回目: 少し間をおいて、左右からもう一度上がる。
      setTimeout(() => {
        confetti.burst(-10, vh * 0.9, 34, up + 0.5, 0.8, [900, 1500]);
        confetti.burst(vw + 10, vh * 0.9, 34, up - 0.5, 0.8, [900, 1500]);
      }, 1500),
      // 上からは、結果ページへ移ったあとまで降り続ける。
      setTimeout(() => confetti.rain(120, 6000), 700),
      // 特典が並んだところに、きらっと光る。
      ...BENEFITS.map((b) =>
        setTimeout(
          () => confetti.sparkle(cx + b.x * w, cy + b.y * w, w * 0.26, 3, 300),
          BENEFIT_FIRST_MS + b.order * BENEFIT_STEP_MS + BENEFIT_FLY_MS - 120,
        ),
      ),
    ];
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
      confetti.stop();
    };
    // 消えるあいだ (leave) も降らせ続けるので、開いたときに1回だけ始める。
  }, [opened]);

  const advance = () => {
    if (phase === "tease") setPhase("open");
    else if (phase === "open" && performance.now() - openedAtRef.current > SKIP_GUARD_MS) startLeaving();
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.stage} ${opened ? styles.opened : ""} ${phase === "leave" ? styles.leaving : ""} ${phase === "land" ? styles.landing : ""}`}
      onClick={advance}
      role="status"
      aria-live="polite"
    >
      {/* 星空 → 金色の舞台 */}
      <div className={styles.night} aria-hidden="true">
        <div className={styles.stars} />
        <div className={`${styles.stars} ${styles.starsFar}`} />
        <div className={styles.spot} />
      </div>
      <div className={styles.gold} aria-hidden="true" data-reveal-backdrop />
      <div className={styles.rays} aria-hidden="true" data-reveal-backdrop />

      <div className={styles.column} data-reveal-content>
        <div className={styles.scene}>
          <p className={styles.lead}>
            <span className={styles.leadStar} aria-hidden="true">✦</span>
            ご購入ありがとう！
            <span className={styles.leadStar} aria-hidden="true">✦</span>
          </p>

          {/* 宝箱から立ちのぼる光 */}
          <div className={styles.beam} aria-hidden="true" />

          {BENEFITS.map((b) => (
            <div
              key={b.src}
              className={styles.benefit}
              aria-hidden="true"
              style={
                {
                  "--x": b.x,
                  "--y": b.y,
                  "--tilt": `${b.tilt}deg`,
                  "--delay": `${BENEFIT_FIRST_MS + b.order * BENEFIT_STEP_MS}ms`,
                  "--fly": `${BENEFIT_FLY_MS}ms`,
                  "--bob": `${-(b.order % 3) * 0.5}s`,
                } as CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt="" draggable={false} />
            </div>
          ))}

          <div className={styles.chestWrap} ref={chestRef}>
            <div className={styles.halo} aria-hidden="true" />
            <div className={styles.ground} aria-hidden="true" />
            <div className={styles.chestClosed}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.chest} src={CHEST_CLOSED_SRC} alt="" draggable={false} />
              {/* ふたのすき間からもれる光 */}
              <div className={styles.seam} aria-hidden="true" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`${styles.chest} ${styles.chestOpen}`} src={CHEST_OPEN_SRC} alt="" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.alice} src={ALICE_SRC} alt="" draggable={false} />
          </div>
        </div>

        <div className={styles.copy}>
          <p className={styles.headline} aria-label={HEADLINE}>
            {opened
              ? Array.from(HEADLINE).map((ch, i) => (
                  <span key={i} aria-hidden="true" style={{ animationDelay: `${420 + i * 42}ms` }}>
                    {ch}
                  </span>
                ))
              : null}
          </p>
          <p className={styles.sub}>
            <b>7つの特典</b>が、ぜんぶ使えるよ
          </p>
        </div>
      </div>

      <div className={styles.flash} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.confetti} aria-hidden="true" />
    </div>
  );
}
