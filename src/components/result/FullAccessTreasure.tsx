"use client";

import {
  ResultUpgradeTreasure,
  type TreasureBenefit,
  type TreasureOffer,
} from "@/components/result-upgrade/ResultUpgradeTreasure";
import { THREE_COURSE_PAYWALL_VERSION } from "@/lib/access-products";
import {
  jaFullAccessOfferForArm,
  jaFullAccessOfferForQuote,
  type JaFullAccessPriceArm,
} from "@/lib/full-access-pricing";
import { normalizePaywallSource } from "@/lib/paywall-source";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import type { FullAccessQuoteState } from "@/lib/use-full-access-quote";
import { useEffect, useRef, useState } from "react";
import { FullAccessCta } from "./FullAccessCta";

// 日本語Webの完全版（¥499）: 課金カードを開くCTAを押したとき、課金カードの代わりに
// 宝箱から「リリース記念 ¥800 OFF」クーポンを受け取る全画面演出を出す。
// クーポンは全員に同じ額で付く（通常価格¥1,299 − ¥800 = 請求額¥499）。抽選や期限があるようには見せない。
// 2026-11-22からの価格テストで¥699の群に入った人には、同じ¥800クーポンで 通常価格¥1,499 − ¥800 = ¥699 を見せる。
// 値札の額は必ずサーバーの見積もり（priceState）から決め、決済で請求する額と同じにする。

const COUPON_RECEIVED_KEY = "torisetsu_full_access_coupon_received";

