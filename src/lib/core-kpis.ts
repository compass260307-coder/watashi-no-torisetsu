export type CoreKpiUserFact = {
  id: string;
  diagnosisCompletedAt: string | null;
  fullAccessAt: string | null;
  sourceUserId: string | null;
};

export type CoreKpiFriendFact = {
  targetUserId: string;
  createdAt: string;
};

export type CoreKpiPaymentFact = {
  stripeSessionId: string;
  userId: string;
  paidAt: string;
  currency: string;
  amountMinor: number;
  refundedAmountMinor: number;
};

type DatabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  message?: string | null;
};

const databaseErrorText = (error: DatabaseErrorLike | null | undefined) =>
  [error?.code, error?.message, error?.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

/**
 * During the deploy-before-migration window, PostgREST can report a missing
 * column either as PostgreSQL 42703 or as PGRST204 (schema cache). Keep user
 * flows operational while the dashboard clearly reports that the KPI schema is
 * not ready.
 */
export function isMissingCoreKpiColumn(
  error: DatabaseErrorLike | null | undefined,
  column: "diagnosis_completed_at" | "amount_refunded_minor",
): boolean {
  const text = databaseErrorText(error);
  return (
    text.includes(column) &&
    (text.includes("42703") ||
      text.includes("pgrst204") ||
      text.includes("does not exist") ||
      text.includes("schema cache"))
  );
}

/** Old production schemas also reject the new full_access payment kind check. */
export function isCoreKpiPaymentSchemaPending(
  error: DatabaseErrorLike | null | undefined,
): boolean {
  const text = databaseErrorText(error);
  return (
    isMissingCoreKpiColumn(error, "amount_refunded_minor") ||
    (text.includes("23514") &&
      (text.includes("payment_history_payment_kind_check") ||
        text.includes("payment_kind")))
  );
}

export type CoreKpiCurrency = {
  currency: string;
  grossRevenueMinor: number;
  refundedMinor: number;
  netRevenueMinor: number;
  arpuMinor: number;
  purchases: number;
  payers: number;
};

type ComputeCoreKpisInput = {
  users: CoreKpiUserFact[];
  friends: CoreKpiFriendFact[];
  payments: CoreKpiPaymentFact[];
  from: string | null;
  to: string | null;
  unmatchedPaymentCount: number;
};

const rate = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : 0;

const timestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Computes the five management KPIs from server-side business facts.
 *
 * Period semantics are cohort based:
 * - diagnosis-based KPIs select users whose first diagnosis is in the period and
 *   follow their later payments/friend answers through the present.
 * - paid→friend selects users whose first full-access payment is in the period and
 *   follows friend answers through the present.
 */
export function computeCoreKpis({
  users,
  friends,
  payments,
  from,
  to,
  unmatchedPaymentCount,
}: ComputeCoreKpisInput) {
  const fromMs = timestamp(from);
  const toMs = timestamp(to);
  const inRange = (value: string) => {
    const at = timestamp(value);
    if (at === null) return false;
    if (fromMs !== null && at < fromMs) return false;
    if (toMs !== null && at > toMs) return false;
    return true;
  };

  const usersById = new Map(users.map((user) => [user.id, user]));

  // A duplicated webhook or legacy analytics row must never duplicate revenue.
  const paymentsBySession = new Map<string, CoreKpiPaymentFact>();
  for (const payment of payments) {
    const current = paymentsBySession.get(payment.stripeSessionId);
    if (!current || Date.parse(payment.paidAt) < Date.parse(current.paidAt)) {
      paymentsBySession.set(payment.stripeSessionId, payment);
    }
  }
  const verifiedPayments = Array.from(paymentsBySession.values());

  const paymentsByUser = new Map<string, CoreKpiPaymentFact[]>();
  for (const payment of verifiedPayments) {
    if (!usersById.has(payment.userId)) continue;
    const rows = paymentsByUser.get(payment.userId) ?? [];
    rows.push(payment);
    paymentsByUser.set(payment.userId, rows);
  }
  for (const rows of paymentsByUser.values()) {
    rows.sort((a, b) => Date.parse(a.paidAt) - Date.parse(b.paidAt));
  }

  const firstFriendAtByUser = new Map<string, number>();
  for (const friend of friends) {
    const at = timestamp(friend.createdAt);
    if (at === null) continue;
    const current = firstFriendAtByUser.get(friend.targetUserId);
    if (current === undefined || at < current) {
      firstFriendAtByUser.set(friend.targetUserId, at);
    }
  }

  const diagnosisCohort = users.filter(
    (user) =>
      user.diagnosisCompletedAt !== null && inRange(user.diagnosisCompletedAt),
  );
  const diagnosisCohortIds = new Set(diagnosisCohort.map((user) => user.id));

  let diagnosisToPaidCount = 0;
  let diagnosisToFriendCount = 0;
  const cohortPayments: CoreKpiPaymentFact[] = [];
  for (const user of diagnosisCohort) {
    const diagnosisAt = timestamp(user.diagnosisCompletedAt);
    if (diagnosisAt === null) continue;

    const paymentsAfterDiagnosis = (paymentsByUser.get(user.id) ?? []).filter(
      (payment) => Date.parse(payment.paidAt) >= diagnosisAt,
    );
    if (paymentsAfterDiagnosis.length > 0) diagnosisToPaidCount++;
    cohortPayments.push(...paymentsAfterDiagnosis);

    const friendAt = firstFriendAtByUser.get(user.id);
    if (friendAt !== undefined && friendAt >= diagnosisAt) {
      diagnosisToFriendCount++;
    }
  }

  const firstPaymentByUser = new Map<string, CoreKpiPaymentFact>();
  for (const [userId, rows] of paymentsByUser) {
    if (rows[0]) firstPaymentByUser.set(userId, rows[0]);
  }
  const paidCohort = Array.from(firstPaymentByUser.entries()).filter(
    ([, payment]) => inRange(payment.paidAt),
  );
  let paidToFriendCount = 0;
  for (const [userId, payment] of paidCohort) {
    const friendAt = firstFriendAtByUser.get(userId);
    if (friendAt !== undefined && friendAt >= Date.parse(payment.paidAt)) {
      paidToFriendCount++;
    }
  }

  const currencyMap = new Map<
    string,
    Omit<CoreKpiCurrency, "currency" | "arpuMinor"> & {
      payerIds: Set<string>;
    }
  >();
  for (const payment of cohortPayments) {
    const currency = payment.currency.toLowerCase();
    const bucket = currencyMap.get(currency) ?? {
      grossRevenueMinor: 0,
      refundedMinor: 0,
      netRevenueMinor: 0,
      purchases: 0,
      payers: 0,
      payerIds: new Set<string>(),
    };
    const refunded = Math.min(
      Math.max(payment.refundedAmountMinor, 0),
      payment.amountMinor,
    );
    bucket.grossRevenueMinor += payment.amountMinor;
    bucket.refundedMinor += refunded;
    bucket.netRevenueMinor += payment.amountMinor - refunded;
    bucket.purchases++;
    bucket.payerIds.add(payment.userId);
    currencyMap.set(currency, bucket);
  }
  const currencies: CoreKpiCurrency[] = Array.from(currencyMap.entries())
    .map(([currency, bucket]) => ({
      currency,
      grossRevenueMinor: bucket.grossRevenueMinor,
      refundedMinor: bucket.refundedMinor,
      netRevenueMinor: bucket.netRevenueMinor,
      arpuMinor:
        diagnosisCohort.length > 0
          ? bucket.netRevenueMinor / diagnosisCohort.length
          : 0,
      purchases: bucket.purchases,
      payers: bucket.payerIds.size,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  // K = new diagnosed users generated by the selected diagnosed cohort / cohort size.
  let viralChildren = 0;
  const viralParents = new Set<string>();
  for (const child of users) {
    if (!child.sourceUserId || !diagnosisCohortIds.has(child.sourceUserId)) {
      continue;
    }
    const childAt = timestamp(child.diagnosisCompletedAt);
    const parentAt = timestamp(
      usersById.get(child.sourceUserId)?.diagnosisCompletedAt ?? null,
    );
    if (childAt === null || parentAt === null || childAt < parentAt) continue;
    viralChildren++;
    viralParents.add(child.sourceUserId);
  }

  const matchedPaymentCount = verifiedPayments.filter((payment) =>
    usersById.has(payment.userId),
  ).length;
  const unresolvedPaymentCount =
    unmatchedPaymentCount + (verifiedPayments.length - matchedPaymentCount);
  const totalPaymentCount = matchedPaymentCount + unresolvedPaymentCount;
  const diagnosedUsers = users.filter(
    (user) => user.diagnosisCompletedAt !== null,
  ).length;

  return {
    cohort: {
      from,
      to,
      diagnosisUsers: diagnosisCohort.length,
      paidUsers: paidCohort.length,
      definition:
        "選択期間に起点行動を完了したユーザーを、その後の行動まで現在時点で追跡",
    },
    diagnosisToPaid: {
      numerator: diagnosisToPaidCount,
      denominator: diagnosisCohort.length,
      rate: rate(diagnosisToPaidCount, diagnosisCohort.length),
    },
    diagnosisToFriend: {
      numerator: diagnosisToFriendCount,
      denominator: diagnosisCohort.length,
      rate: rate(diagnosisToFriendCount, diagnosisCohort.length),
    },
    paidToFriend: {
      numerator: paidToFriendCount,
      denominator: paidCohort.length,
      rate: rate(paidToFriendCount, paidCohort.length),
    },
    arpu: {
      denominator: diagnosisCohort.length,
      basis: "選択期間の自己診断完了ユーザー1人あたりの、その後の純売上",
      currencies,
    },
    viralCoefficient: {
      children: viralChildren,
      denominator: diagnosisCohort.length,
      parentsWithChild: viralParents.size,
      value: rate(viralChildren, diagnosisCohort.length),
    },
    dataQuality: {
      diagnosedUsers,
      totalUsers: users.length,
      diagnosisTimestampCoverage: rate(diagnosedUsers, users.length),
      matchedPayments: matchedPaymentCount,
      unmatchedPayments: unresolvedPaymentCount,
      paymentUserMatchRate: rate(matchedPaymentCount, totalPaymentCount),
    },
  };
}
