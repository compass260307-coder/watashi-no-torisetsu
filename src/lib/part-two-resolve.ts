// 第二部「友達から見たあなた」本文のサーバ解決 (三層モデル Step2)。
//
// 構成 (2026-07-12 確定):
//   1. 友達から見たあなたの武器      ... 無料 (未解放でも公開。バイラルの燃料)
//   2. 友達から嫌われやすい性格      ... 🔒 友達3人 or 完全版
//   3. 友達から好かれやすい性格      ... 無料 (未解放でも公開)
//   4. 関係別の見られ方 (友達/恋人/家族/上司) ... 🔒 友達3人 or 完全版
//
// 中身は自己回答のタイプ/スコアから決定的に導出した"予測" (実際の友達回答は第三部 /tako)。
//
// deep-dive-resolve.ts と同じフェイルクローズ方針:
//   🔒ブロックの本文はサーバでこのヘルパに集約し、未解放時は null を返す
//   (本文が payload にもクライアントバンドルにも載らない)。
//
// 素材:
//   - 武器/嫌われやすい: perceivedByType32 (strengths/surprises) の流用。
//     {B}=友達名 差し込み前提の /tako 用素材なので {B}さん → 「友達」に置換。
//   - 好かれやすい/関係別: このファイル内のルールベース (軸の高低で決定。LLM不使用)。

import type { BigFiveDimension } from "./types";
import type { SixteenTypeId } from "./sixteen-types";
import type { ThirtyTwoTypeId } from "./thirty-two-types";
import {
  PERCEIVED_BY_TYPE,
  type ContentItem,
} from "./mutual-result-content";
import { perceivedByType32 } from "./thirty-two-content/perceived-by-type-32";
import { dislikableFor } from "./dislikable-by-type-32";

export type RelationView = {
  /** 関係ラベル (友達/恋人/家族/上司・先輩)。 */
  relation: string;
  body: string;
};

export type SceneCaution = {
  /** シーンラベル (SceneCautionTeaser の SCENE_ITEMS と一致させる)。 */
  scene: string;
  body: string;
};

export type ResolvedPartTwo = {
  /** 武器 (強み6項目・チェックリスト表示)。無料 = 未解放でも返す。null は素材欠損時のみ。 */
  weapons: ContentItem[] | null;
  /** 好かれやすい性格 (軸由来の文章・段落配列)。無料 = 未解放でも返す。 */
  likable: string[];
  /** 嫌われやすい性格 (タイプ別8項目。未登録タイプは旧6項目)。🔒 null = 未解放 (本文を解決しない)。 */
  dislikable: ContentItem[] | null;
  /**
   * 嫌われやすい性格の題名だけ (日本語)。未課金のとき、鍵の後ろにぼかして敷く。
   * 「もしもの時」の場面名・「言えずにいること」の関係名と同じ扱いで、題名は見せ、
   * 本文は見せない。未登録タイプ・他言語は undefined (従来の共通の見本に戻る)。
   */
  dislikableTitles?: string[];
  /** 関係別の見られ方 (友達/恋人/家族/上司)。🔒 null = 未解放。 */
  relations: RelationView[] | null;
  /** シーン別の注意点 (③あなたの注意点の直下)。🔒 null = 未解放。 */
  sceneCautions: SceneCaution[] | null;
  /** ギャップ予告の一文 (無料メタ)。 */
  gapTeaser: string;
  locked: boolean;
};

const AXIS_LABEL: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "繊細さ",
};

/** {B}さん (友達名プレースホルダ) を「友達」に置換した汎用文にする。 */
function generalize(text: string): string {
  return text.replaceAll("{B}さん", "友達");
}

function generalizeItems(items: ContentItem[]): ContentItem[] {
  return items.map((it) => ({ ...it, body: generalize(it.body) }));
}

