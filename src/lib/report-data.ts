import type { BigFiveDimension, TorisetsuTypeId } from "./types";
import { computeGapAnalysis, type GapItem } from "./gap-analysis";
import { torisetsuTypes } from "./torisetsu-data";

export const REPORT_FRIEND_THRESHOLD = 3;

export type FriendAnswerRecord = {
  answers: Record<string, string | number>;
  created_at?: string;
};

export type ShortBigFive = Partial<Record<BigFiveDimension, number>>;

export interface RelationshipMatrix {
  closestType: TorisetsuTypeId | null;
  farthestType: TorisetsuTypeId | null;
  bestPartnerType: TorisetsuTypeId | null;
}

export type DeepDiveSection = {
  title: string;
  body: string;
};

export type TypeDeepDive = {
  essence: DeepDiveSection;
  strength: DeepDiveSection;
  weakness: DeepDiveSection;
  relationship: DeepDiveSection;
  career: DeepDiveSection;
  love: DeepDiveSection;
  growth: DeepDiveSection;
};

export const DEEP_DIVE_SECTION_ORDER: (keyof TypeDeepDive)[] = [
  "essence",
  "strength",
  "weakness",
  "relationship",
  "career",
  "love",
  "growth",
];

export const TYPE_DEEP_DIVE: Partial<Record<TorisetsuTypeId, TypeDeepDive>> = {
  "festival-sun": {
    essence: {
      title: "タイプの本質",
      body: `あなたは「お祭りムードメーカー」タイプ。

外向性・協調性・開放性のすべてが高水準にある、Big Five上では比較的珍しい組み合わせです。人と関わることで自分のエネルギーが充電され、他者の感情に共感する力を持ちながら、新しい経験や挑戦も積極的に楽しむ。

この3つが揃っている人は、ただ明るいだけでなく、「明るくて、優しくて、新しいことに開かれている」存在として、自然と人が集まる中心地になります。あなたの周りには、いつも何かしらの動きがあるはずです。`,
    },
    strength: {
      title: "あなたの強み・武器",
      body: `あなたの最大の強みは、「場のエネルギーを動かす力」です。

人が集まる場で、空気が沈んでいれば自然と盛り上げ、緊張があればほぐし、停滞があれば動きを作る。これは意識的にやっているのではなく、あなたの存在自体が場の空気を変える性質を持っています。

加えて、新しい人や状況にも臆さず飛び込める柔軟さがあります。初対面でも数分で距離を縮められるのは、相手の感情を瞬時に読み取り、適切な距離感を選べる感受性があるからです。

そしてもう一つ、見落とされがちな強みが「巻き込み力」です。あなたが楽しんでいると、周囲も自然と引き込まれていく。これは、あなたの感情が周囲に伝わりやすいタイプであることの表れです。リーダーシップというより、「中心地」になる才能。これがあなたの武器です。`,
    },
    weakness: {
      title: "弱み・盲点",
      body: `明るさとエネルギーが強みである一方、それは時に弱点にもなります。

第一に、「ひとりの時間」が苦手です。人と関わることでエネルギーを得るタイプは、逆に言えば、ひとりで過ごす時間が長く続くとエネルギーが枯渇します。テスト期間中、卒論執筆、長期休みでの一人暮らし。こういった場面で意外なほど落ち込むことがあるはずです。

第二に、「全員に好かれたい」という無意識の欲求があります。協調性が高く、相手の感情を読み取る力があるからこそ、誰かに嫌われている感覚を察知すると、必要以上に消耗します。

第三に、「テンションの落差」を周りに気づかれません。普段が明るいぶん、本当に疲れている時や悩んでいる時の表情をあなたが見せても、「いつも元気な人」のイメージが先行して気づかれにくい。これがあなた独自の孤独です。`,
    },
    relationship: {
      title: "対人関係の傾向",
      body: `あなたは、人との関係を「広く、深く」築くタイプです。

普通、人との関わりは「広く浅く」か「狭く深く」のどちらかに偏ります。しかしあなたは、初対面でも壁を作らず、その上で本気で相手に向き合えるという、両立しにくい二つを両立させています。

そのため、友人関係も多層的です。一緒に騒げる仲間、深い話ができる相棒、たまに会うけど信頼できる旧友。それぞれの関係に、あなたなりの誠実さで接しています。

ただし、注意点もあります。あなたは相手のテンションに合わせることが上手いため、「気を遣わせていない」と相手に感じさせる反面、自分の本音が後回しになる傾向があります。

本当に信頼できる人の前では、無理に明るくふるまわず、弱さや迷いも見せていい。それを許してくれる関係こそが、あなたを長く支えてくれます。`,
    },
    career: {
      title: "キャリア向き",
      body: `あなたの特性が最も活きるのは、「人」と「変化」が両方ある場所です。

具体的には、対人の現場が多く、状況が常に動く仕事。営業、マーケティング、イベント企画、広報、人事、教育、接客業、メディア、スタートアップなど。ルーチンワークだけで完結する仕事や、長時間ひとりで集中する仕事は、あなたの強みを殺してしまいます。

職場で求められる役割としては、チームの起点となるポジション。意思決定そのものより、人を動かしたり、空気を作ったり、関係性を構築したりする領域で力を発揮します。

将来的には、自分が前に出るリーダーよりも、「中心地として人が集まるコミュニティを作る人」のほうが向いているかもしれません。これは社長業、コミュニティマネージャー、店舗オーナー、インフルエンサーなど、形は様々です。

「自分のエネルギーで、誰かが動き出す」 — そんな仕事と相性が良いです。`,
    },
    love: {
      title: "恋愛傾向",
      body: `あなたの恋愛は、「楽しさ」から始まることが多いタイプです。

一緒にいて笑える、新しい場所に行ける、感情を共有できる。そんな日常的な楽しさが、恋愛感情のベースになります。深くシリアスな出会いより、自然に距離が縮まる関係性のほうが、あなたには合っています。

相手のタイプとしては、「あなたを受け止めてくれる人」が大切です。あなたは無意識に場を盛り上げる側に回ってしまうので、相手が同じく盛り上げ役だと、お互い疲れます。逆に、あなたのテンションを落ち着いて受け止め、ふっと一言で本質を突いてくる人。そういう相手と一緒にいると、あなたは自分の弱さも出せます。

注意点は、関係が深まったあとの「ギャップ」です。明るくて社交的なあなたが見せる、繊細で疲れやすい一面。これを最初に見せた相手こそ本命になりやすい。隠そうとするほど、関係は表面で止まります。`,
    },
    growth: {
      title: "成長のヒント",
      body: `あなたが今後さらに自分の魅力を伸ばしていくためのヒントを、3つ。

1つ目は、「ひとりの時間を意識的に作る」こと。エネルギーは人から得られますが、自分の核を確認する時間がないと、いつか空っぽになります。週に一度でいい、誰にも会わない時間を作ってください。

2つ目は、「弱さを見せる相手を、慎重に選ぶ」こと。全員に明るくふるまう必要はありません。本当に信頼できる2〜3人にだけ、本音を預ける勇気を持ってください。

3つ目は、「自分の影響力に気づく」こと。あなたが楽しんでいるだけで誰かが救われています。それは、もう才能です。`,
    },
  },
};

