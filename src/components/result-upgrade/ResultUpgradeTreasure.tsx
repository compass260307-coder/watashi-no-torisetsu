"use client";

import { isMotionReduced } from "@/lib/a11y-style";
import Image, { getImageProps } from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./ResultUpgradeTreasure.module.css";

// intro: 宝箱が落ちてくる / idle: タップ待ち / charging: 震えてためる / open: クーポンが出る
// pricing: クーポンが値札に貼りつき ¥1,398 が ¥899 になる / offer: 購入ボタンを出す / closing: 閉じる
type Phase = "intro" | "idle" | "charging" | "open" | "pricing" | "offer" | "closing";
type PriceStep = "tag" | "sticker" | "strike" | "counting" | "landed";

const INTRO_MS = 950;
const CHARGE_MS = 800;
const CLOSE_MS = 320;
// 値下げ演出の時刻（受け取るを押してからのミリ秒）。
const STICKER_AT = 520;
const STRIKE_AT = 820;
const COUNT_AT = 1320;
const COUNT_MS = 1050;
const OFFER_AFTER_LAND_MS = 650;

// 羊毛フェルトの絵。閉じた宝箱と開いた宝箱は、同じ位置・同じ大きさに重なるよう切り出してある。
const CHEST_CLOSED_SRC = "/result-upgrade/treasure-closed.webp";
const CHEST_OPEN_SRC = "/result-upgrade/treasure-open.webp";
const ALICE_SRC = "/result-upgrade/alice-cheer.webp";
const ROOM_SRC = "/result-upgrade/treasure-room.webp";
const HEART_SRC = "/decorations/heart-pink.webp";
const FLOWER_SRC = "/decorations/flower-yellow.webp";
// クーポン券は文字ごと刺しゅうで描いた絵（「完全版購入者さま限定」「¥499 OFF」「結果アップグレードに使えます」）。
// クーポン額を変えるときは、この絵も作り直す（scripts/result-upgrade-web-questions-test.mjs で額を確認している）。
const COUPON_SRC = "/result-upgrade/coupon-ticket-embroidered.webp";
const PRICE_TAG_SRC = "/result-upgrade/price-tag.webp";

// ¥899 で手に入る特典。購入カード・商品説明と同じ内容を、絵つきのスライドで見せる。
// 特典①の絵は、サイトのうさぎ（アテンダント）を答えに合わせて変身させた見本。
const BENEFIT_ROTATE_MS = 3200;
const BENEFIT_BEFORE_SRC = "/characters/cut/rabbit_N.webp";

export type TreasureBenefit = {
  label: string;
  title: string;
  body: string;
  image: string;
  /** 元のうさぎ → 変身後の絵を並べる（結果アップグレードの専用キャラクター）。 */
  beforeAfter?: boolean;
  /** 実際の画面の見本。角丸の枠に上から切り取って「見本」を付ける。 */
  screenshot?: boolean;
};

/** 宝箱の演出で、商品ごとに変える文言・絵。 */
export type TreasureOffer = {
  dialogLabel: string;
  /** 宝箱の上の案内（2行）。 */
  lead: readonly [string, string];
  couponSrc: string;
  couponLabel: (couponJpy: number) => string;
  /** 値札から特典スライドへ移ったときに読み上げる説明。 */
  offerSummary: (priceJpy: number, benefitCount: number) => string;
  benefits: readonly TreasureBenefit[];
  /**
   * deck: 回るカード（既定） /
   * stack: 先頭の特典（その人が開けようとしたもの）を1枚だけ先に見せ、そこへ残りが加わって合計額を出してから、回るカードへ。
   */
  benefitStyle?: "deck" | "stack";
  /** false にすると、特典カードを自動では回さない（指で動かす・タップで次へ、だけにする）。既定は true。 */
  autoRotate?: boolean;
  /**
   * 値札の中の値段の並べ方。"row" は、もとの値段（小さく・取り消し線）と支払う値段（大きく）を横一列に並べる。
   * 省略時は従来どおり、もとの値段を左上に小さく置く。
   */
  priceLayout?: "row";
};

const BENEFITS: readonly TreasureBenefit[] = [
  {
    label: "特典①",
    title: "世界に一体だけのキャラクター",
    body: "あなたの答えをもとに、表情・服装・小物・背景まで仕立てたキャラクターが生まれます",
    image: "/result-upgrade/benefit-character.webp",
    beforeAfter: true,
  },
  {
    label: "特典②",
    title: "あなただけのタイプ名",
    body: "元のタイプ名に、あなたらしさを表す言葉をそえた専用の名前がつきます",
    image: "/result-upgrade/benefit-type-name.webp",
  },
  {
    label: "特典③",
    title: "自己診断の結果が、まるごとあなた専用に",
    body: "冒頭文から恋愛・仕事・日常の章まで、あなたの答えをもとに書き直します",
    image: "/result-upgrade/benefit-book.webp",
  },
  {
    label: "特典④",
    title: "LINEでAliceと対話できる",
    body: "完成したキャラクターと結果を知っているAliceに、今の悩みをLINEで相談できます",
    image: "/result-upgrade/benefit-line-chat.webp",
  },
  {
    label: "特典⑤",
    title: "LINEでAliceに恋愛占い",
    body: "タロットや四柱推命で、気になる相手との相性などをAliceが占います",
    image: "/result-upgrade/benefit-love-reading.webp",
  },
];