// ===== 武器の文体バリエーション =====
// 素材は全文「{B}さんは、/{B}さんには、」で始まるため、単純置換だと6項目とも
// 「友達は、〜」で単調になる (2026-07-13 指摘)。主語をインデックス別に散らし、
// 補足の一文 (汎用の称賛タグ) を足して 16P 風の2文構成にする。
const WEAPON_SUBJECT_WA = [
  "友達は、",
  "周りは、",
  "実は友達は、",
  "みんな、",
  "仲のいい友達ほど、",
  "気づけば周りは、",
];
const WEAPON_SUBJECT_NIWA = [
  "友達には、",
  "周りの目には、",
  "実は友達には、",
  "みんなの目には、",
  "仲のいい友達の目には、",
  "気づけば周りには、",
];
const WEAPON_TAIL = [
  "自分では当たり前でも、周りから見れば立派な特技です。",
  "これができる人は、実はそれほど多くありません。",
  "本人が思っているより、ずっと大きな武器です。",
  "あなたがいるだけで、助かっている人がいます。",
  "気づいていないのは、たぶんあなただけです。",
  "この安心感は、簡単には真似できません。",
];

function varyWeapons(items: ContentItem[]): ContentItem[] {
  return items.map((it, i) => {
    const body = it.body
      .replaceAll("{B}さんには、", WEAPON_SUBJECT_NIWA[i % WEAPON_SUBJECT_NIWA.length])
      .replaceAll("{B}さんは、", WEAPON_SUBJECT_WA[i % WEAPON_SUBJECT_WA.length])
      .replaceAll("{B}さん", "友達"); // 文中残り (係り方が違うもの) は従来どおり
    return { ...it, body: `${body}${WEAPON_TAIL[i % WEAPON_TAIL.length]}` };
  });
}

// ===== 嫌われやすい性格の増量 (🔒・文体バリエーション) =====
// 素材 (surprises) は各1文で薄かった (2026-07-15 指摘)。武器の varyWeapons と同じ発想で、
// インデックス別の補足文を足して2文構成にする。トーンは「欠点の断罪」ではなく
// 「仲がいいからこそ見えているクセ」(ネガは愛されるクセに変換する、のルール準拠)。
const DISLIKE_TAIL = [
  "悪気がないことは、みんなちゃんと分かっています。ただ、先にひと言あるだけで印象はまるで違います。",
  "これは短所というより、あなたの長所が強く出すぎた瞬間です。自覚しておくだけで武器に変わります。",
  "本人に直接は言いませんが、仲がいいからこそ気になっている部分です。",
  "隠しているつもりでも、近くにいる人にはちゃんと伝わっています。",
  "嫌いになるほどのことではありません。ただ、積み重なると小さな距離になっていきます。",
  "気づいた日から変えられるタイプのクセです。むしろ伸びしろだと思われています。",
];

function varyDislikable(items: ContentItem[]): ContentItem[] {
  return generalizeItems(items).map((it, i) => ({
    ...it,
    body: `${it.body}${DISLIKE_TAIL[i % DISLIKE_TAIL.length]}`,
  }));
}

// ===== 好かれやすい性格 (無料・ルールベース・文章) =====
// 5軸の高低から流れのある文章 (3〜4段落) を組む。どちらに転んでも長所として書く
// (ネガをそのまま出さない)。段落構成: ①E (第一印象の魅力) ②A+C (人柄の信頼)
// ③O+N (一緒にいて得なところ) ④締め (固定)。
const LIKABLE_PROSE: Record<BigFiveDimension, Record<"H" | "L", string>> = {
  E: {
    H: "あなたの周りは、いつも少しにぎやかです。あなたが来るだけで空気が軽くなり、「とりあえず呼ぼう」の一番手に挙がっています。本人が思っているより、その明るさに救われている友達はずっと多くいます。",
    L: "あなたの魅力は、静かな安心感です。騒がないぶん、話をちゃんと受け止めてくれる人だと思われていて、二人きりのときのあなたがいちばん好かれています。「あの子には話せる」と思っている友達がいます。",
  },
  A: {
    H: "それから、頼まれる前に動ける自然な気配り。あなたには当たり前すぎて気づいていませんが、その小さな優しさに周りは何度も救われています。",
    L: "それから、裏表のなさ。思ったことをそのまま言うので、あなたの褒め言葉には嘘がありません。だからこそ、あなたに認められると特別に嬉しい。そんな存在になっています。",
  },
  C: {
    H: "約束も秘密もきちんと守る誠実さで、「あの人なら大丈夫」という信頼も静かに積み上がっています。",
    L: "きっちりしすぎないゆるさがあって、一緒にいると相手も肩の力が抜けます。それも立派な才能です。",
  },
  O: {
    H: "話していて飽きないのも、あなたの得なところです。「それ何?」から会話がどんどん転がっていくので、一緒にいる時間が長いほど好かれていきます。",
    L: "流行に流されない安定感も、あなたの得なところです。いつ会っても同じテンションでいてくれる心地よさは、長く付き合うほど効いてきます。",
  },
  N: {
    H: "そして、誰かが沈んでいるときに最初に気づくのは、あなたです。何気ないその一言に救われた友達がいます。",
    L: "そして、何が起きても慌てない余裕。そばにいるだけで安心する、と思われています。",
  },
};