export interface ReportData {
  ownerToken: string;
  typeId: TorisetsuTypeId;
  typeName: string;
  typeColor: string;
  typeEmoji: string;
  typeImageUrl: string | null;
  typeSubtitle: string;
  typeCatchCopy: string;
  selfBigFive: ShortBigFive;
  friendBigFive: ShortBigFive;
  gaps: GapItem[];
  topGaps: GapItem[];
  friendCount: number;
  meetsThreshold: boolean;
  relationship: RelationshipMatrix;
  isDev?: boolean;
}

const TYPE_CATCH_COPY: Record<TorisetsuTypeId, string> = {
  "festival-sun": "みんなを巻き込む、明るい主役",
  "everyones-home": "そこにいるだけで安心の存在",
  "wild-charisma": "周りを巻き込んで進む、自分の道",
  "iron-mental": "ブレない、揺るがない、信頼の人",
  "delicate-creator": "感性で世界を編み直す人",
  "healing-guardian": "静かに支え、誰かを癒す人",
  "deep-dive-explorer": "好きを掘り下げる職人気質",
  "cool-maverick": "クールな視点で物事を見る人",
};

const RELATIONSHIPS: Partial<
  Record<
    TorisetsuTypeId,
    {
      closest: TorisetsuTypeId;
      farthest: TorisetsuTypeId;
      bestPartner: TorisetsuTypeId;
    }
  >
> = {
  "festival-sun": {
    closest: "wild-charisma",
    farthest: "cool-maverick",
    bestPartner: "everyones-home",
  },
};

function calculateFriendAverages(
  friendAnswers: FriendAnswerRecord[],
): ShortBigFive {
  const map: Record<string, BigFiveDimension> = {
    "1": "E",
    "2": "A",
    "3": "O",
  };
  const buckets: Partial<Record<BigFiveDimension, number[]>> = {};

  for (const fa of friendAnswers) {
    for (const [qid, dim] of Object.entries(map)) {
      const v = fa.answers[qid];
      if (typeof v === "number") {
        (buckets[dim] ??= []).push(v);
      }
    }
  }

  const out: ShortBigFive = {};
  for (const dim of ["E", "A", "O"] as BigFiveDimension[]) {
    const values = buckets[dim];
    if (values && values.length > 0) {
      out[dim] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  return out;
}

export function buildReportData(input: {
  ownerToken: string;
  typeId: TorisetsuTypeId;
  selfScores: Record<BigFiveDimension, number>;
  friendAnswers: FriendAnswerRecord[];
}): ReportData {
  const { ownerToken, typeId, selfScores, friendAnswers } = input;
  const meta = torisetsuTypes[typeId];
  const friendBigFive = calculateFriendAverages(friendAnswers);
  const gaps = computeGapAnalysis(selfScores, friendAnswers);
  const topGaps = [...gaps]
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  const r = RELATIONSHIPS[typeId];

  return {
    ownerToken,
    typeId,
    typeName: meta.name,
    typeColor: meta.color,
    typeEmoji: meta.emoji,
    typeImageUrl: meta.imageUrl ?? null,
    typeSubtitle: meta.subtitle,
    typeCatchCopy: TYPE_CATCH_COPY[typeId] ?? meta.subtitle,
    selfBigFive: selfScores,
    friendBigFive,
    gaps,
    topGaps,
    friendCount: friendAnswers.length,
    meetsThreshold: friendAnswers.length >= REPORT_FRIEND_THRESHOLD,
    relationship: {
      closestType: r?.closest ?? null,
      farthestType: r?.farthest ?? null,
      bestPartnerType: r?.bestPartner ?? null,
    },
  };
}