/** 完全版購入者向けの結果アップグレード（¥899）。 */
export const RESULT_UPGRADE_TREASURE_OFFER: TreasureOffer = {
  dialogLabel: "完全版購入者さまへのプレゼント",
  lead: ["完全版を買ってくれた", "あなたへのプレゼント"],
  couponSrc: COUPON_SRC,
  couponLabel: (couponJpy) => `完全版購入者さま限定 ¥${couponJpy.toLocaleString("ja-JP")} OFFクーポン`,
  offerSummary: (priceJpy, count) => `クーポンを使うと ${priceJpy.toLocaleString("ja-JP")}円で、次の${count}つの特典が手に入ります。`,
  benefits: BENEFITS,
};
// 絵ごとの sizes（ブラウザが取りにいく絵の幅を決める）。先読みと表示で同じ絵を取るよう、ここの値を両方で使う。
// 舞台は画面の高さに合わせて決まる（幅は高さの約56%）ので、舞台の中の絵は vh で指定する。
// 画素が3倍の画面（最近のスマホ）では、表示の2倍ぶんの幅の絵を取る。フェルトの絵は細部が柔らかく、
// 3倍ぶん（約2倍の重さ）を取っても見た目が変わらないため。条件が分からない古いブラウザは、うしろの実寸の指定を使う。
const DENSE = "(min-resolution: 2.5dppx)";
const ROOM_SIZES = `${DENSE} 32vh, 57vh`;
// 横長の画面の左右に敷く、ぼかした背景。ぼかすので小さな絵で足りる。
const ROOM_BLUR_SIZES = "256px";
const CHEST_SIZES = `${DENSE} 21vh, 31vh`;
const ALICE_SIZES = "(max-width: 520px) 28vw, 140px";
const PRICE_TAG_SIZES = `${DENSE} and (max-width: 520px) 59vw, (max-width: 520px) 88vw, 360px`;
const COUPON_SIZES = `${DENSE} and (max-width: 520px) 56vw, (max-width: 520px) 84vw, 330px`;
// 特典カードの絵は、積み重ねるときも1枚ずつ見せるときも、枠の中で約200px以下に収まる。
// どちらも同じ指定にして、同じ絵を2通りの幅で取らないようにする。
const BENEFIT_SIZES = `${DENSE} 128px, 200px`;

// 先読みした絵。捨てられないよう持っておく。
const warmedImages = new Map<string, HTMLImageElement>();

/** 画面に出す前に絵を読み込んでおく。<Image> が取るのと同じ絵（同じ幅）を取る。 */
function warmImage(src: string, sizes: string, urgency: "high" | "low" = "low") {
  if (typeof window === "undefined") return;
  const key = `${src}|${sizes}`;
  if (warmedImages.has(key)) return;
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = urgency;
  // sizes を先に入れてから srcset を入れる（順が逆だと、幅が決まる前に取りにいく）。
  if (props.sizes) image.sizes = props.sizes;
  if (props.srcSet) image.srcset = props.srcSet;
  image.src = props.src;
  warmedImages.set(key, image);
}

function warmRawImage(src: string) {
  if (typeof window === "undefined" || warmedImages.has(src)) return;
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.src = src;
  warmedImages.set(src, image);
}

/**
 * 宝箱を開く前（ページを読んでいる間）に、最初の場面の絵（書斎・閉じた宝箱・Alice）を読み込んでおく。
 * 押してから読み込むと、宝箱が落ちてくる動きの間に絵が出ない。
 */
export function preloadTreasureScene() {
  warmImage(ROOM_SRC, ROOM_SIZES);
  warmImage(CHEST_CLOSED_SRC, CHEST_SIZES);
  warmImage(ALICE_SRC, ALICE_SIZES);
}

/** 宝箱を開けたあとの場面の絵（開いた宝箱・クーポン・値札・数字・特典）を、宝箱を見ている間に読み込んでおく。 */
function preloadTreasureOffer(offer: TreasureOffer) {
  warmImage(CHEST_OPEN_SRC, CHEST_SIZES, "high");
  warmImage(offer.couponSrc, COUPON_SIZES);
  warmImage(PRICE_TAG_SRC, PRICE_TAG_SIZES);
  for (const name of GLYPHS) warmRawImage(`/result-upgrade/digits/${name}.webp`);
  for (const benefit of offer.benefits) {
    if (!benefit.beforeAfter && !benefit.screenshot) warmImage(benefit.image, BENEFIT_SIZES);
  }
}

// 刺しゅうの数字（0〜9・¥・カンマ）を1文字ずつ切り出した絵。並べて金額を表示する。
const GLYPHS = ["yen", "comma", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
function glyphSrc(char: string): string {
  const name = char === "¥" ? "yen" : char === "," ? "comma" : char;
  return `/result-upgrade/digits/${name}.webp`;
}

const SPARKLES = [
  { dx: "-150px", dy: "-110px", rot: "160deg", size: "26px", delay: "0ms" },
  { dx: "140px", dy: "-130px", rot: "-140deg", size: "30px", delay: "40ms" },
  { dx: "-60px", dy: "-190px", rot: "220deg", size: "20px", delay: "80ms" },
  { dx: "70px", dy: "-200px", rot: "-200deg", size: "22px", delay: "20ms" },
  { dx: "-190px", dy: "-30px", rot: "120deg", size: "18px", delay: "120ms" },
  { dx: "185px", dy: "-40px", rot: "-160deg", size: "20px", delay: "60ms" },
  { dx: "0px", dy: "-230px", rot: "180deg", size: "28px", delay: "100ms" },
  { dx: "-120px", dy: "-220px", rot: "260deg", size: "16px", delay: "160ms" },
  { dx: "120px", dy: "-235px", rot: "-240deg", size: "16px", delay: "140ms" },
  { dx: "30px", dy: "-140px", rot: "140deg", size: "18px", delay: "220ms" },
] as const;

// 舞い落ちるフェルトの飾り。位置・速さ・揺れは固定値にして、毎回同じ見た目にする（乱数を使わない）。
const CONFETTI_KINDS = ["heart", "star", "flower", "star"] as const;
const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  kind: CONFETTI_KINDS[index % CONFETTI_KINDS.length],
  x: `${(index * 37) % 100}%`,
  size: `${18 + (index % 4) * 6}px`,
  duration: `${3 + ((index * 7) % 10) / 8}s`,
  delay: `${(index % 9) * 90}ms`,
  drift: `${((index * 53) % 140) - 70}px`,
  rot: `${((index * 97) % 300) - 150}deg`,
}));