const LIKABLE_CLOSING =
  "本人は無自覚かもしれないけれど、この組み合わせはかなり得な性格です。無理に盛らなくていい。いつものあなたのままで、ちゃんと好かれています。";

// ===== 関係別の見られ方 (🔒・ルールベース) =====
// 関係ごとに効く2軸の高低 (2×2=4パターン) で本文を決定。トーンは伝聞・やわらか。
type Quad = "HH" | "HL" | "LH" | "LL";

const RELATION_FRIEND: Record<Quad, string> = {
  // E × A
  HH: "グループの中心にいる、ノリが良くて優しい人。遊びの誘いはまずあなたに声がかかり、あなたが来る日は集まりの出席率が上がります。",
  HL: "言いたいことを言ってくれる、さっぱりした面白い人。遠慮がないので最初はひやっとさせますが、裏で悪く言わない安心感があり、長く付き合うほど信頼されていきます。",
  LH: "静かだけれど、いてくれると安心する人。大人数では目立たないのに、二人になるといちばん話しやすい。気づけば悩み相談が集まってくるタイプです。",
  LL: "群れない、自分の世界を持っている人。付き合う相手は狭いですが、あなたが心を許した友達は、それを少し誇りに思っています。",
};

const RELATION_LOVER: Record<Quad, string> = {
  // A × N
  HH: "相手の気持ちを先回りして動く、尽くすタイプ。その優しさは伝わっています。ただ我慢も一緒に溜めがちなので、恋人はあなたの本音をもっと聞きたいと思っています。",
  HL: "一緒にいて楽な、包容力のある恋人。ぶつかることが少ないぶん、たまに「何を考えてるか分からない」と言われることもあります。言葉にした分だけ、ちゃんと伝わります。",
  LH: "好きな相手にだけ見せる顔がある、不器用な一途タイプ。素っ気なく見えて、心の中では相手のことをずっと考えています。そのギャップに気づいた人は、離れられなくなります。",
  LL: "ベタベタしない、対等でさっぱりした恋人。束縛しない自由さが魅力です。ただ、たまの「好き」のひと言が、相手にとっていちばんの安心材料になります。",
};

const RELATION_FAMILY: Record<Quad, string> = {
  // C × E
  HH: "家でも外でも頼られる、自慢の存在。何でも自分でやってしまうので、家族は頼られなくて少し寂しく感じています。",
  HL: "手がかからない、静かなしっかり者。「心配ない」と思われているぶん、しんどいときほど言葉にしないと気づいてもらえません。",
  LH: "にぎやかで憎めない、家のムードメーカー。散らかった部屋も含めて、キャラとして愛されています。",
  LL: "マイペースで、家では省エネモード。外での頑張りが家族には見えにくいので、たまに近況をひと言話すだけで喜ばれます。",
};

const RELATION_BOSS: Record<Quad, string> = {
  // C × A
  HH: "安心して任せられて、気配りもできる優等生。ただ都合よく頼られやすいので、ときには断っても大丈夫です。",
  HL: "仕事は確実、意見もはっきり言う戦力。生意気と紙一重ですが、結果で信頼を積んでいくタイプだと見られています。",
  LH: "憎めない愛されキャラ。締切より人間関係で評価が保たれています。ここぞの場面だけきっちり決めると、株が一気に上がります。",
  LL: "読めないけれど、たまに大物感を出す存在。型にはめられるのが苦手なだけで、合う環境なら化けると思われています。",
};

