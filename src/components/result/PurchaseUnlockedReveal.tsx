"use client";

// 完全版の購入後の「解放の発表」。準備画面 (PurchaseLoadingScreen) が終わってから、結果ページへ移る前に1回だけ出す。
// 自己診断の結果発表 (ResultRevealStage) と同じ運び: 明かりが落ちてじらす → ぱっと光って発表 → 少し見せて消える。
//
//   1. 星空の中に、閉じた宝箱 (購入前の案内で見せていた宝箱) が出る。ふたのすき間から金色の光がもれ、
//      かたかた揺れがだんだん強くなる。「ご購入ありがとう！」
//   2. ぱっと光って金色の舞台に変わり、宝箱が開く。買った7つの特典 (購入前に宝箱で見せていた絵) が
//      1つずつ宝箱から飛び出して上に並ぶ。「完全版が解放されたよ！」と紙吹雪、Alice が喜ぶ
//   3. 少し見せてから、うしろの自己診断結果ページへ着地する (自己診断の発表の終わり方と同じ):
//      本人のキャラクターが宝箱から飛び出して結果ページの絵の位置へおさまり、名前が出て、金色の舞台が晴れる。
//      位置は結果ページの実物 (ResultHero の data-result-hero*) を測って合わせるので、入れ替わりの継ぎ目が見えない。
//      うしろに結果ページがない、動きを減らす設定などで着地できないときは、全体がふわっと消える。
//
// 画面を押すと先へ進む (じらしの途中なら発表へ、見せている途中なら着地へ)。
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Confetti,
  readResultRevealTarget,
  type ResultRevealTarget,
} from "@/components/result/ResultRevealStage";
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
const LEAVE_MS = 560; // (着地できないとき) ふわっと消える
const LAND_MS = 1500; // キャラクターが宝箱から結果ページの位置へ着地する
const LAND_TAIL_MS = 1500; // 着地のあと、残った紙吹雪が落ちきるまで
const COVER_MS = 420; // 夜空がうしろの画面を覆いきるまで
const SKIP_GUARD_MS = 700; // 開いた直後の押しまちがいで飛ばさない
const BENEFIT_FIRST_MS = 260; // 開いてから1つ目の特典が飛び出すまで
const BENEFIT_STEP_MS = 95; // 特典が1つずつ飛び出す間隔
const BENEFIT_FLY_MS = 620;

const HEADLINE = "完全版が解放されたよ！";
// 紙吹雪の色の芯 (準備画面の金)。
const GOLD_RGB: [number, number, number] = [217, 164, 58];