const noopSubscribe = () => () => {};

// サーバー描画では document が無いため、ブラウザで表示されてから全画面の演出を出す。
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function prefersReducedMotion(): boolean {
  return isMotionReduced();
}

type Props = {
  couponJpy: number;
  /** 通常価格（取り消し線を引く値段）と、クーポン適用後の支払額。 */
  listPriceJpy: number;
  priceJpy: number;
  /** 最後に出す購入ボタン（押すと決済画面へ進む）。 */
  purchaseCta: ReactNode;
  /** 宝箱を押して開けたとき（進み具合の計測用）。 */
  onChestOpened?: () => void;
  /** 「受け取る」を押してクーポンを受け取ったとき。 */
  onCouponReceived: () => void;
  /** 受け取ったあと「あとで決める」で閉じたとき。 */
  onClose: () => void;
  /** 宝箱を開けずに閉じたとき。チャットからもう一度開ける。 */
  onDismiss: () => void;
  /** 商品ごとの文言・絵。省略時は結果アップグレード。 */
  offer?: TreasureOffer;
  /** "offer": クーポンを受け取り済みの人に、値札と特典から見せる。 */
  startAt?: "chest" | "offer";
  /** 宝箱を開ける前に閉じるボタンの文言。 */
  dismissLabel?: string;
  /** 値札と特典を見せたとき（課金カードの表示計測用）。 */
  onOfferShown?: () => void;
  /**
   * 指定すると、左上に戻るボタン（矢印だけの小さな丸。この文言は読み上げ用）をどの場面でも出し、購入ボタンの下の「あとで決める」は出さない。
   * 宝箱を開ける前・クーポンを受け取る前は onDismiss、値札と特典の画面では onClose を呼ぶ。
   */
  backLabel?: string;
  /** 購入ボタンの下、返金保証の行の次に出す一言（例: 「◯人以上のお客様から信頼されています」）。backLabel を指定したときだけ出る。 */
  trustNote?: string;
};

/**
 * 完全版購入者向けのクーポンを、Aliceの星空の書斎で宝箱から受け取る全画面演出（日本語Webの結果アップグレード）。
 * クーポンは購入者全員に同じ金額で付くため、抽選や期限があるようには見せない。
 */