// ※「後輩から」(RELATION_JUNIOR)・「初対面の人から」(RELATION_FIRST) の原稿は
//   2026-07-22 指示で表示ごと削除 (原稿は git 履歴で復元可能)。

// ===== シーン別の注意点 (🔒・ルールベース / 2026-07-15) =====
// SceneCautionTeaser (ロック時ティザー) に対応する本物の本文。関係別と同じ2軸クアッド
// 方式でシーンごとに決定。トーンは「注意点」だが説教にしない (先回りのヒント口調)。
// シーンラベルは SceneCautionTeaser の SCENE_ITEMS と一致必須。
const SCENE_FRIEND: Record<Quad, string> = {
  // E × A
  HH: "頼まれごとを断れず、幹事も相談役も全部引き受けてパンクしがちです。あなたが疲れている日ほど、周りは気づかずに甘えてきます。月に一度は「今日は無理」と言う練習をしてください。",
  HL: "ノリで言った率直な一言が、思ったより深く刺さっていることがあります。笑いにした指摘ほど、言われた本人は忘れません。ツッコミの前にひと呼吸おくだけで、事故はほぼ防げます。",
  LH: "合わせすぎて、帰り道にどっと疲れるタイプです。嫌と言えずに参加した集まりは、楽しめないうえに消耗だけが残ります。「今回はパス」を言える相手から、少しずつ増やしてください。",
  LL: "連絡を放置しているうちに、悪気なく疎遠になりがちです。あなたは「変わらず友達」のつもりでも、相手には「離れた」と映ることがあります。年に数回のひと言で、関係は保てます。",
};

const SCENE_LOVER: Record<Quad, string> = {
  // A × N
  HH: "尽くしながら我慢も一緒に溜めて、限界の日に一気にあふれる形に注意してください。相手には「急に爆発した」ように見えますが、実際は何か月分もの在庫です。小出しにするほうが、ずっと優しい伝え方です。",
  HL: "波風を立てないぶん、不満を言わないまま心の中で結論を出しがちです。相手に挽回の機会がないまま冷めていくのは、実はいちばん残酷な終わり方です。違和感は小さいうちに口に出してください。",
  LH: "好きなのに素直になれず、「察してほしい」モードに入りがちです。ただ、察せる人はほとんどいません。試すような駆け引きより、不安をそのまま言葉にしたほうが、結果は良くなります。",
  LL: "安定しているぶん、愛情表現が省エネになりがちです。あなたの「言わなくても分かるでしょ」は、相手には「もう好きじゃないのかも」と伝わります。定期的な「好き」は、関係のメンテナンスです。",
};

const SCENE_CAREER: Record<Quad, string> = {
  // C × N
  HH: "完璧主義と気にしすぎが重なって、自分を追い込みやすい人です。100点の準備より、60点で出して直すほうが評価される場面は多くあります。「これで十分」のラインを先に決めておいてください。",
  HL: "仕事は回せるぶん、限界を超えても気づかずに走り続けてしまいます。ルーズな人への無言の圧にも注意してください。あなたの「普通」は、かなり高い基準です。",
  LH: "後回しにした仕事が締切前に膨らんで、パニックと自己嫌悪がセットになりがちです。やる気を待たず、5分だけ手をつけるのがいちばんの防御です。始めれば案外進みます。",
  LL: "ギリギリの進行を楽観で乗り切れてしまうのが、逆にワナです。本人は平気でも、周りの信用は静かに削れていきます。締切の1日前を「自分の締切」にするだけで評価は変わります。",
};

const SCENE_FAMILY: Record<Quad, string> = {
  // C × E
  HH: "外で頑張りすぎた反動が、家でいちばん出ます。家族への当たりが強くなった日は、疲れのサインです。正論で家族を詰めても、誰も幸せになりません。",
  HL: "家では省エネモードで、近況をほとんど話しません。「心配ない子」と思われているぶん、しんどいときに気づいてもらえない。月に一度、ひと言報告するだけでだいぶ違います。",
  LH: "外では気を使うぶん、家では甘えっぱなしになりがちです。いちばん雑に扱っている相手が、いちばん味方でいてくれる人です。たまに思い出すだけで十分です。",
  LL: "部屋にこもって、生活が家族と完全にすれ違いがちです。放っておいてほしい気持ちは正当ですが、顔を見せるだけで安心する人が家にいます。夕飯を一緒に食べる日を、たまに作ってください。",
};

