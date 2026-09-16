// Alice Plus「相性占い」。四柱推命の命式計算は lunar-javascript を使い、
// 相性の読み解きは日主の五行・陰陽と日支/月支の関係から決定的に組み立てる。
// 出生情報は呼び出し元で保存せず、その場の鑑定だけに使う。

import { Solar } from "lunar-javascript";

export type LineAishoRelationship =
  | "crush"
  | "dating"
  | "partner"
  | "reconciliation"
  | "other";

export interface LineAishoPersonInput {
  name: string;
  birthDate: string;
  birthTime?: string;
}

export interface LineAishoInput {
  you: LineAishoPersonInput;
  partner: LineAishoPersonInput;
  relationship: LineAishoRelationship;
}

type Element = "木" | "火" | "土" | "金" | "水";
type BranchRelation = "harmony" | "support" | "clash" | "friction" | "neutral";

interface PersonChart {
  name: string;
  pillars: string[];
  timeKnown: boolean;
  dayStem: string;
  dayBranch: string;
  dayElement: Element;
  yang: boolean;
  elements: Record<Element, number>;
}

export interface LineAishoResult {
  score: number;
  title: string;
  lead: string;
  charts: {
    you: { name: string; dayMaster: string; pillars: string; timeKnown: boolean };
    partner: { name: string; dayMaster: string; pillars: string; timeKnown: boolean };
  };
  sections: {
    attraction: string;
    friction: string;
    communication: string;
    nextStep: string;
  };
}

const STEM_ELEMENT: Record<string, Element> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

const BRANCH_ELEMENT: Record<string, Element> = {
  寅: "木",
  卯: "木",
  巳: "火",
  午: "火",
  辰: "土",
  戌: "土",
  丑: "土",
  未: "土",
  申: "金",
  酉: "金",
  亥: "水",
  子: "水",
};

const ELEMENT_TRAIT: Record<Element, string> = {
  木: "まっすぐ育てていく力",
  火: "気持ちを明るく表す力",
  土: "関係を落ち着かせる力",
  金: "大切なことをはっきりさせる力",
  水: "相手の気持ちをしなやかに感じ取る力",
};

const GENERATES: Record<Element, Element> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

const HARMONY_PAIRS = new Set(["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"]);
const CLASH_PAIRS = new Set(["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"]);
const FRICTION_PAIRS = new Set(["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"]);
const SUPPORT_GROUPS = ["申子辰", "亥卯未", "寅午戌", "巳酉丑"];

function branchRelation(a: string, b: string): BranchRelation {
  const isPair = (pairs: Set<string>) =>
    pairs.has(`${a}${b}`) || pairs.has(`${b}${a}`);
  if (isPair(HARMONY_PAIRS)) return "harmony";
  if (isPair(CLASH_PAIRS)) return "clash";
  if (isPair(FRICTION_PAIRS)) return "friction";
  if (SUPPORT_GROUPS.some((group) => group.includes(a) && group.includes(b))) {
    return "support";
  }
  return "neutral";
}

function parseBirthDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("invalid_birth_date");
  const parts: [number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1901 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > Date.now()
  ) {
    throw new Error("invalid_birth_date");
  }
  return parts;
}

function parseBirthTime(value?: string): [number, number, boolean] {
  if (!value) return [12, 0, false];
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("invalid_birth_time");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("invalid_birth_time");
  return [hour, minute, true];
}

function buildChart(person: LineAishoPersonInput): PersonChart {
  const [year, month, day] = parseBirthDate(person.birthDate);
  const [hour, minute, timeKnown] = parseBirthTime(person.birthTime);
  const eight = Solar.fromYmdHms(year, month, day, hour, minute, 0)
    .getLunar()
    .getEightChar();
  const pillars = [eight.getYear(), eight.getMonth(), eight.getDay()];
  if (timeKnown) pillars.push(eight.getTime());
  const dayStem = eight.getDayGan();
  const dayBranch = eight.getDayZhi();
  const dayElement = STEM_ELEMENT[dayStem];
  if (!dayElement) throw new Error("unsupported_chart");
  const elements: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of pillars) {
    const stemElement = STEM_ELEMENT[pillar[0]];
    const branchElement = BRANCH_ELEMENT[pillar[1]];
    if (stemElement) elements[stemElement] += 1;
    if (branchElement) elements[branchElement] += 1;
  }
  return {
    name: person.name.trim().slice(0, 20) || "あなた",
    pillars,
    timeKnown,
    dayStem,
    dayBranch,
    dayElement,
    yang: eight.getDayGanIndex() % 2 === 0,
    elements,
  };
}

function elementRelation(a: Element, b: Element): "same" | "give" | "receive" | "control" {
  if (a === b) return "same";
  if (GENERATES[a] === b) return "give";
  if (GENERATES[b] === a) return "receive";
  return "control";
}

function chartBalance(a: PersonChart, b: PersonChart): number {
  const elements: Element[] = ["木", "火", "土", "金", "水"];
  const max = Math.max(a.pillars.length, b.pillars.length) * 2;
  const difference = elements.reduce(
    (sum, element) => sum + Math.abs(a.elements[element] - b.elements[element]),
    0,
  );
  return 1 - Math.min(1, difference / (max * 2));
}