export function ResultUpgradeTreasure({
  couponJpy,
  listPriceJpy,
  priceJpy,
  purchaseCta,
  onChestOpened,
  onCouponReceived,
  onClose,
  onDismiss,
  offer = RESULT_UPGRADE_TREASURE_OFFER,
  startAt = "chest",
  dismissLabel = "あとで開ける",
  onOfferShown,
  backLabel,
  trustNote,
}: Props) {
  const [reducedMotion] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(startAt === "offer" ? "offer" : reducedMotion ? "idle" : "intro");
  const [priceStep, setPriceStep] = useState<PriceStep>(startAt === "offer" ? "landed" : "tag");
  const [shownPrice, setShownPrice] = useState(startAt === "offer" ? priceJpy : listPriceJpy);
  const onOfferShownRef = useRef(onOfferShown);
  const offerShown = phase === "offer";

  useEffect(() => {
    onOfferShownRef.current = onOfferShown;
  }, [onOfferShown]);

  useEffect(() => {
    if (offerShown) onOfferShownRef.current?.();
  }, [offerShown]);
  const receiveRef = useRef<HTMLButtonElement>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const frame = useRef<number | null>(null);
  const onCouponReceivedRef = useRef(onCouponReceived);
  const onCloseRef = useRef(onClose);
  const onDismissRef = useRef(onDismiss);
  const phaseRef = useRef<Phase>(phase);

  useEffect(() => {
    onCouponReceivedRef.current = onCouponReceived;
    onCloseRef.current = onClose;
    onDismissRef.current = onDismiss;
  }, [onCouponReceived, onClose, onDismiss]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // 宝箱を見ている間に、このあとの場面の絵を読み込んでおく（クーポン・値札・特典が遅れて出ないように）。
  useEffect(() => {
    preloadTreasureOffer(offer);
  }, [offer]);

  function later(callback: () => void, ms: number) {
    timers.current.push(window.setTimeout(callback, ms));
  }

  useEffect(() => {
    const pending = timers.current;
    if (!reducedMotion) {
      pending.push(window.setTimeout(() => setPhase((current) => (current === "intro" ? "idle" : current)), INTRO_MS));
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (phaseRef.current === "open") receiveRef.current?.click();
      else if (phaseRef.current === "offer") laterRef.current?.click();
      else if (phaseRef.current === "idle" || phaseRef.current === "intro") onDismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [reducedMotion]);

  function openChest() {
    if (phase !== "idle" && phase !== "intro") return;
    onChestOpened?.();
    try { navigator.vibrate?.(18); } catch { /* optional */ }
    if (reducedMotion) {
      setPhase("open");
      return;
    }
    setPhase("charging");
    later(() => {
      setPhase("open");
      try { navigator.vibrate?.([24, 40, 30]); } catch { /* optional */ }
    }, CHARGE_MS);
  }

  function vibrate(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern); } catch { /* optional */ }
  }

  // 1,398 から 899 まで、最初は速く最後はゆっくり数える。
  function countDown() {
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownPrice(Math.round(listPriceJpy - (listPriceJpy - priceJpy) * eased));
      if (t < 1) {
        frame.current = window.requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setPriceStep("landed");
      vibrate([20, 50, 36]);
      later(() => setPhase("offer"), OFFER_AFTER_LAND_MS);
    };
    frame.current = window.requestAnimationFrame(tick);
  }

  // 受け取る: クーポンが値札に貼りつき、通常価格に取り消し線が引かれ、支払額まで数えて止まる。
  function receive() {
    if (phase !== "open") return;
    onCouponReceivedRef.current();
    if (reducedMotion) {
      setPriceStep("landed");
      setShownPrice(priceJpy);
      setPhase("offer");
      return;
    }
    setPhase("pricing");
    setPriceStep("tag");
    later(() => { setPriceStep("sticker"); vibrate(14); }, STICKER_AT);
    later(() => setPriceStep("strike"), STRIKE_AT);
    later(() => { setPriceStep("counting"); countDown(); }, COUNT_AT);
  }

  function closeLater() {
    if (phase === "closing") return;
    if (reducedMotion) {
      onCloseRef.current();
      return;
    }
    setPhase("closing");
    later(() => onCloseRef.current(), CLOSE_MS);
  }

  const isClient = useIsClient();
  if (!isClient) return null;

  const opened = phase === "open" || phase === "pricing" || phase === "offer" || phase === "closing";
  const pricing = phase === "pricing" || phase === "offer" || phase === "closing";
  const stuck = priceStep !== "tag";
  const struck = priceStep === "strike" || priceStep === "counting" || priceStep === "landed";
  const counting = priceStep === "counting" || priceStep === "landed";
  const landed = priceStep === "landed";
  const chestMotion =
    phase === "intro" ? styles.dropIn
      : phase === "idle" ? styles.idle
        : phase === "charging" ? styles.charging
          : styles.opened;

  return createPortal(
    <div
      className={`${styles.overlay} ${phase === "closing" ? styles.closing : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={offer.dialogLabel}
    >
      {backLabel ? (
        (phase === "intro" || phase === "idle" || phase === "open" || phase === "offer") && (
          <button
            ref={phase === "offer" ? laterRef : undefined}
            type="button"
            className={styles.back}
            aria-label={backLabel}
            onClick={() => (phase === "offer" ? closeLater() : onDismissRef.current())}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )
      ) : !opened && (
        <button type="button" className={styles.close} onClick={() => onDismissRef.current()}>
          {dismissLabel}
        </button>
      )}
      <div className={styles.sceneBlur} aria-hidden="true">
        <Image src={ROOM_SRC} alt="" fill sizes={ROOM_BLUR_SIZES} />
      </div>
      <div className={styles.scene}>
      <div className={styles.backdrop} aria-hidden="true">
        <Image src={ROOM_SRC} alt="" fill priority sizes={ROOM_SIZES} />
      </div>
      <div className={`${styles.backdropShade} ${opened ? styles.backdropShadeOpen : ""}`} aria-hidden="true" />
      <div className={`${styles.rays} ${opened ? styles.raysOn : ""}`} aria-hidden="true" />
      {opened && !reducedMotion && (
        <div aria-hidden="true">
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              className={styles.confetti}
              style={{
                "--x": piece.x,
                "--size": piece.size,
                "--duration": piece.duration,
                "--delay": piece.delay,
                "--drift": piece.drift,
                "--rot": piece.rot,
              } as CSSProperties}
            >
              {piece.kind === "star" ? (
                <FeltStar />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- 小さな飾りを多数動かすため、最適化を通さない素の画像にする
                <img src={piece.kind === "heart" ? HEART_SRC : FLOWER_SRC} alt="" />
              )}
            </span>
          ))}
        </div>
      )}
      <div className={`${styles.flash} ${opened && !reducedMotion ? styles.flashOn : ""}`} aria-hidden="true" />

      <div className={`${styles.heading} ${opened ? styles.headingOut : ""}`}>
        <p className={styles.title}>PRESENT</p>
        <p className={styles.lead}>
          {offer.lead[0]}<br />{offer.lead[1]}
        </p>
      </div>

      <div className={`${styles.stage} ${phase === "offer" || phase === "closing" ? styles.chestDim : ""}`}>
        <div className={`${styles.glow} ${opened ? styles.glowOn : ""}`} aria-hidden="true" />
        <button
          type="button"
          className={styles.chestButton}
          onClick={openChest}
          disabled={phase !== "idle" && phase !== "intro"}
          aria-label="宝箱を開ける"
        >
          <div className={`${styles.chest} ${chestMotion}`}>
            <div className={`${styles.beam} ${opened ? styles.beamOn : ""}`} aria-hidden="true" />
            <Image
              src={CHEST_CLOSED_SRC}
              alt=""
              fill
              priority
              sizes={CHEST_SIZES}
              className={`${styles.chestImage} ${opened ? styles.hidden : ""}`}
            />
            <Image
              src={CHEST_OPEN_SRC}
              alt=""
              fill
              priority
              sizes={CHEST_SIZES}
              className={`${styles.chestImage} ${opened ? "" : styles.hidden}`}
            />
            <div
              className={`${styles.seam} ${phase === "charging" ? styles.seamCharging : opened ? styles.seamHidden : ""}`}
              aria-hidden="true"
            />
          </div>
        </button>
      </div>
      <div key={landed ? "alice-landed" : "alice"} className={`${styles.alice} ${opened ? styles.aliceHop : ""}`} aria-hidden="true">
        <Image src={ALICE_SRC} alt="" fill priority sizes={ALICE_SIZES} />
      </div>
      {phase === "open" && (
        <div className={styles.couponRise}>
          <div className={reducedMotion ? "" : styles.couponFloat}>
            <CouponTicket couponJpy={couponJpy} variant="reveal" src={offer.couponSrc} label={offer.couponLabel(couponJpy)} />
          </div>
        </div>
      )}
      {phase === "pricing" && !stuck && !reducedMotion && (
        <div className={`${styles.couponRise} ${styles.couponToTag}`} aria-hidden="true">
          <CouponTicket couponJpy={couponJpy} variant="reveal" src={offer.couponSrc} label={offer.couponLabel(couponJpy)} />
        </div>
      )}
      {pricing && (
        <div
          className={`${styles.priceTag} ${offer.priceLayout === "row" ? styles.priceTagRow : ""} ${stuck && !reducedMotion ? styles.tagShake : ""} ${phase === "offer" || phase === "closing" ? styles.priceTagOffer : ""}`}
          role="img"
          aria-label={`通常価格 ${listPriceJpy.toLocaleString("ja-JP")}円が、クーポンで ${priceJpy.toLocaleString("ja-JP")}円`}
        >
          <Image src={PRICE_TAG_SRC} alt="" fill priority sizes={PRICE_TAG_SIZES} />
          <div className={`${styles.oldPrice} ${counting ? styles.oldPriceSmall : ""}`}>
            <EmbroideredPrice value={listPriceJpy} />
            <div className={`${styles.strike} ${struck ? styles.strikeOn : ""}`} aria-hidden="true">
              <StrikeThread />
            </div>
          </div>
          {counting && (
            <div key={landed ? "landed" : "counting"} className={`${styles.newPrice} ${landed && !reducedMotion ? styles.newPriceLanded : ""}`}>
              <EmbroideredPrice value={shownPrice} />
            </div>
          )}
          {stuck && (
            <div className={styles.tagSticker} aria-hidden="true">
              <CouponTicket couponJpy={couponJpy} variant="reveal" src={offer.couponSrc} label={offer.couponLabel(couponJpy)} />
            </div>
          )}
          {stuck && !reducedMotion && (
            <span className={styles.tagBurst} aria-hidden="true">
              {SPARKLES.slice(0, 6).map((sparkle, index) => (
                <span
                  key={index}
                  className={styles.sparkle}
                  style={{
                    "--dx": `calc(${sparkle.dx} * 0.45)`,
                    "--dy": `calc(${sparkle.dy} * 0.35)`,
                    "--rot": sparkle.rot,
                    "--size": `calc(${sparkle.size} * 0.7)`,
                    "--delay": `calc(${STICKER_AT}ms + ${sparkle.delay})`,
                  } as CSSProperties}
                >
                  <FeltStar />
                </span>
              ))}
            </span>
          )}
          {landed && !reducedMotion && (
            <span className={styles.priceBurst} aria-hidden="true">
              {SPARKLES.map((sparkle, index) => (
                <span
                  key={index}
                  className={styles.sparkle}
                  style={{
                    "--dx": `calc(${sparkle.dx} * 0.8)`,
                    "--dy": `calc(${sparkle.dy} * 0.55)`,
                    "--rot": sparkle.rot,
                    "--size": sparkle.size,
                    "--delay": sparkle.delay,
                  } as CSSProperties}
                >
                  <FeltStar />
                </span>
              ))}
            </span>
          )}
        </div>
      )}
      {opened && !reducedMotion && SPARKLES.map((sparkle, index) => (
          <span
            key={index}
            className={styles.sparkle}
            aria-hidden="true"
            style={{
              "--dx": sparkle.dx,
              "--dy": sparkle.dy,
              "--rot": sparkle.rot,
              "--size": sparkle.size,
              "--delay": sparkle.delay,
            } as CSSProperties}
          >
            <FeltStar />
          </span>
        ))}

      {phase === "open" ? (
        <>
          <div className={styles.revealTop} role="status" aria-live="polite">
            <p className={styles.revealHeadline}>クーポンをゲット！</p>
          </div>
          <div className={styles.revealBottom}>
            <button ref={receiveRef} type="button" className={styles.receive} onClick={receive}>
              受け取る
            </button>
          </div>
        </>
      ) : phase === "pricing" ? (
        <div className={styles.revealTop} role="status" aria-live="polite">
          <p key="pricing" className={styles.revealHeadline}>クーポンを使うと...</p>
        </div>
      ) : phase === "offer" || phase === "closing" ? (
        <>
          <p className={styles.srOnly} role="status" aria-live="polite">
            {offer.offerSummary(priceJpy, offer.benefits.length)}
          </p>
          {offer.benefitStyle === "stack" ? (
            <BenefitStack
              benefits={offer.benefits}
              priceJpy={priceJpy}
              reducedMotion={reducedMotion}
              skipIntro={startAt === "offer"}
              autoRotate={offer.autoRotate ?? true}
            />
          ) : (
            <BenefitDeck reducedMotion={reducedMotion} benefits={offer.benefits} autoRotate={offer.autoRotate ?? true} />
          )}
          <div className={styles.offerBottom}>
            <div className={styles.offerCta}>{purchaseCta}</div>
            {backLabel ? (
              <div className={styles.offerNotes}>
                <p className={styles.offerGuarantee}>買い切り・30日間の返金保証つき</p>
                {trustNote && (
                  <p className={styles.offerTrust}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    {trustNote}
                  </p>
                )}
              </div>
            ) : (
              <div className={styles.offerLinks}>
                <button ref={laterRef} type="button" className={styles.offerLater} onClick={closeLater}>
                  あとで決める
                </button>
                <span aria-hidden="true">・</span>
                <span>買い切り・30日間の返金保証つき</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className={styles.hint} aria-hidden="true">
          宝箱をタップして開けてね
        </p>
      )}
      </div>
    </div>,
    document.body,
  );
}

/** フェルトのクーポン券。演出の中（reveal）と、受け取ったあとのチャットの中（chat）で使う。 */
export function CouponTicket({
  couponJpy,
  variant,
  src = COUPON_SRC,
  label = RESULT_UPGRADE_TREASURE_OFFER.couponLabel(couponJpy),
}: {
  couponJpy: number;
  variant: "reveal" | "chat";
  src?: string;
  label?: string;
}) {
  return (
    <div className={variant === "reveal" ? styles.ticketShadow : styles.ticketInChat}>
      <div
        className={styles.ticket}
        role="img"
        aria-label={`${label}${variant === "chat" ? "（受け取り済み）" : ""}`}
      >
        <Image src={src} alt="" fill sizes={COUPON_SIZES} priority={variant === "reveal"} />
        {variant === "chat" && (
          <span className={styles.ticketStamp} aria-hidden="true">受け取り<br />済み</span>
        )}
      </div>
    </div>
  );
}

/** 特典カードの中身（ラベル・絵・タイトル・説明）。 */
function BenefitFace({ benefit, compact = false }: { benefit: TreasureBenefit; compact?: boolean }) {
  return (
    <>
      <span className={styles.benefitLabel}>{benefit.label}</span>
      <span className={styles.benefitVisual} aria-hidden="true">
        {benefit.beforeAfter ? (
          <span className={styles.beforeAfter}>
            <span className={styles.beforeImage}>
              <Image src={BENEFIT_BEFORE_SRC} alt="" fill sizes="110px" />
            </span>
            <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h14M13 6l6 6-6 6" />
            </svg>
            <span className={styles.afterImage}>
              <Image src={benefit.image} alt="" fill sizes="160px" />
            </span>
            <span className={styles.sampleBadge}>見本</span>
          </span>
        ) : benefit.screenshot ? (
          <>
            <span className={styles.benefitShot}>
              <Image src={benefit.image} alt="" fill sizes="(max-width: 520px) 52vw, 200px" />
            </span>
            {!compact && <span className={styles.sampleBadge}>見本</span>}
          </>
        ) : (
          <Image src={benefit.image} alt="" fill sizes={BENEFIT_SIZES} />
        )}
      </span>
      <span className={styles.benefitTitle}>{benefit.title}</span>
      {!compact && <span className={styles.benefitBody}>{benefit.body}</span>}
    </>
  );
}

// 先頭の特典（その人が開けようとしたもの）を1枚だけ見せておく時間。このあと残りのカードが加わる。
const STACK_HERO_HOLD_MS = 1300;
// 残りのカードは1枚ずつ、加わったと分かる間隔で入る。カードが着くたびに「＋1」「＋2」…と数える。
const STACK_GAP_MS = 200;
const STACK_LAND_MS = 340;
// 最後の1枚が着いて「＋6」になってから、合計を出すまでの間。
const STACK_SETTLE_MS = 750;
const STACK_TOTAL_HOLD_MS = 1400;
// 残りのカードが、先頭のカードの後ろへ左右に扇のように広がって加わる位置（毎回同じ見た目にするため固定値）。
// 左右交互に、外側から内側へ入る。1枚ずつ見えるよう、広めに開く。
const STACK_FAN_POSES = [
  { rot: -18, dx: -78, dy: 16, fromX: -170, fromRot: -44 },
  { rot: 18, dx: 78, dy: 16, fromX: 170, fromRot: 44 },
  { rot: -12, dx: -54, dy: 0, fromX: -150, fromRot: -36 },
  { rot: 12, dx: 54, dy: 0, fromX: 150, fromRot: 36 },
  { rot: -6, dx: -28, dy: -10, fromX: -120, fromRot: -28 },
  { rot: 6, dx: 28, dy: -10, fromX: 120, fromRot: 28 },
] as const;

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* optional */ }
}

/**
 * はじめに先頭の特典（その人が開けようとしたもの）のカードが1枚だけ出る。
 * そこへ残りのカードが1枚ずつ後ろから扇のように加わり（加わるたびに「＋1」…「＋6」と数える）、
 * 「◯つ全部で ¥499」を押したあと、回る特典スライドに変わる。
 */
function BenefitStack({
  benefits,
  priceJpy,
  reducedMotion,
  skipIntro,
  autoRotate,
}: {
  benefits: readonly TreasureBenefit[];
  priceJpy: number;
  reducedMotion: boolean;
  skipIntro: boolean;
  autoRotate: boolean;
}) {
  const instant = reducedMotion || skipIntro;
  const count = benefits.length;
  const [step, setStep] = useState<"hero" | "joining" | "total" | "deck">(instant ? "deck" : "hero");
  // 先頭のカードに加わった枚数（「＋1」〜「＋6」の表示用）。
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (instant) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => buzz(14), 380));
    timers.push(window.setTimeout(() => setStep("joining"), STACK_HERO_HOLD_MS));
    for (let i = 0; i < count - 1; i++) {
      timers.push(window.setTimeout(() => { setAdded(i + 1); buzz(8); }, STACK_HERO_HOLD_MS + i * STACK_GAP_MS + STACK_LAND_MS));
    }
    const allAdded = STACK_HERO_HOLD_MS + (count - 2) * STACK_GAP_MS + STACK_LAND_MS + STACK_SETTLE_MS;
    timers.push(window.setTimeout(() => { setStep("total"); buzz([18, 40, 28]); }, allAdded));
    timers.push(window.setTimeout(() => setStep("deck"), allAdded + STACK_TOTAL_HOLD_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count, instant]);

  if (step === "deck") {
    return <BenefitDeck reducedMotion={reducedMotion} benefits={benefits} autoRotate={autoRotate} />;
  }
  return (
    <div className={styles.stackArea}>
      <div className={`${styles.stackPile} ${step === "total" ? styles.stackPileDone : ""}`} aria-hidden="true">
        {step !== "hero" && benefits.slice(1).map((benefit, i) => {
          const pose = STACK_FAN_POSES[i % STACK_FAN_POSES.length];
          return (
            <div
              key={benefit.label}
              className={styles.stackCard}
              style={{
                "--rot": `${pose.rot}deg`,
                "--dx": `${pose.dx}px`,
                "--dy": `${pose.dy}px`,
                "--from-x": `${pose.fromX}px`,
                "--from-rot": `${pose.fromRot}deg`,
                "--delay": `${i * STACK_GAP_MS}ms`,
                zIndex: i,
              } as CSSProperties}
            >
              <span className={`${styles.benefitCard} ${styles.stackFace}`}>
                <BenefitFace benefit={benefit} compact />
              </span>
            </div>
          );
        })}
        <div className={`${styles.stackHero} ${step === "hero" ? styles.stackHeroSolo : ""}`}>
          <span className={`${styles.benefitCard} ${styles.stackFace}`}>
            <BenefitFace benefit={benefits[0]} compact />
          </span>
        </div>
        {/* カードが1枚加わるたびに「＋1」「＋2」…と数える札。数字は刺しゅうの絵。 */}
        {step === "joining" && added > 0 && (
          <div key={added} className={styles.stackPlus}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
              <path d="M12 4v16M4 12h16" />
            </svg>
            {/* eslint-disable-next-line @next/next/no-img-element -- 刺しゅうの数字を1文字ずつ差し替えるため、最適化を通さない素の画像にする */}
            <img src={glyphSrc(String(added))} alt="" />
          </div>
        )}
      </div>
      {step === "total" && (
        <div className={styles.totalStamp} role="img" aria-label={`${count}つ全部で ${priceJpy.toLocaleString("ja-JP")}円`}>
          <span className={styles.totalCount}>{count}つ全部で</span>
          <span className={styles.totalPrice}>
            <EmbroideredPrice value={priceJpy} />
          </span>
        </div>
      )}
    </div>
  );
}

// 指でスライドを動かすときの設定。
// これ以上横に動いたらスワイプとして扱う（それ未満はタップ）。
const SWIPE_START_PX = 8;
// カード幅のこの割合ぶん指を動かすと、ちょうど1枚ぶん回る。
const SWIPE_CARD_RATIO = 0.62;
// 1枚ぶんのこの割合を超えて離したら、次（前）のカードへ送る。
const SWIPE_COMMIT_RATIO = 0.18;

/** 正面からの距離（0=正面、+1=右奥、-1=左奥、小数は指で動かしている途中）から、カードの見た目を決める。 */
function deckCardStyle(distance: number): CSSProperties {
  const away = Math.abs(distance);
  const side = distance < 0 ? -1 : 1;
  const zIndex = 30 - Math.round(away * 10) + (distance > 0 ? 1 : 0);
  if (away <= 1) {
    return {
      transform: `translateX(${46 * distance}%) translateZ(${-220 * away}px) rotateY(${-40 * distance}deg) scale(${1 - 0.14 * away})`,
      filter: away < 0.001 ? "none" : `brightness(${1 - 0.38 * away}) saturate(${1 - 0.2 * away})`,
      opacity: 1,
      zIndex,
    };
  }
  // 左右の奥から、さらに裏へ回って消えていく。
  const behind = Math.min(away - 1, 1);
  return {
    transform: `translateX(${46 * side * (1 - behind)}%) translateZ(${-220 - 200 * behind}px) rotateY(${-40 * side * (1 - behind)}deg) scale(${0.86 - 0.06 * behind})`,
    filter: "brightness(0.62) saturate(0.8)",
    opacity: 1 - behind,
    zIndex,
  };
}

/** 購入で手に入る特典のスライド。カードが輪になって回り、指で左右に動かすことも、タップで次へ進むこともできる。 */
function BenefitDeck({
  reducedMotion,
  inline = false,
  benefits = BENEFITS,
  autoRotate = true,
}: {
  reducedMotion: boolean;
  inline?: boolean;
  benefits?: readonly TreasureBenefit[];
  /** false のときは自動では回さない（指で動かす・タップで次へ、だけ）。 */
  autoRotate?: boolean;
}) {
  const [index, setIndex] = useState(0);
  // 指で動かしている量（カード何枚ぶんか。正の値で次のカードが正面に来る）。動かしていないときは null。
  const [drag, setDrag] = useState<number | null>(null);
  const pointer = useRef<{ id: number; startX: number; width: number; swiping: boolean; moved: number } | null>(null);
  const skipClick = useRef(false);
  const count = benefits.length;
  const dragging = drag !== null;
  useEffect(() => {
    // 指で動かしている間は自動で回さない。離すと、そこからまた数え直す。
    if (!autoRotate || reducedMotion || dragging) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), BENEFIT_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [autoRotate, count, index, reducedMotion, dragging]);

  const wrap = (value: number) => ((value % count) + count) % count;
  const offset = drag ?? 0;

  const endSwipe = (commit: boolean) => {
    const state = pointer.current;
    pointer.current = null;
    if (!state?.swiping) return;
    if (commit) {
      // 画面の描き直しを待たず、指が最後にいた位置で決める（素早く払ったときに取りこぼさない）。
      const moved = state.moved;
      let steps = Math.round(moved);
      if (steps === 0 && Math.abs(moved) > SWIPE_COMMIT_RATIO) steps = moved > 0 ? 1 : -1;
      if (steps !== 0) setIndex((value) => wrap(value + steps));
    }
    setDrag(null);
  };

  return (
    <>
      <div
        className={`${styles.deck} ${inline ? styles.deckInline : ""}`}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          skipClick.current = false;
          pointer.current = {
            id: event.pointerId,
            startX: event.clientX,
            width: event.currentTarget.offsetWidth || 1,
            swiping: false,
            moved: 0,
          };
        }}
        onPointerMove={(event) => {
          const state = pointer.current;
          if (!state || state.id !== event.pointerId) return;
          const dx = event.clientX - state.startX;
          if (!state.swiping) {
            if (Math.abs(dx) < SWIPE_START_PX) return;
            state.swiping = true;
            // 指を離したときにカードの「タップで次へ」が動かないようにする。
            skipClick.current = true;
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional */ }
          }
          state.moved = -dx / (state.width * SWIPE_CARD_RATIO);
          setDrag(state.moved);
        }}
        onPointerUp={() => endSwipe(true)}
        onPointerCancel={() => endSwipe(false)}
        onDragStart={(event) => event.preventDefault()}
      >
        {benefits.map((benefit, i) => {
          // 正面からの距離を -count/2 〜 count/2 に収める（輪になっているので、近い側で数える）。
          let distance = wrap(i - index) - offset;
          distance -= Math.round(distance / count) * count;
          const front = wrap(i - index) === 0;
          return (
            <button
              key={benefit.label}
              type="button"
              className={styles.benefitCard}
              onClick={() => {
                if (skipClick.current) {
                  skipClick.current = false;
                  return;
                }
                setIndex((value) => (value + 1) % count);
              }}
              aria-label={`${benefit.label} ${benefit.title}。${benefit.body}`}
              aria-hidden={front ? undefined : true}
              tabIndex={front ? 0 : -1}
              style={{
                ...deckCardStyle(distance),
                // 指で動かしている間は、指にぴったり付いてくるようにする。
                ...(dragging ? { transition: "none" } : null),
              }}
            >
              <BenefitFace benefit={benefit} />
            </button>
          );
        })}
      </div>
      <div className={`${styles.dots} ${inline ? styles.dotsInline : ""}`} aria-hidden="true">
        {benefits.map((benefit, i) => (
          <span
            key={benefit.label}
            className={`${styles.dot} ${i === wrap(index + Math.round(offset)) ? styles.dotActive : ""}`}
          />
        ))}
      </div>
    </>
  );
}

/**
 * チャットの購入カード（日本語Webの7問の会話で、クーポンを受け取ったあと）。
 * 宝箱の演出の最後と同じ値札と特典スライドを、フェルトのカードに並べる。
 */
export function ResultUpgradeOfferCard({
  couponJpy,
  listPriceJpy,
  priceJpy,
  savedLabel,
  note,
  purchaseCta,
}: {
  couponJpy: number;
  listPriceJpy: number;
  priceJpy: number;
  savedLabel: string;
  note: string;
  purchaseCta: ReactNode;
}) {
  const [reducedMotion] = useState(prefersReducedMotion);
  return (
    <section className={styles.offerCard} aria-label="結果のアップグレード">
      <p className={styles.offerCardSaved}>{savedLabel}</p>
      <div
        className={`${styles.priceTag} ${styles.priceTagInline}`}
        role="img"
        aria-label={`通常価格 ${listPriceJpy.toLocaleString("ja-JP")}円が、クーポンで ${priceJpy.toLocaleString("ja-JP")}円`}
      >
        <Image src={PRICE_TAG_SRC} alt="" fill sizes="300px" />
        <div className={`${styles.oldPrice} ${styles.oldPriceSmall}`}>
          <EmbroideredPrice value={listPriceJpy} />
          <div className={styles.strike} aria-hidden="true">
            <StrikeThread />
          </div>
        </div>
        <div className={styles.newPrice}>
          <EmbroideredPrice value={priceJpy} />
        </div>
        <div className={styles.tagSticker} aria-hidden="true">
          <CouponTicket couponJpy={couponJpy} variant="reveal" />
        </div>
      </div>
      <p className={styles.offerCardTax}>お支払い ¥{priceJpy.toLocaleString("ja-JP")}（税込・買い切り）</p>
      <p className={styles.offerCardHeading}>¥{priceJpy.toLocaleString("ja-JP")} で手に入る{BENEFITS.length}つの特典</p>
      <div className={styles.deckInlineWrap}>
        <BenefitDeck reducedMotion={reducedMotion} inline />
      </div>
      <div className={styles.offerCardCta}>{purchaseCta}</div>
      <p className={styles.offerCardNote}>{note}</p>
    </section>
  );
}

/** 刺しゅうの数字の絵を並べて、金額（例: ¥1,398）を表示する。 */
function EmbroideredPrice({ value }: { value: number }) {
  const chars = ["¥", ...value.toLocaleString("en-US")];
  return (
    <span className={styles.price} aria-hidden="true">
      {chars.map((char, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- 1文字ずつ差し替えて数えるため、最適化を通さない素の画像にする
        <img
          key={`${index}-${char}`}
          src={glyphSrc(char)}
          alt=""
          className={char === "," ? styles.comma : char === "¥" ? styles.yen : undefined}
        />
      ))}
    </span>
  );
}

/** 金の糸の取り消し線。ねじれた糸に見えるよう、濃い金と明るい金を重ねる。 */
function StrikeThread() {
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      <path d="M1 13 C30 9 70 9 99 7" fill="none" stroke="#9C6416" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M1 12.4 C30 8.4 70 8.4 99 6.4" fill="none" stroke="#F2C14E" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M1 12 C30 8 70 8 99 6" fill="none" stroke="#FFF3C4" strokeWidth="0.7" strokeDasharray="2 1.6" strokeLinecap="round" />
    </svg>
  );
}

/** ふっくらしたフェルトの金の星（舞う飾り・きらめき）。 */
function FeltStar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="felt-star-fill" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#FFF0B8" />
          <stop offset="55%" stopColor="#F2C14E" />
          <stop offset="100%" stopColor="#C98E25" />
        </radialGradient>
      </defs>
      <path
        d="M12 1.8l3 6.3 6.9.8-5.1 4.7 1.4 6.8L12 16.9l-6.2 3.5 1.4-6.8-5.1-4.7 6.9-.8z"
        fill="url(#felt-star-fill)"
        stroke="#B57E1E"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 5.2l2 4.2 4.6.5-3.4 3.1.9 4.5L12 15.2l-4.1 2.3.9-4.5-3.4-3.1 4.6-.5z"
        fill="none"
        stroke="#FFF6D6"
        strokeWidth="0.7"
        strokeDasharray="1.2 1"
        opacity="0.8"
      />
    </svg>
  );
}
