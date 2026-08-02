import type { ResultLocale } from "@/i18n/result";
import type { AnswerValue } from "@/lib/types";
import type { FriendQuestionV2 } from "@/lib/friend-questions-v2";

export const FRIEND_COPY = {
  ja: {
    loading: "読み込み中...",
    friend: "友達",
    testTitle: "友達診断テスト",
    heroSubtitle: "OCEAN（Big Five）性格特性モデル",
    heroAlt: "友達診断テスト",
    nicknamePrompt: "ニックネームを教えて",
    questionAria: (id: number) => `質問 ${id}`,
    finishQuestions: "さいごへ →",
    next: "次へ",
    back: "戻る",
    nicknameRequired: "ニックネームを入力してね",
    invalidTitle: "この招待リンクは無効です",
    invalidDescription:
      "リンクが正しくコピーされていないか、招待した人のデータが見つかりませんでした。送ってくれた友達に、もう一度リンクを送ってもらってください。",
    invalidCta: "自分の診断をやってみる",
    submitErrorTitle: "送信に失敗しました",
    submitErrorBody: "時間をおいて、もう一度送信してください。",
    retry: "もう一度送信する",
    messageTitle: "最後に、本人へひとこと（任意）",
    messageAria: "本人へのひとことメッセージ (任意)",
    messagePlaceholder: "伝えたいことがあれば自由にどうぞ",
    submitting: "送信中...",
    seeResult: "結果を見る →",
    unknownError: "Unknown error",
    scaleLeft: "強くそう思う",
    scaleRight: "強くそう思わない",
    scaleOptions: {
      7: "強くそう思う",
      6: "そう思う",
      5: "ややそう思う",
      4: "どちらでもない",
      3: "あまりそう思わない",
      2: "そう思わない",
      1: "強くそう思わない",
    } satisfies Record<AnswerValue, string>,
  },
  ko: {
    loading: "불러오는 중...",
    friend: "친구",
    testTitle: "친구 진단 테스트",
    heroSubtitle: "OCEAN(Big Five) 성격 특성 모델",
    heroAlt: "친구 진단 테스트",
    nicknamePrompt: "닉네임을 알려 주세요",
    questionAria: (id: number) => `질문 ${id}`,
    finishQuestions: "마지막으로 →",
    next: "다음",
    back: "이전",
    nicknameRequired: "닉네임을 입력해 주세요",
    invalidTitle: "유효하지 않은 초대 링크예요",
    invalidDescription:
      "링크가 올바르게 복사되지 않았거나 초대한 사람의 데이터를 찾을 수 없어요. 링크를 보내 준 친구에게 다시 한번 보내 달라고 부탁해 주세요.",
    invalidCta: "내 성격도 진단해 보기",
    submitErrorTitle: "답변을 보내지 못했어요",
    submitErrorBody: "잠시 후 다시 시도해 주세요.",
    retry: "다시 보내기",
    messageTitle: "마지막으로, 친구에게 한마디 (선택)",
    messageAria: "친구에게 보내는 한마디 (선택)",
    messagePlaceholder: "전하고 싶은 말이 있다면 자유롭게 적어 주세요",
    submitting: "보내는 중...",
    seeResult: "결과 보기 →",
    unknownError: "알 수 없는 오류가 발생했어요",
    scaleLeft: "매우 그렇다",
    scaleRight: "전혀 그렇지 않다",
    scaleOptions: {
      7: "매우 그렇다",
      6: "그렇다",
      5: "약간 그렇다",
      4: "보통이다",
      3: "별로 그렇지 않다",
      2: "그렇지 않다",
      1: "전혀 그렇지 않다",
    } satisfies Record<AnswerValue, string>,
  },
} as const;

const KO_FRIEND_QUESTIONS = [
  "{name}님은 모임에서도 적극적으로 의견을 말하는 편이다",
  "{name}님은 생각이 떠오르면 바로 행동하는 편이다",
  "{name}님은 계획을 세운 뒤 움직이는 경우가 많다",
  "{name}님은 자기 의견이 분명해서 가끔은 쉽게 양보하지 않는다",
  "{name}님은 감정의 변화가 표정이나 태도에 잘 드러나는 편이다",
  "{name}님은 상대의 마음을 알아차리는 데 능숙해 보인다",
  "{name}님은 독특한 아이디어로 주변을 놀라게 할 때가 있다",
  "{name}님은 처음 만난 사람과도 자연스럽게 대화를 시작한다",
  "{name}님은 눈앞의 일에 몰두하느라 계획을 뒤로 미룰 때가 있다",
  "{name}님은 매사를 신중하게 생각하는 사람처럼 보인다",
  "{name}님은 먼저 말하기보다 상대의 이야기를 들어주는 경우가 많다",
  "{name}님과 함께 있으면 분위기가 편안해지는 경우가 많다",
  "{name}님은 낯선 장소나 활동에도 적극적으로 뛰어드는 편이다",
  "{name}님은 목표를 정하면 꾸준히 노력하는 편이다",
  "{name}님은 익숙한 장소나 활동을 더 좋아하는 편이다",
  "{name}님은 누군가 힘들어 보이면 알아차리고 먼저 말을 건네는 경우가 많다",
  "{name}님은 눈앞의 일을 현실적인 관점에서 보는 편이다",
  "{name}님은 감정 기복이 크지 않고 안정적으로 보인다",
  "{name}님은 모임의 분위기를 살피며 행동하는 경우가 많다",
  "{name}님은 상대의 이야기를 웃으며 받아준다",
  "{name}님은 시작한 일을 끝까지 해내는 데 강한 의지가 있어 보인다",
  "{name}님은 걱정이 많은 편이고 위험 요소를 빨리 알아차린다",
  "{name}님은 긴장되는 상황에서도 침착하게 행동하는 편이다",
  "{name}님은 상대의 감정에 쉽게 휩쓸리지 않고 차분함을 유지한다",
  "{name}님은 정리 정돈과 일정 관리를 꼼꼼하게 한다",
  "{name}님은 모임의 의견보다 자신의 판단을 우선하는 편이다",
  "{name}님은 추상적인 아이디어나 상상을 즐기는 편이다",
  "{name}님은 목표 달성보다 지금 이 순간을 즐기는 것을 더 중요하게 여긴다",
  "{name}님과 이야기하면 나까지 기분이 밝아진다",
  "{name}님은 감정을 겉으로 잘 드러내지 않는 사람처럼 보인다",
] as const;

export function friendQuestionText(
  locale: ResultLocale,
  question: FriendQuestionV2,
  inviteeName: string,
): string {
  const template =
    locale === "ko"
      ? (KO_FRIEND_QUESTIONS[question.id - 1] ?? question.text)
      : question.text;
  if (locale === "ko" && inviteeName === FRIEND_COPY.ko.friend) {
    return template
      .replaceAll("{name}님은", "초대한 친구는")
      .replaceAll("{name}님과", "초대한 친구와")
      .replaceAll("{name}", "초대한 친구");
  }
  return template.replaceAll("{name}", inviteeName);
}
