"use client";

import Image from "next/image";
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
  /** deck: 回るカード（既定） / stack: 積み重ねて合計額を見せてから回るカードへ。 */
  benefitStyle?: "deck" | "stack";
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
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Props = {
  couponJpy: number;
  /** 通常価格（取り消し線を引く値段）と、クーポン適用後の支払額。 */
  listPriceJpy: number;
  priceJpy: number;
  /** 最後に出す購入ボタン（押すと決済画面へ進む）。 */
  purchaseCta: ReactNode;
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
  onCouponReceived,
  onClose,
  onDismiss,
  offer = RESULT_UPGRADE_TREASURE_OFFER,
  startAt = "chest",
  dismissLabel = "あとで開ける",
  onOfferShown,
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
      {!opened && (
        <button type="button" className={styles.close} onClick={() => onDismissRef.current()}>
          {dismissLabel}
        </button>
      )}
      <div className={styles.sceneBlur} aria-hidden="true">
        <Image src={ROOM_SRC} alt="" fill sizes="100vw" />
      </div>
      <div className={styles.scene}>
      <div className={styles.glyphPreload} aria-hidden="true">
        {GLYPHS.map((name) => (
          // eslint-disable-next-line @next/next/no-img-element -- 数字の絵を先に読み込み、数える間に表示が欠けないようにする
          <img key={name} src={`/result-upgrade/digits/${name}.webp`} alt="" />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element -- 値札の絵を先に読み込む */}
        <img src={PRICE_TAG_SRC} alt="" />
      </div>
      <div className={styles.backdrop} aria-hidden="true">
        <Image src={ROOM_SRC} alt="" fill priority sizes="(max-width: 520px) 100vw, 60vh" />
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
              sizes="(max-width: 520px) 74vw, 380px"
              className={`${styles.chestImage} ${opened ? styles.hidden : ""}`}
            />
            <Image
              src={CHEST_OPEN_SRC}
              alt=""
              fill
              priority
              sizes="(max-width: 520px) 74vw, 380px"
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
        <Image src={ALICE_SRC} alt="" fill priority sizes="(max-width: 520px) 28vw, 140px" />
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
          className={`${styles.priceTag} ${stuck && !reducedMotion ? styles.tagShake : ""} ${phase === "offer" || phase === "closing" ? styles.priceTagOffer : ""}`}
          role="img"
          aria-label={`通常価格 ${listPriceJpy.toLocaleString("ja-JP")}円が、クーポンで ${priceJpy.toLocaleString("ja-JP")}円`}
        >
          <Image src={PRICE_TAG_SRC} alt="" fill priority sizes="(max-width: 520px) 88vw, 360px" />
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
            />
          ) : (
            <BenefitDeck reducedMotion={reducedMotion} benefits={offer.benefits} />
          )}
          <div className={styles.offerBottom}>
            <div className={styles.offerCta}>{purchaseCta}</div>
            <div className={styles.offerLinks}>
              <button ref={laterRef} type="button" className={styles.offerLater} onClick={closeLater}>
                あとで決める
              </button>
              <span aria-hidden="true">・</span>
              <span>買い切り・30日間の返金保証つき</span>
            </div>
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
        <Image src={src} alt="" fill sizes="(max-width: 520px) 84vw, 330px" priority={variant === "reveal"} />
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
          <Image src={benefit.image} alt="" fill sizes="(max-width: 520px) 70vw, 260px" />
        )}
      </span>
      <span className={styles.benefitTitle}>{benefit.title}</span>
      {!compact && <span className={styles.benefitBody}>{benefit.body}</span>}
    </>
  );
}

// 特典カードが1枚ずつ飛んできて積み重なる位置（毎回同じ見た目にするため固定値）。
const STACK_GAP_MS = 190;
const STACK_SETTLE_MS = 520;
const STACK_TOTAL_HOLD_MS = 1500;
const STACK_POSES = [
  { rot: -9, dx: -18, dy: 14, fromX: -140, fromRot: -40 },
  { rot: 7, dx: 16, dy: 6, fromX: 150, fromRot: 35 },
  { rot: -4, dx: -8, dy: -4, fromX: -120, fromRot: -28 },
  { rot: 10, dx: 20, dy: -10, fromX: 140, fromRot: 42 },
  { rot: -7, dx: -14, dy: -2, fromX: -150, fromRot: -36 },
  { rot: 4, dx: 8, dy: -8, fromX: 120, fromRot: 30 },
  { rot: -1, dx: 0, dy: -4, fromX: 0, fromRot: -12 },
] as const;

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* optional */ }
}

/**
 * 特典カードがバッと積み重なり「◯つ全部で ¥499」を押したあと、回る特典スライドに変わる。
 */
function BenefitStack({
  benefits,
  priceJpy,
  reducedMotion,
  skipIntro,
}: {
  benefits: readonly TreasureBenefit[];
  priceJpy: number;
  reducedMotion: boolean;
  skipIntro: boolean;
}) {
  const instant = reducedMotion || skipIntro;
  const count = benefits.length;
  const [step, setStep] = useState<"stacking" | "total" | "deck">(instant ? "deck" : "stacking");

  useEffect(() => {
    if (instant) return;
    const timers: number[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(window.setTimeout(() => buzz(8), i * STACK_GAP_MS + 380));
    }
    const stacked = count * STACK_GAP_MS + STACK_SETTLE_MS;
    timers.push(window.setTimeout(() => { setStep("total"); buzz([18, 40, 28]); }, stacked));
    timers.push(window.setTimeout(() => setStep("deck"), stacked + STACK_TOTAL_HOLD_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count, instant]);

  if (step === "deck") {
    return <BenefitDeck reducedMotion={reducedMotion} benefits={benefits} />;
  }
  return (
    <div className={styles.stackArea}>
      <div className={`${styles.stackPile} ${step === "total" ? styles.stackPileDone : ""}`} aria-hidden="true">
        {benefits.map((benefit, i) => {
          const pose = STACK_POSES[i % STACK_POSES.length];
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
}: {
  reducedMotion: boolean;
  inline?: boolean;
  benefits?: readonly TreasureBenefit[];
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
    if (reducedMotion || dragging) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), BENEFIT_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, index, reducedMotion, dragging]);

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
