"use client";

import {
  ResultUpgradeTreasure,
  type TreasureBenefit,
  type TreasureOffer,
} from "@/components/result-upgrade/ResultUpgradeTreasure";
import {
  FULL_ACCESS_COUPON_JPY,
  FULL_ACCESS_LIST_PRICE_JPY,
  FULL_ACCESS_PRICE_JPY,
  THREE_COURSE_PAYWALL_VERSION,
} from "@/lib/access-products";
import { selfReportPeekImagePath } from "@/lib/report-story-images";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import type { FullAccessQuoteState } from "@/lib/use-full-access-quote";
import { useEffect, useState } from "react";
import { FullAccessCta } from "./FullAccessCta";

// 日本語Webの完全版（¥499）: 課金カードを開くCTAを押したとき、課金カードの代わりに
// 宝箱から「リリース記念 ¥800 OFF」クーポンを受け取る全画面演出を出す。
// クーポンは全員に同じ額で付く（通常価格¥1,299 − ¥800 = 請求額¥499）。抽選や期限があるようには見せない。

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

// 課金カード（FULL_ACCESS_SELF_UNLOCKS）と同じ7つの解放内容を、同じ順で見せる。
// 絵は宝箱の世界観にそろえて、サイトの羊毛フェルトの絵（背景透過）を使う。
function fullAccessBenefits(characterImageSrc?: string | null): TreasureBenefit[] {
  // キャラクター画像と判定できたときだけ、特典①にその人のキャラクターを出す。
  const ownCharacter = selfReportPeekImagePath(characterImageSrc, "ja") ? characterImageSrc : null;
  return [
    {
      label: "特典①",
      title: "診断結果の続き9セクション",
      body: "恋愛・キャリアの深掘りから、周りから見た印象まで、ロック中の結果をすべて読めます",
      image: ownCharacter ?? "/pricing/self-report-felt-transparent.png",
    },
    {
      label: "特典②",
      title: "16ページ以上の専用電子書籍",
      body: "あなたの性格や特徴を一冊に。保存・印刷して、いつでも読み返せます",
      image: "/result-upgrade/benefit-book.webp",
    },
    {
      label: "特典③",
      title: "専属占い師Aliceとのチャット",
      body: "あなたの性格や星を理解したAliceが、恋愛・仕事・人間関係の悩みに答えます",
      image: "/result-upgrade/benefit-line-chat.webp",
    },
    {
      label: "特典④",
      title: "Aliceの占いをすべて解放",
      body: "西洋占星術の「運命の設計図」と、恋愛・仕事・人間関係を占うタロット",
      image: "/mascot/unmei-hero-alice-transparent.png",
    },
    {
      label: "特典⑤",
      title: "相性診断をすべて解放",
      body: "恋愛・友情・仕事での相性から、すれ違いやすいポイントまで読み解けます",
      image: "/pricing/full-access-connection-felt-transparent.png",
    },
    {
      label: "特典⑥",
      title: "2人目以降の友達診断結果",
      body: "友達から見たキャラ・性格のギャップ・恋愛傾向まで、友達ごとの結果をすべて読めます",
      image: "/empty-states/tako-friends-waiting-felt.png",
    },
    {
      label: "特典⑦",
      title: "みんなから見た分析レポート",
      body: "友達の回答をまとめた他己分析PDF。回答が増えるたびに何度でも更新できます",
      image: "/pricing/self-report-felt-transparent.png",
    },
  ];
}

function fullAccessOffer(characterImageSrc?: string | null): TreasureOffer {
  return {
    dialogLabel: "Aliceからのプレゼント",
    lead: ["診断してくれた", "あなたへのプレゼント"],
    couponSrc: "/result-upgrade/coupon-full-access-800.webp",
    couponLabel: (couponJpy) => `リリース記念 ¥${couponJpy.toLocaleString("ja-JP")} OFFクーポン（完全版に使えます）`,
    offerSummary: (priceJpy, count) =>
      `クーポンを使うと、完全版が ${priceJpy.toLocaleString("ja-JP")}円。次の${count}つがすべて解放されます。`,
    benefits: fullAccessBenefits(characterImageSrc),
    benefitStyle: "stack",
  };
}

type Props = {
  ownerToken?: string;
  /** その人のキャラクター画像。特典の見本をその人のタイプに合わせる。 */
  characterImageSrc?: string | null;
  ctaSource?: string;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  surface?: "self" | "tako";
  variant?: "self" | "aisho";
  previewMode?: boolean;
  priceState?: FullAccessQuoteState;
  /** 宝箱を開けずに閉じたとき。従来の課金カードを出す。 */
  onShowCard: () => void;
  /** 値札と特典を見たあと「あとで決める」で閉じたとき。 */
  onClose: () => void;
};

export function FullAccessTreasure({
  ownerToken,
  characterImageSrc,
  ctaSource,
  returnTo,
  surface,
  variant,
  previewMode = false,
  priceState,
  onShowCard,
  onClose,
}: Props) {
  // 同じタブで受け取り済みなら、宝箱を開け直させずに値札と特典から見せる。
  const [startAt] = useState<"chest" | "offer">(() => (fullAccessCouponReceived() ? "offer" : "chest"));
  const [offer] = useState(() => fullAccessOffer(characterImageSrc));
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
      },
    });
    try {
      window.sessionStorage.setItem(dedupKey, "1");
    } catch {
      /* noop */
    }
  }, [ownerToken, previewMode, startAt, surface, variant]);

  return (
    <ResultUpgradeTreasure
      couponJpy={FULL_ACCESS_COUPON_JPY}
      listPriceJpy={FULL_ACCESS_LIST_PRICE_JPY}
      priceJpy={FULL_ACCESS_PRICE_JPY}
      offer={offer}
      startAt={startAt}
      dismissLabel="閉じる"
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
          checkoutPresentation="treasure"
          accentColor="#A87322"
          shadowColor="#7F5518"
        >
          全ての機能をアンロック
        </FullAccessCta>
      }
      onCouponReceived={saveCouponReceived}
      onClose={onClose}
      onDismiss={onShowCard}
    />
  );
}