function scoreFor(a: PersonChart, b: PersonChart): number {
  const dayRelation = branchRelation(a.dayBranch, b.dayBranch);
  const monthRelation = branchRelation(a.pillars[1][1], b.pillars[1][1]);
  const element = elementRelation(a.dayElement, b.dayElement);
  const branchPoints: Record<BranchRelation, number> = {
    harmony: 12,
    support: 7,
    neutral: 2,
    friction: -5,
    clash: -9,
  };
  const elementPoints = { same: 6, give: 9, receive: 9, control: -2 }[element];
  const polarityPoints = a.yang === b.yang ? 1 : 4;
  const balancePoints = Math.round(chartBalance(a, b) * 5);
  return Math.max(
    45,
    Math.min(
      95,
      62 + branchPoints[dayRelation] + Math.round(branchPoints[monthRelation] / 3) + elementPoints + polarityPoints + balancePoints,
    ),
  );
}

function titleFor(score: number): string {
  if (score >= 88) return "自然に惹かれ合う、運命級のふたり";
  if (score >= 78) return "違いも味方にできる、好相性のふたり";
  if (score >= 66) return "知るほど心地よくなるふたり";
  if (score >= 55) return "歩み寄り方が鍵になるふたり";
  return "違うからこそ、学びの多いふたり";
}

function attractionText(a: PersonChart, b: PersonChart): string {
  const relation = elementRelation(a.dayElement, b.dayElement);
  const branch = branchRelation(a.dayBranch, b.dayBranch);
  const branchLead =
    branch === "harmony"
      ? "ふたりは、言葉にしなくても相手の空気を感じ取りやすい組み合わせ。"
      : branch === "support"
        ? "ふたりは、一緒にいると自然に前向きな流れが生まれやすい組み合わせ。"
        : "ふたりの違いは、最初の強い興味や惹かれ合うきっかけになりやすそう。";
  if (relation === "same") {
    return `${branchLead}${a.dayElement}の性質を共有しているので、${ELEMENT_TRAIT[a.dayElement]}を大切にする感覚が似ています。`;
  }
  if (relation === "give") {
    return `${branchLead}${a.name}の${ELEMENT_TRAIT[a.dayElement]}が、${b.name}の${ELEMENT_TRAIT[b.dayElement]}を自然に後押しします。`;
  }
  if (relation === "receive") {
    return `${branchLead}${b.name}の${ELEMENT_TRAIT[b.dayElement]}が、${a.name}の${ELEMENT_TRAIT[a.dayElement]}を自然に後押しします。`;
  }
  return `${branchLead}${ELEMENT_TRAIT[a.dayElement]}と${ELEMENT_TRAIT[b.dayElement]}が違うからこそ、自分にない魅力を感じやすい関係です。`;
}

function frictionText(a: PersonChart, b: PersonChart): string {
  const relation = branchRelation(a.dayBranch, b.dayBranch);
  if (relation === "clash") {
    return "気持ちが動く速さや、距離を縮めたいタイミングが反対になりやすいふたり。片方が急ぐほど、もう片方は少し離れて考えたくなることがあります。";
  }
  if (relation === "friction") {
    return "大切にしているからこそ、言わなくても分かってほしい気持ちがたまりやすい関係。小さな違和感を我慢し続けると、あとから大きく感じやすくなります。";
  }
  if (a.dayElement === b.dayElement) {
    return "感覚が似ているぶん、ふたりとも同じところで意地を張ったり、相手も分かっているはずと思い込んだりしやすいかも。";
  }
  return "愛情の見せ方が違うため、片方の優しさがもう片方には伝わりにくいことも。行動だけで察してもらおうとせず、短い言葉を添えることが大切です。";
}

function communicationText(a: PersonChart, b: PersonChart): string {
  const first = a.yang === b.yang
    ? "ふたりとも自分のペースを守りやすいので、"
    : "片方が話し始め、もう片方が受け止める流れを作りやすいので、";
  return `${first}結論から決めるより「私はこう感じた」と自分の気持ちから伝えて。相手の返事を急かさず、一度受け取る間を作ると本音が届きやすくなります。`;
}

function nextStepText(relationship: LineAishoRelationship): string {
  switch (relationship) {
    case "crush":
      return "次に連絡するときは、答えを求める質問より「今日これを見て思い出した」のような、返しやすい一言を送ってみて。";
    case "dating":
    case "partner":
      return "今日、相手にしてもらって嬉しかったことをひとつだけ言葉にして伝えてみて。関係の安心感が育ちます。";
    case "reconciliation":
      return "復縁の答えを急ぐ前に、今ならどんな関係を作り直したいかを一文で書いてみて。それが次に連絡するかを決める軸になります。";
    default:
      return "次に話すとき、相手に知ってほしい自分の気持ちをひとつだけ、短い言葉で伝えてみて。";
  }
}

export function createLineAishoResult(input: LineAishoInput): LineAishoResult {
  const you = buildChart(input.you);
  const partner = buildChart(input.partner);
  const score = scoreFor(you, partner);
  const lead =
    score >= 78
      ? "惹かれ合う理由がはっきりあるふたり。違いを直そうとせず、役割として活かすほど関係が育ちます。"
      : score >= 60
        ? "最初から全部が同じではないけれど、知るほどふたりらしいバランスが見つかる関係です。"
        : "簡単な相性ではないからこそ、伝え方を知ると関係が大きく変わるふたりです。";
  return {
    score,
    title: titleFor(score),
    lead,
    charts: {
      you: {
        name: you.name,
        dayMaster: `${you.dayStem}（${you.dayElement}）`,
        pillars: you.pillars.join(" "),
        timeKnown: you.timeKnown,
      },
      partner: {
        name: partner.name,
        dayMaster: `${partner.dayStem}（${partner.dayElement}）`,
        pillars: partner.pillars.join(" "),
        timeKnown: partner.timeKnown,
      },
    },
    sections: {
      attraction: attractionText(you, partner),
      friction: frictionText(you, partner),
      communication: communicationText(you, partner),
      nextStep: nextStepText(input.relationship),
    },
  };
}