export function fullAccessCouponReceived(): boolean {
  try {
    return window.sessionStorage.getItem(COUPON_RECEIVED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCouponReceived() {
  try {
    window.sessionStorage.setItem(COUPON_RECEIVED_KEY, "1");
  } catch {
    /* 保存できなくても演出は続ける */
  }
}

// 課金カード（FULL_ACCESS_SELF_UNLOCKS）と同じ7つの解放内容。
// 絵は宝箱の世界観にそろえて、サイトの羊毛フェルトの絵（背景透過）を使う。
type FullAccessBenefitKey = "sections" | "book" | "chat" | "fortune" | "aisho" | "friends" | "report";

const FULL_ACCESS_BENEFITS: readonly (Omit<TreasureBenefit, "label"> & { key: FullAccessBenefitKey })[] = [
  {
    key: "sections",
    title: "自己診断結果のすべてを解放",
    body: "恋愛・キャリアの深掘りから、周りから見た印象まで、ロック中の9セクションをすべて読めます",
    // 星の錠前が外れて9枚のカードが飛び出す絵。全員に同じ絵を出す。
    image: "/result-upgrade/benefit-sections.webp",
  },
  {
    key: "book",
    title: "16ページ以上の専用電子書籍",
    body: "あなたの性格や特徴を一冊に。保存・印刷して、いつでも読み返せます",
    image: "/result-upgrade/benefit-book.webp",
  },
  {
    key: "chat",
    title: "専属占い師Aliceとのチャット",
    body: "あなたの性格や星を理解したAliceが、恋愛・仕事・人間関係の悩みに答えます",
    image: "/result-upgrade/benefit-line-chat.webp",
  },
  {
    key: "fortune",
    title: "Aliceの占いをすべて解放",
    body: "西洋占星術の「運命の設計図」と、恋愛・仕事・人間関係を占うタロット",
    image: "/mascot/unmei-hero-alice-transparent.png",
  },
  {
    key: "aisho",
    title: "相性診断をすべて解放",
    body: "恋愛・友情・仕事での相性から、すれ違いやすいポイントまで読み解けます",
    image: "/result-upgrade/benefit-aisho.webp",
  },
  {
    key: "friends",
    title: "2人目以降の友達診断結果",
    body: "友達から見たキャラ・性格のギャップ・恋愛傾向まで、友達ごとの結果をすべて読めます",
    image: "/result-upgrade/benefit-friends.webp",
  },
  {
    key: "report",
    title: "みんなから見た分析レポート",
    body: "友達の回答をまとめた他己分析PDF。回答が増えるたびに何度でも更新できます",
    image: "/result-upgrade/benefit-friends-report.webp",
  },
];

// 鍵つきの本文から来た人には、先頭のカード（自己診断結果のすべてを解放）の説明を、押した鍵の中身に合わせる。
// 言葉は、それぞれの鍵のカードの「ここから先には、〜が書かれています。」に合わせる。
const SECTION_HERO_BODIES: Readonly<Record<string, string>> = {
  love_payoff_card: "あなたの恋愛の続きも、ぜんぶ読めます",
  love_endure_card: "恋人が言えずにいる気持ちも、ぜんぶ読めます",
  career_fit_card: "あなたに合う働き方と避けたい職場も、ぜんぶ読めます",
  career_relations_card: "職場の人間関係のつくり方も、ぜんぶ読めます",
  scene_caution_card: "シーン別のつまずきポイントも、ぜんぶ読めます",
  moshimo_card: "予想外の瞬間に出るあなたの本性も、ぜんぶ読めます",
  friend_dislike_card: "友達から誤解されやすいポイントも、ぜんぶ読めます",
  relations_card: "周りの人が言えずにいることも、ぜんぶ読めます",
  caution_lock_card: "残りの注意点と対処法も、ぜんぶ読めます",
};

// 下部ナビ・ハンバーガーメニューの鍵から来た人には、その機能を先頭にする。
const NAV_HERO_KEYS: Readonly<Record<string, FullAccessBenefitKey>> = {
  nav_locked_hoshiyomi: "chat",
  nav_locked_aisho: "aisho",
  nav_aisho_locked: "aisho",
  nav_locked_tarot: "fortune",
  nav_locked_unmei: "fortune",
};

const BENEFIT_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦"] as const;

/**
 * 7つの解放内容を、その人が開けようとしたもの（導線 ctaSource から決める）を先頭にして返す。
 * 導線が分からないとき・ページ全体の解除（上部バー、ページ末尾のカード）のときは「自己診断結果のすべてを解放」を先頭にする。
 * 「特典①〜⑦」の番号は、並べ替えたあとの順に振る。
 */
function fullAccessBenefits(ctaSource: string | undefined): TreasureBenefit[] {
  const heroKey: FullAccessBenefitKey = (ctaSource && NAV_HERO_KEYS[ctaSource]) || "sections";
  const sectionBody = ctaSource ? SECTION_HERO_BODIES[ctaSource] : undefined;
  const hero = FULL_ACCESS_BENEFITS.find((benefit) => benefit.key === heroKey) ?? FULL_ACCESS_BENEFITS[0];
  const rest = FULL_ACCESS_BENEFITS.filter((benefit) => benefit !== hero);
  return [sectionBody ? { ...hero, body: sectionBody } : hero, ...rest].map((benefit, index) => ({
    label: `特典${BENEFIT_NUMBERS[index]}`,
    title: benefit.title,
    body: benefit.body,
    image: benefit.image,
  }));
}

function fullAccessOffer(ctaSource: string | undefined): TreasureOffer {
  return {
    dialogLabel: "Aliceからのプレゼント",
    lead: ["診断してくれた", "あなたへのプレゼント"],
    couponSrc: "/result-upgrade/coupon-full-access-800.webp",
    couponLabel: (couponJpy) => `リリース記念 ¥${couponJpy.toLocaleString("ja-JP")} OFFクーポン（完全版に使えます）`,
    offerSummary: (priceJpy, count) =>
      `クーポンを使うと、完全版が ${priceJpy.toLocaleString("ja-JP")}円。次の${count}つがすべて解放されます。`,
    benefits: fullAccessBenefits(ctaSource),
    benefitStyle: "stack",
    // 先頭はその人が開けようとしたもの。勝手に次へ回さず、本人が指で送る。
    autoRotate: false,
    priceLayout: "row",
  };
}

// 宝箱の中の進み具合（2026-11-25 追加）。開いた人がどの場面で閉じているかを見る。
// chest_opened: 宝箱を押して開けた / coupon_received: 「受け取る」を押した / closed: 戻るで閉じた。
// closed には、そのときの場面（chest: 開ける前 / coupon: クーポンが出たところ / offer: 値札と特典）を付ける。
type TreasureStep = "chest_opened" | "coupon_received" | "closed";
type TreasureStage = "chest" | "coupon" | "pricing" | "offer";

type Props = {
  ownerToken?: string;
  ctaSource?: string;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  surface?: "self" | "tako";
  variant?: "self" | "aisho";
  previewMode?: boolean;
  /** プレビュー用: 価格テストのどちらの群の値札を見せるか（未指定は従来の¥499）。 */
  previewArm?: JaFullAccessPriceArm;
  priceState?: FullAccessQuoteState;
  /**
   * 閉じたとき。宝箱を開けずに「閉じる」を押したときも、値札と特典を見たあと「あとで決める」を
   * 押したときも、課金カードは出さずに元のページへ戻す（2026-11-22 本人指示）。
   */
  onClose: () => void;
};

export function FullAccessTreasure({
  ownerToken,
  ctaSource,
  returnTo,
  surface,
  variant,
  previewMode = false,
  previewArm = "control",
  priceState,
  onClose,
}: Props) {
  // 宝箱は見積もりが日本円の完全版の額と分かってから開く（PaywallModal）ので、通常は見積もりから決まる。
  // 開いている間に額が変わらないよう、最初に決めた値札を使い続ける。
  const [priceOffer] = useState(() =>
    (previewMode ? null : jaFullAccessOfferForQuote(priceState?.quote)) ?? jaFullAccessOfferForArm(previewArm));
  // 同じタブで受け取り済みなら、宝箱を開け直させずに値札と特典から見せる。
  const [startAt] = useState<"chest" | "offer">(() => (fullAccessCouponReceived() ? "offer" : "chest"));
  const [offer] = useState(() => fullAccessOffer(ctaSource));
  const shownAt = useRef<number | null>(null);
  const offerShownAt = useRef<number | null>(null);
  const stage = useRef<TreasureStage>(startAt === "offer" ? "offer" : "chest");
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  // 受け口（DB）はイベント名の許可リストを持ち、知らない名前が1つでも混ざると同じ束の記録ごと捨てる。
  // そのため新しい名前は足さず、既存の paywall_plan_viewed に placement: "treasure" と step を付けて送る
  // （課金カードの3コース表示の記録は placement が inline / modal なので、混ざらない）。
  // paywall_viewed と同じく、同じタブ・同じページでは場面ごとに1回だけ送る。
  function trackStep(step: TreasureStep) {
    if (previewMode) return;
    const page = trackingPageFromPathname(window.location.pathname);
    const dedupKey = `torisetsu_treasure_step_${page}_${THREE_COURSE_PAYWALL_VERSION}_${step}`;
    try {
      if (window.sessionStorage.getItem(dedupKey)) return;
    } catch {
      /* sessionStorage 不可でも計測は試みる */
    }
    const now = performance.now();
    track("paywall_plan_viewed", {
      ownerToken: ownerToken ?? null,
      metadata: {
        page,
        variant: variant ?? "self",
        product: "full_access",
        paywall_version: THREE_COURSE_PAYWALL_VERSION,
        placement: "treasure",
        surface: surface ?? "self",
        source: normalizePaywallSource(ctaSource),
        step,
        start: startAt,
        displayed_price_minor: priceOffer.saleAmount,
        // 宝箱が出てからの時間。closed では、値札と特典の画面を見ていた時間も付ける。
        elapsed_ms: Math.round(now - (shownAt.current ?? now)),
        ...(step === "closed"
          ? {
              stage: stage.current,
              ...(offerShownAt.current !== null ? { offer_ms: Math.round(now - offerShownAt.current) } : {}),
            }
          : {}),
      },
    });
    try {
      window.sessionStorage.setItem(dedupKey, "1");
    } catch {
      /* noop */
    }
  }

  function closeWithStep() {
    trackStep("closed");
    onClose();
  }
  // 課金カードと同じ dedup キーで paywall_viewed を1回だけ送る（モーダルを開いた時点＝従来と同じ時点）。
  useEffect(() => {
    if (previewMode) return;
    const page = trackingPageFromPathname(window.location.pathname);
    const dedupKey = `torisetsu_paywall_viewed_${page}_${THREE_COURSE_PAYWALL_VERSION}_modal`;
    try {
      if (window.sessionStorage.getItem(dedupKey)) return;
    } catch {
      /* sessionStorage 不可でも計測は試みる */
    }
    track("paywall_viewed", {
      ownerToken: ownerToken ?? null,
      metadata: {
        page,
        variant: variant ?? "self",
        product: "full_access",
        paywall_version: THREE_COURSE_PAYWALL_VERSION,
        placement: "modal",
        surface: surface ?? "self",
        presentation: startAt === "offer" ? "treasure_offer" : "treasure",
        displayed_price_minor: priceOffer.saleAmount,
      },
    });
    try {
      window.sessionStorage.setItem(dedupKey, "1");
    } catch {
      /* noop */
    }
  }, [ownerToken, previewMode, priceOffer, startAt, surface, variant]);

  return (
    <ResultUpgradeTreasure
      couponJpy={priceOffer.couponAmount}
      listPriceJpy={priceOffer.listAmount}
      priceJpy={priceOffer.saleAmount}
      offer={offer}
      startAt={startAt}
      backLabel="戻る"
      // 課金カードの信頼行と同じ文言・同じ数字（無料診断の累計完了者数）。
      trustNote={`${DIAGNOSIS_COUNT_SNAPSHOT}人以上のお客様から信頼されています`}
      purchaseCta={
        <FullAccessCta
          ownerToken={ownerToken}
          unauthHref="/diagnosis"
          locale="ja"
          source={ctaSource}
          returnTo={returnTo}
          product="full_access"
          paywallVersion={THREE_COURSE_PAYWALL_VERSION}
          placement="modal"
          previewMode={previewMode}
          priceState={priceState}
          // 紺と金の舞台の中でいちばん目に入るよう、エメラルドにする（2026-11-23 本人が色の見比べから選択）。
          accentColor="linear-gradient(180deg, #3FAE78 0%, #2E8A5B 100%)"
          shadowColor="#1F6441"
        >
          全ての機能をアンロック
        </FullAccessCta>
      }
      onChestOpened={() => {
        stage.current = "coupon";
        trackStep("chest_opened");
      }}
      onCouponReceived={() => {
        saveCouponReceived();
        stage.current = "pricing";
        trackStep("coupon_received");
      }}
      onOfferShown={() => {
        stage.current = "offer";
        offerShownAt.current = performance.now();
      }}
      onClose={closeWithStep}
      onDismiss={closeWithStep}
    />
  );
}
