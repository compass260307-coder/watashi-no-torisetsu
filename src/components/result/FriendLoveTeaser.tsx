import Link from "next/link";
import type { ResultLocale } from "@/i18n/result";

interface FriendLoveTeaserProps {
  href: string;
  friendCount: number;
  threshold: number;
  locale?: ResultLocale;
}

const LOVE_TEASERS = [
  {
    heading: "あなたのここ、絶対モテるのに",
    description:
      "友達に診断してもらって、あなた自身が気づいていない「モテる理由」を見てみましょう。",
    decoys: [
      ["自然な気配り", "本人は当たり前だと思っているけれど、周りには魅力として映っている。"],
      ["一緒にいる安心感", "ふとした瞬間に伝わるやさしさを、友達はちゃんと覚えている。"],
      ["無意識の表情", "自分では気づきにくいところに、惹かれる理由が隠れている。"],
      ["近くにいる心地よさ", "飾らないときほど伝わる魅力を、仲のいい人は知っている。"],
      ["会話のテンポ", "何気ないやり取りの中に、また会いたいと思わせる魅力がある。"],
      ["信頼される距離感", "近づきすぎないやさしさが、相手に安心を与えている。"],
      ["意外なギャップ", "いつもの印象とふとした瞬間の違いが、強く記憶に残っている。"],
      ["ふたりの時の空気", "大勢の中では見えない魅力を、近くにいる人ほど知っている。"],
    ],
  },
  {
    heading: "恋で損している、惜しいクセ",
    description:
      "友達に診断してもらって、恋で少し損をしているあなたの惜しいクセを知りましょう。",
    decoys: [
      ["遠慮しすぎない", "もう少し本音を見せるだけで、相手との距離はぐっと近づく。"],
      ["考え込む前に聞く", "ひとりで答えを決めずに、短い言葉で確かめることが近道になる。"],
      ["好意を隠しすぎない", "小さなリアクションだけでも、相手には十分なサインになる。"],
      ["頼ることを怖がらない", "弱さを見せた瞬間に、関係が深まることもある。"],
      ["素直なひと言を伝える", "うれしい気持ちを言葉にすると、相手も一歩近づきやすくなる。"],
      ["完璧に見せようとしない", "少し隙があるほうが、もっと知りたいと思ってもらえる。"],
      ["先回りして諦めない", "相手の答えを決めつけずに待つだけで、恋の流れは変わっていく。"],
      ["気持ちを試さない", "遠回しなサインより、まっすぐな言葉のほうが魅力は伝わる。"],
    ],
  },
] as const;

const KO_LOVE_TEASERS = [
  {
    heading: "이런 모습, 분명 인기 있을 텐데",
    description:
      "친구에게 진단을 부탁하고, 스스로 알아차리지 못한 ‘호감을 얻는 이유’를 확인해 보세요.",
    decoys: [
      ["자연스러운 배려", "본인은 당연하다고 생각하지만 주변에는 분명한 매력으로 보여요."],
      ["함께 있을 때의 안도감", "문득 드러나는 다정함을 친구는 제대로 기억하고 있어요."],
      ["무의식적인 표정", "스스로 알아차리기 어려운 순간에 끌리는 이유가 숨어 있어요."],
      ["가까이 있을 때의 편안함", "꾸미지 않을수록 전해지는 매력을 가까운 사람이 알고 있어요."],
      ["대화의 리듬", "평범한 대화 속에 다시 만나고 싶게 만드는 매력이 있어요."],
      ["신뢰를 주는 거리감", "지나치게 다가가지 않는 다정함이 상대에게 편안함을 줘요."],
      ["뜻밖의 반전", "평소 인상과 문득 보이는 모습의 차이가 오래 기억에 남아요."],
      ["둘이 있을 때의 분위기", "여럿일 때는 보이지 않는 매력을 가까운 사람일수록 잘 알아요."],
    ],
  },
  {
    heading: "연애에서 조금 손해 보는 아쉬운 습관",
    description:
      "친구에게 진단을 부탁하고, 연애에서 나도 모르게 손해 보고 있는 습관을 확인해 보세요.",
    decoys: [
      ["너무 사양하지 않기", "속마음을 조금만 더 보여 줘도 상대와의 거리가 훨씬 가까워져요."],
      ["혼자 생각하기 전에 묻기", "답을 혼자 정하지 말고 짧게 확인하는 것이 가장 빠른 길이에요."],
      ["호감을 너무 숨기지 않기", "작은 반응만으로도 상대에게는 충분한 신호가 돼요."],
      ["의지하는 것을 두려워하지 않기", "약한 모습을 보여 준 순간 관계가 더 깊어질 때도 있어요."],
      ["솔직한 한마디 전하기", "기쁜 마음을 말로 전하면 상대도 한 걸음 다가오기 쉬워져요."],
      ["완벽해 보이려 하지 않기", "조금 빈틈이 있을수록 더 알고 싶다는 마음이 생겨요."],
      ["미리 포기하지 않기", "상대의 답을 단정하지 않고 기다리는 것만으로 흐름이 달라져요."],
      ["마음을 시험하지 않기", "돌려 말하는 신호보다 곧은 한마디가 매력을 더 잘 전해요."],
    ],
  },
] as const;

function LockGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function FriendLoveTeaser({
  href,
  friendCount,
  threshold,
  locale = "ja",
}: FriendLoveTeaserProps) {
  const isKorean = locale === "ko";
  const loveTeasers = isKorean ? KO_LOVE_TEASERS : LOVE_TEASERS;
  const completed = friendCount >= threshold;
  const ctaText = completed
    ? isKorean ? "친구가 본 결과 보기" : "友達からの結果を見る"
    : isKorean ? "실제 친구의 답변 보기" : "本物の友達の答えを見る";

  return (
    <div className="space-y-10">
      {loveTeasers.map((teaser) => (
        <div key={teaser.heading}>
          <h4 className="mb-3 text-[18px] font-black text-[#2E2E5C] md:text-[20px]">
            {teaser.heading}
          </h4>

          <Link
            href={href}
            aria-label={`${teaser.heading}${isKorean ? ": " : "："}${ctaText}`}
            className="group relative block h-[360px] overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B5BEF]/25 md:h-[320px]"
          >
            <div
              aria-hidden="true"
              className="grid h-full select-none grid-cols-1 gap-x-8 gap-y-2 overflow-hidden px-3 py-3 blur-[2px] md:grid-cols-2"
            >
              {teaser.decoys.map(([title, body]) => (
                <div key={title}>
                  <p className="mb-0.5 text-[14px] font-black text-[#2E2E5C]/80">
                    {title}
                  </p>
                  <p className="body-gothic text-[13px] leading-[1.4] text-[#1A1A1A]/65">
                    {body}
                  </p>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-white/10 p-4">
              <div className="relative w-[88%] max-w-[380px] rounded-lg border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] bg-white/95 px-5 pb-6 pt-8 text-center shadow-[0_12px_36px_rgba(46,46,92,0.18)] backdrop-blur-sm md:max-w-[420px]">
                <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
                  <LockGlyph />
                </span>
                <p className="mb-1.5 text-[18px] font-black text-[#2E2E5C]">
                  {completed
                    ? isKorean ? "친구의 답변 확인" : "友達からの答えを確認"
                    : isKorean ? "친구만 아는 답변 열기" : "友達だけが知る答えを解放"}
                </p>
                <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
                  {completed
                    ? isKorean ? "모인 친구 답변의 결과를 확인해 보세요." : "集まった友達からの結果を見てみましょう。"
                    : teaser.description}
                </p>
                <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#5B5BEF] px-5 py-3 text-[13px] font-black text-white shadow-[0_3px_0_#3D3DC4] transition-transform duration-200 group-hover:translate-y-0.5">
                  {ctaText}
                </span>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