// leave: ふわっと消える / land: 結果ページへ着地する
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
  // 着地先 (結果ページの実物の名前と絵)。着地を始めるときに測る。
  const [land, setLand] = useState<(ResultRevealTarget & { nameColor: string }) | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const landCharRef = useRef<HTMLImageElement | null>(null);
  const landNameRef = useRef<HTMLDivElement | null>(null);
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

  // 見せ終わったら、うしろの結果ページへ着地する。着地できないときは、ふわっと消える。
  const startLeaving = () => {
    const target = canLand() ? readResultRevealTarget() : null;
    const nameEl = document.querySelector<HTMLElement>("[data-result-hero] [data-result-hero-name]");
    if (!target || !nameEl) {
      setPhase("leave");
      return;
    }
    setLand({ ...target, nameColor: getComputedStyle(nameEl).color });
    setPhase("land");
  };

  // 段階を時間で進める (着地は下の effect が終わりを決める)。
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

  // 着地: キャラクターが宝箱から飛び出して結果ページの絵の位置へおさまり、金色の舞台が晴れる。
  useEffect(() => {
    if (phase !== "land" || !land) return;
    const root = rootRef.current, char = landCharRef.current, name = landNameRef.current;
    const chest = chestRef.current?.getBoundingClientRect();
    if (!root || !char || !name) {
      done();
      return;
    }
    const html = document.documentElement;
    // 結果ページ本体の名前と絵は、着地するまで隠しておく (globals.css の data-result-reveal)。
    html.setAttribute("data-result-reveal", "on");
    const anims: Animation[] = [];
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const a = el.animate(keyframes, { fill: "both", ...options });
      anims.push(a);
      return a;
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const im = land.imageBox;
    // 宝箱の口から出てくるように見せる出発点 (着地先の絵の枠からのずれと縮み)。
    const dx = chest ? chest.left + chest.width / 2 - (im.left + im.width / 2) : 0;
    const dy = chest ? chest.top + chest.height * 0.4 - (im.top + im.height / 2) : 0;
    const k = chest ? Math.max(0.12, (chest.width * 0.5) / im.width) : 0.3;
    const ease = "cubic-bezier(0.6, 0, 0.2, 1)";
    const landing = play(
      char,
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0 },
        { opacity: 1, offset: 0.18 },
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
      ],
      { duration: LAND_MS, easing: ease },
    );
    play(name, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 650,
      delay: LAND_MS - 650,
      easing: "ease-out",
    });
    // 宝箱・特典・言葉は先に引き、金色の舞台は少し遅れて晴れる。
    for (const el of root.querySelectorAll("[data-reveal-content]")) {
      play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: "ease-in" });
    }
    for (const el of root.querySelectorAll("[data-reveal-backdrop]")) {
      play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 950, delay: 430, easing: "ease-out" });
    }
    let cancelled = false;
    // 着地の動きが終わりきってから入れ替える (時間だけで待つと、動き出しが遅れた端末で二重に見える)。
    void Promise.race([
      landing.finished.then(() => undefined, () => undefined),
      new Promise<void>((resolve) => timers.push(setTimeout(resolve, LAND_MS + 400))),
    ]).then(() => {
      if (cancelled) return;
      // 着地した。結果ページ本体の名前と絵を出し、上に重なっている演出側を消す。
      html.removeAttribute("data-result-reveal");
      root.style.pointerEvents = "none";
      play(char, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      play(name, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      // 残った紙吹雪は、結果ページの上に落ちきってから消える
      if (canvasRef.current) {
        play(canvasRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, delay: 500, easing: "ease-in" });
      }
      timers.push(setTimeout(done, LAND_TAIL_MS));
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      for (const a of anims) a.cancel();
      html.removeAttribute("data-result-reveal");
      root.style.pointerEvents = "";
    };
  }, [phase, land]);

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
    confetti.burst(cx, cy - w * 0.1, 84, up, Math.PI * 1.1, [620, 1400]);
    confetti.sparkle(cx, cy, w * 0.62, 12);
    confetti.dust(vw / 2, vh * 0.5, vw * 0.55, vh * 0.5, 10, [30, 90], 2600);
    const timers = [
      setTimeout(() => {
        confetti.burst(-10, vh * 0.9, 38, up + 0.6, 0.7, [950, 1550]);
        confetti.burst(vw + 10, vh * 0.9, 38, up - 0.6, 0.7, [950, 1550]);
      }, 300),
      setTimeout(() => confetti.rain(44, 2400), 900),
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

      {/* 着地: 結果ページの実物と同じ位置・大きさの絵と名前。ここへおさまってから、本体と入れ替わる。 */}
      {land && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={landCharRef}
            className={styles.landChar}
            src={land.imageSrc}
            alt=""
            draggable={false}
            style={{
              left: land.imageBox.left,
              top: land.imageBox.top,
              width: land.imageBox.width,
              height: land.imageBox.height,
              objectFit: land.imageFit as CSSProperties["objectFit"],
            }}
          />
          <div
            ref={landNameRef}
            className={styles.landName}
            aria-hidden="true"
            style={{
              left: land.nameBox.left,
              top: land.nameBox.top,
              width: land.nameBox.width,
              height: land.nameBox.height,
              color: land.nameColor,
              fontSize: land.nameStyle.fontSize,
              fontWeight: land.nameStyle.fontWeight,
              fontFamily: land.nameStyle.fontFamily,
              lineHeight: land.nameStyle.lineHeight,
              letterSpacing: land.nameStyle.letterSpacing,
              textAlign: land.nameStyle.textAlign as CSSProperties["textAlign"],
            }}
          >
            {land.name}
          </div>
        </>
      )}

      <div className={styles.flash} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.confetti} aria-hidden="true" />
    </div>
  );
}
