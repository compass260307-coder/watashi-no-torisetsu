import { EN_RESULT_AXES } from "@/i18n/en/result";
import type { FriendSummary } from "@/lib/owner-report-data";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;

function value(scores: Scores, dimension: BigFiveDimension) {
  return Math.max(0, Math.min(10, scores[dimension] ?? 5));
}

export function enFriendInsights(selfScores: Scores, friend: FriendSummary) {
  const strongestGap = [...EN_RESULT_AXES].sort(
    (a, b) =>
      Math.abs(value(friend.perceivedScores, b.dim) - value(selfScores, b.dim)) -
      Math.abs(value(friend.perceivedScores, a.dim) - value(selfScores, a.dim)),
  )[0];
  const friendValue = value(friend.perceivedScores, strongestGap.dim);
  const selfValue = value(selfScores, strongestGap.dim);
  const gap = Math.abs(friendValue - selfValue);
  const axis = gap < 1
    ? "Your friend described you much as you described yourself across the five dimensions."
    : `The clearest difference is ${strongestGap.title.toLowerCase()}: your friend scored you ${Math.round(friendValue * 10)}%, while you scored yourself ${Math.round(selfValue * 10)}%. This is a difference in perspective, not a verdict about either of you.`;

  const agreeableness = value(friend.perceivedScores, "A");
  const sensitivity = value(friend.perceivedScores, "N");
  const love = agreeableness >= 5
    ? "In close relationships, this friend seems to notice the care and cooperation you bring. Ask them which moments made that visible; the answer may reveal a strength you overlook."
    : "In close relationships, this friend seems to notice your independent judgment. Clear expectations and room for each person to speak honestly may help you feel close without losing your own voice.";
  const care = sensitivity >= 5
    ? "Your friend may notice your emotional responses more readily than you expect. When a moment feels intense, naming what you need can reduce guessing on both sides."
    : "Your friend sees a steadier emotional style. That can be reassuring, but it may also make it harder for them to tell when you need support; say so plainly when you do.";
  const compatibility = friend.mutual >= 75
    ? "Your self-view and this friend's view are closely aligned. Use that shared understanding to talk openly about the smaller differences that remain."
    : friend.mutual >= 50
      ? "You share some understanding and also see different sides of the same person. Comparing concrete situations can turn those differences into a more useful conversation."
      : "This friend sees several sides of you differently from how you see yourself. Start with one specific example and ask what they noticed before drawing a conclusion about the relationship.";

  return { axis, love, care, compatibility };
}
