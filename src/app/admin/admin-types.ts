import type { computeStats } from "@/lib/admin-stats";

export type Preset = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";

export type CurrencyRevenue = {
  currency: string;
  grossRevenueMinor: number;
  refundedMinor: number;
  netRevenueMinor: number;
  purchases: number;
  payers: number;
};

export type FunnelStep = {
  label: string;
  count: number;
};

export type Stats = {
  coreKpis: {
    cohort: {
      from: string | null;
      to: string | null;
      diagnosisUsers: number;
      definition: string;
    };
    diagnosisTrend: {
      granularity: "day";
      timezone: "Asia/Tokyo";
      current: number;
      previous: number | null;
      change: number | null;
      changeRate: number | null;
      previousFrom: string | null;
      previousTo: string | null;
      points: { date: string; count: number }[];
    };
    diagnosisToPaid: {
      numerator: number;
      denominator: number;
      rate: number;
    };
    diagnosisToFriend: {
      numerator: number;
      denominator: number;
      rate: number;
    };
    paidToFriend: {
      numerator: number;
      denominator: number;
      rate: number;
    };
    arpu: {
      denominator: number;
      basis: string;
      currencies: (CurrencyRevenue & { arpuMinor: number })[];
    };
    periodRevenue: {
      basis: string;
      uniquePayers?: number;
      currencies: CurrencyRevenue[];
    };
    viralCoefficient: {
      children: number;
      denominator: number;
      parentsWithChild: number;
      value: number;
    };
    dataQuality: {
      diagnosedUsers: number;
      totalUsers: number;
      diagnosisTimestampCoverage: number;
      matchedPayments: number;
      unmatchedPayments: number;
      paymentUserMatchRate: number;
      ready: boolean;
      issues: string[];
    };
  };
  diagnosisStarted: number;
  diagnosisCompleted: number;
  completionRate: number;
  shareCount: number;
  shareRate: number;
  friendAnswerStarted: number;
  friendAnswerCompleted: number;
  answerCompletionRate: number;
  threeAchieved: number;
  fiveAchieved: number;
  resultRevisited: number;
  revisitRate: number;
  funnel: FunnelStep[];
  friendDiagnosisFunnel: {
    measurementStartedAt: string;
    diagnosisCompleted: number;
    cohortDefinition: string;
    ownerFunnel: {
      key: string;
      label: string;
      count: number;
      rateFromPrevious: number | null;
      rateFromDiagnosis: number;
    }[];
    friendFunnel: {
      key: string;
      label: string;
      count: number;
      rateFromPrevious: number | null;
      rateFromLanding: number;
    }[];
  };
  selfResultShareFunnel: {
    measurementStartedAt: string;
    cohortDefinition: string;
    steps: {
      key: string;
      label: string;
      count: number;
      rateFromPrevious: number | null;
      rateFromResult: number;
    }[];
  };
  paywallFunnel: FunnelStep[];
  coursePaywall: {
    version: string;
    cardViewers: number;
    planViewers: number;
    ctaClickers: number;
    stripeReached: number;
    purchasers: number;
    transactions: number;
    newPurchases: number;
    upgrades: number;
    currency: string;
    revenueMinor: number;
    revenueJpy: number;
    revenuePerViewerJpy: number;
    purchaseRate: number;
    plans: {
      product: "self_report" | "full_access" | "premium_bundle";
      viewers: number;
      ctaClickers: number;
      stripeReached: number;
      purchasers: number;
      transactions: number;
      newPurchases: number;
      upgrades: number;
      currency: string;
      revenueMinor: number;
      revenueJpy: number;
      ctaRate: number;
      stripeRate: number;
      checkoutCompletionRate: number;
      purchaseRate: number;
    }[];
  };
  unmei: {
    funnel: FunnelStep[];
    chatFunnel: FunnelStep[];
    navigationFunnel: FunnelStep[];
    purchases: {
      total: number;
      current: number;
      premium: number;
      legacy: number;
      basic: number;
      upgrade: number;
    };
    revenue: {
      currencies: {
        currency: string;
        purchases: number;
        netRevenueMinor: number;
      }[];
    };
    birthForm: {
      viewed: number;
      submitted: number;
      skipped: number;
      submitRate: number;
    };
    navBadge: { shown: number; clicked: number; clickRate: number };
  };
  alice: {
    measurementStartedAt: string;
    purchaseFunnel: FunnelStep[];
    funnel: FunnelStep[];
    pageViews: number;
    accessViewers: number;
    lockedViewers: number;
    paywallOpeners: number;
    cardViewers: number;
    ctaClickers: number;
    stripeReached: number;
    purchasers: number;
    purchases: number;
    revenue: {
      currencies: {
        currency: string;
        purchases: number;
        netRevenueMinor: number;
      }[];
    };
    messageSenders: number;
    messageActions: number;
    responseViewers: number;
    responseFailureViewers: number;
    pageToSendRate: number;
    accessToSendRate: number;
    paywallOpenRate: number;
    activeUsers: number;
    conversationsStarted: number;
    responsesCompleted: number;
    responsesFailed: number;
    responseSuccessRate: number;
    credits: {
      holders: number;
      total: number;
      remaining: number;
      used: number;
    };
  };
  // LINE基盤 + Alice Plus。friends〜mrrJpyは現在値・以降は期間内件数。
  // 旧レスポンスとの互換のため optional
  linePlus?: {
    friends: number;
    linked: number;
    activeSubscribers: number;
    monthlySubscribers?: number;
    annualSubscribers?: number;
    trialingSubscribers?: number;
    cancelScheduled: number;
    mrrJpy: number;
    follows: number;
    linkCompleted: number;
    checkoutOpened: number;
    subscribed: number;
    canceled: number;
    cardViewed: number;
    addFriendClicked: number;
    linkCodeRequested: number;
    linkCodeIssued: number;
    linkCodeFailed: number;
  };
  paywallSources: { source: string; count: number }[];
  paywallAttribution: {
    source: string;
    scrollClicks: number;
    purchaseCtaClicks: number;
    stripeReached: number;
    purchases: number;
    purchaseRate: number | null;
  }[];
  takoAttribution: {
    source: string;
    scrollClicks: number;
    purchaseCtaClicks: number;
    stripeReached: number;
    purchases: number;
    purchaseRate: number | null;
  }[];
  /** payment_history を正本にした選択期間の全商品決済件数。 */
  purchaseCompleted: number;
  /** 選択期間の診断コホートから全商品決済への転換率。 */
  purchaseConversionRate: number;
  /** 現在表示中の3コースカードに限定した決済取引数。 */
  coursePurchaseCompleted: number;
  /** 現在表示中の3コースカードに限定した購入者転換率。 */
  coursePurchaseConversionRate: number;
  /** payment_history を正本にした選択期間のユニーク購入者数。 */
  paidUsers: number;
  friendToDiagClicked: number;
  friendToDiagRate: number;
  typeDistribution: { typeId: string; name?: string; count: number }[];
  revenueJpy: number;
  revenueByKind: {
    kind: string;
    currency: string;
    purchases: number;
    grossRevenueMinor: number;
    refundedMinor: number;
    netRevenueMinor: number;
  }[];
  revenueDaily: {
    date: string;
    purchases: number;
    currencies: {
      currency: string;
      netRevenueMinor: number;
      refundedMinor: number;
    }[];
  }[];
  purchaseTracking: {
    verifiedPayments: number;
    purchaseEvents: number;
    missingPurchaseEvents: number;
    browserMetaPushed: number;
    browserTikTokPushed: number;
    serverMetaSent: number;
    serverTikTokSent: number;
    serverQueuePending: number;
    serverQueueFailed: number;
    metaServerConfigured: boolean;
    tiktokServerConfigured: boolean;
  };
  friendCountDistribution: {
    total: number;
    zero: number;
    one: number;
    two: number;
    threePlus: number;
    fivePlus: number;
  };
  diagQuestionReach: Record<string, number>;
  campaignStats: {
    campaign: string;
    completed: number;
    friendCompleted: number;
  }[];
  acquisitionStats: {
    directLabel: string;
    sources: { source: string; users: number; share: number }[];
    campaigns: { source: string; campaign: string; users: number }[];
  };
  generationDistribution: { generation: number; count: number }[];
  unknownGeneration: number;
  viral: {
    friendLandingViewed: number;
    avgLandingPerSharer: number;
    landingToStartRate: number;
    startToCompleteRate: number;
    friendToDiagClickedRate: number;
    childDiagCompleted: number;
    avgChildPerParent: number;
    viralCoefficient: number;
  };
};

type ApiStats = Awaited<ReturnType<typeof computeStats>>;
type Assert<T extends true> = T;

/** APIの返却値が、画面で必要な契約を満たすことをコンパイル時に検証する。 */
export type AdminStatsResponseContract = Assert<
  [ApiStats] extends [Stats] ? true : false
>;