function buildSceneCautions(
  scores: Partial<Record<BigFiveDimension, number>>,
): SceneCaution[] {
  const hi = (d: BigFiveDimension) =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5;
  const quad = (a: BigFiveDimension, b: BigFiveDimension): Quad =>
    `${hi(a) ? "H" : "L"}${hi(b) ? "H" : "L"}` as Quad;
  return [
    { scene: "友達といる時", body: SCENE_FRIEND[quad("E", "A")] },
    { scene: "恋人といる時", body: SCENE_LOVER[quad("A", "N")] },
    { scene: "キャリアにおいて", body: SCENE_CAREER[quad("C", "N")] },
    { scene: "家族といる時", body: SCENE_FAMILY[quad("C", "E")] },
  ];
}

function buildRelations(
  scores: Partial<Record<BigFiveDimension, number>>,
): RelationView[] {
  const hi = (d: BigFiveDimension) =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5;
  const quad = (a: BigFiveDimension, b: BigFiveDimension): Quad =>
    `${hi(a) ? "H" : "L"}${hi(b) ? "H" : "L"}` as Quad;
  // 「後輩から」「初対面の人から」は 2026-07-22 指示で削除 (原稿テーブルは温存)。
  return [
    { relation: "友達から", body: RELATION_FRIEND[quad("E", "A")] },
    { relation: "恋人から", body: RELATION_LOVER[quad("A", "N")] },
    { relation: "家族から", body: RELATION_FAMILY[quad("C", "E")] },
    { relation: "上司・先輩から", body: RELATION_BOSS[quad("C", "A")] },
  ];
}

function buildLikable(
  scores: Partial<Record<BigFiveDimension, number>>,
): string[] {
  const hl = (d: BigFiveDimension): "H" | "L" =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5
      ? "H"
      : "L";
  const p = (d: BigFiveDimension) => LIKABLE_PROSE[d][hl(d)];
  return [
    p("E"),
    `${p("A")}${p("C")}`,
    `${p("O")}${p("N")}`,
    LIKABLE_CLOSING,
  ];
}

/**
 * 第二部の本文を解決する。無料ブロック (武器/好かれやすい) は常に解決し、
 * 🔒ブロック (嫌われやすい/関係別) は unlocked=false なら解決しない (null)。
 */
export function resolvePartTwo(
  thirtyTwoId: ThirtyTwoTypeId,
  sixteenId: SixteenTypeId,
  scores: Partial<Record<BigFiveDimension, number>>,
  opts: { unlocked: boolean },
): ResolvedPartTwo {
  // ギャップ予告: 自己スコアの最大軸を挙げ、第三部 (本物) への期待を作る。
  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const val = (d: BigFiveDimension) =>
    typeof scores[d] === "number" ? (scores[d] as number) : 5;
  const topDim = dims.reduce((a, b) => (val(b) > val(a) ? b : a));
  const gapTeaser = `あなたが自分でいちばん強いと思っている「${AXIS_LABEL[topDim]}」。友達の目には、違う濃さで映っていることがあります。`;

  // 武器/嫌われやすい: 32タイプ (全32キー投入済み) を優先、欠損時のみ 16タイプにフォールバック。
  const perceived =
    perceivedByType32[thirtyTwoId] ?? PERCEIVED_BY_TYPE[sixteenId] ?? null;

  const dislikableByType = dislikableFor(thirtyTwoId);

  return {
    weapons: perceived ? varyWeapons(perceived.strengths) : null,
    dislikableTitles: dislikableByType?.map((it) => it.title),
    likable: buildLikable(scores),
    // タイプ別に書いた8項目 (dislikable-by-type-32) を優先。未登録タイプだけ、従来どおり
    // 「意外な一面」6項目 + 定型の一文にフォールバックする。
    dislikable: opts.unlocked
      ? (dislikableByType ??
        (perceived ? varyDislikable(perceived.surprises) : null))
      : null,
    relations: opts.unlocked ? buildRelations(scores) : null,
    sceneCautions: opts.unlocked ? buildSceneCautions(scores) : null,
    gapTeaser,
    locked: !opts.unlocked,
  };
}
