// タコ結果ページ ② 深掘りの自動生成データ。
//   スコア計算・タイプ判定には一切触れず、既存の perception-analysis.ts
//   (buildDimensionGaps / calcMutualUnderstanding) の結果から表示用の
//   「一致度・ギャップ一言・隠れた長所」を導出するだけ。
//
// 軸ラベルは、発散バー本体 (BigFiveDivergingBars) と同じ名称に統一する
//   (2026-07-20 指示: カード・解説文とグラフで「社交性/外向性」等の呼び名が
//    食い違わないようにする)。

import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "./perception-analysis";
import type { BigFiveDimension } from "./types";

// ② 一言テンプレート用の軸名 (発散バーの AXES.title と同一)。
const WARM_AXIS_LABEL: Record<BigFiveDimension, string> = {
  O: "開放性",
  C: "誠実性",
  E: "外向性",
  A: "協調性",
  N: "神経症傾向",
};

export type DeepDiveGap = {
  /** 温かい軸名 (例: 繊細さ) */
  label: string;
  /** 自己スコア % (0-100) */
  selfPercent: number;
  /** 友達平均 % (0-100) */
  otherPercent: number;
};

export type DeepDiveData = {
  /** 見方の一致 (相互理解度) %。 */
  agreement: number;
  /** 主役: 自己と友達の差が最大の軸。 */
  gap: DeepDiveGap;
  /** 脇役: 友達が自己より高く見た軸 (ギャップ軸と重複時は次点にフォールバック)。無ければ null。 */
  hiddenStrength: DeepDiveGap | null;
};

/**
 * 自己スコアと友達平均から ② 深掘りの表示データを導出する。
 * どちらかが欠損 (friendAvg=null) の場合は null。
 */
export function buildDeepDive(
  selfScores: BigFiveScores,
  friendAvgScores: BigFiveScores | null,
): DeepDiveData | null {
  if (!friendAvgScores) return null;

  const gaps = buildDimensionGaps(selfScores, friendAvgScores);
  if (gaps.length === 0) return null;

  const agreement = calcMutualUnderstanding(gaps);

  const toWarm = (g: (typeof gaps)[number]): DeepDiveGap => ({
    label: WARM_AXIS_LABEL[g.key],
    selfPercent: g.selfPercent,
    otherPercent: g.otherPercent,
  });

  // 主役: 差 (diffPoints) が最大の軸。同値は元の軸順 (perception-analysis の DIMENSIONS 順)。
  const byDiff = [...gaps].sort((a, b) => b.diffPoints - a.diffPoints);
  const gapAxis = byDiff[0];

  // 脇役 (隠れた長所): 友達が自己を上回った軸を差の大きい順。
  //   主役 (ギャップ軸) と同一軸になったら次点にフォールバックし、二重説明を避ける。
  const hiddenCandidates = gaps
    .filter((g) => g.otherPercent > g.selfPercent)
    .sort(
      (a, b) =>
        b.otherPercent - b.selfPercent - (a.otherPercent - a.selfPercent),
    );
  const hidden =
    hiddenCandidates.find((g) => g.key !== gapAxis.key) ?? null;

  return {
    agreement,
    gap: toWarm(gapAxis),
    hiddenStrength: hidden ? toWarm(hidden) : null,
  };
}

/** ギャップ一言。self がごく低いときは「ほぼゼロ」で柔らかく。 */
export function gapSentence(gap: DeepDiveGap): string {
  const selfText = gap.selfPercent <= 10 ? "ほぼゼロ" : `${gap.selfPercent}%`;
  return `一番のギャップは${gap.label}。自分では${selfText}、でも友達は${gap.otherPercent}%感じてる。`;
}

/** 隠れた長所の一言。 */
export function hiddenStrengthSentence(gap: DeepDiveGap): string {
  return `気づいてない強みは${gap.label}。自分で思うより高く見られてる。`;
}

/**
 * ②「みんなの目」固定プローズ (AIを使わず deep から決定的に組み立てる)。
 *   P1: gap の方向 (友達が高く/低く見たか) で出し分ける導入。
 *   P2: hiddenStrength (隠れた長所) があれば一文で添える。
 *   P3: 見方の一致 (agreement) で締める。
 * 返り値は段落の配列 (呼び出し側で <p> 化)。ネガ表現は「愛されるクセ」に寄せる。
 */
// viewer: 「誰から見たか」の表示名 (例 "ゆかさん")。1人完結モデルの友達別シートで
// 指定すると「友達/みんな」をその名前に置き換える。省略時は従来の総称。
export function buildMinnaProse(deep: DeepDiveData, viewer?: string): string[] {
  const { gap, hiddenStrength, agreement } = deep;
  const diff = gap.otherPercent - gap.selfPercent;
  const paras: string[] = [];
  const who = viewer ?? "みんな"; // 主語 (〜は頼りにしている / 〜との見方の一致)
  const friendWord = viewer ?? "友達"; // 「友達の目には」の置き換え

  // P1: ギャップの方向
  if (diff >= 8) {
    // 友達のほうが高く見ている: 自己評価より周りが頼りにしている軸。
    paras.push(
      `${friendWord}の目には、自分が思うよりずっと「${gap.label}のある人」として映っているみたい。その${gap.label}を、アナタが思う以上に${who}は頼りにしているよ。自分では当たり前にやっていることが、周りにはしっかり届いているんだ。`,
    );
  } else if (diff <= -8) {
    // 友達のほうが低く見ている: 気を張らない姿として伝わっている。
    paras.push(
      `自分では「${gap.label}」を強めに出しているつもりでも、${friendWord}にはもう少し肩の力を抜いた姿として映っているみたい。気を張りすぎないその自然体こそ、まわりが安心して寄ってくる理由になっているよ。`,
    );
  } else {
    // ほぼ一致: 自己像と周りの印象が重なっている。
    paras.push(
      `「${gap.label}」の見え方は、自分と${who}でほとんど同じ。自己イメージと周りの印象がきれいに重なっているのは、アナタが素のままで人と関われている証拠だよ。`,
    );
  }

  // P2: 隠れた長所 (一文だけ。2026-07-20 指示で短縮)
  if (hiddenStrength) {
    paras.push(
      `それに、自分ではあまり気づいていない「${hiddenStrength.label}」も、${who}にはしっかり届いているみたい。`,
    );
  }

  // P3: 見方の一致で締める
  paras.push(
    agreement >= 70
      ? `${who}との見方の一致は${agreement}%。自分らしさが、そのまま周りに伝わっているみたい。今のアナタのままで、まわりはちゃんと受け取ってくれているよ。`
      : `${who}との見方の一致は${agreement}%。自分では当たり前だと思っている一面が、周りには新鮮に映っていることもあるみたい。まだ知られていない良さも、これから少しずつ伝わっていきそうだよ。`,
  );

  return paras;
}


// =====================================================================
// ④「◯◯さんとの相性 (推定)」— 友達が未診断のとき、回答のギャップから推定する。
//   友達自身の32型が無い場合のフォールバック。compat() (aisho-compat.ts) と同じ
//   percent 40-95 / ★1-5 のレンジに揃え、見え方の一致度 (回答ギャップ) を相性の
//   近似として使う。ルールベース・LLM不使用。
// =====================================================================

export type EstimatedAxisInsight = {
  /** 軸名 (発散バーと同じ: 開放性/誠実性/外向性/協調性/神経症傾向) */
  label: string;
  /** 一致度: match=ぴったり (差<=10) / close=すこしズレ (<=25) / gap=ギャップあり */
  state: "match" | "close" | "gap";
  selfPercent: number;
  otherPercent: number;
  /** その軸の見え方について 2-3 文の解説 (方向別コピー) */
  body: string;
};

export type EstimatedCompat = {
  percent: number; // 40-95 (compat() と同レンジ)
  stars: number; // 1-5
  rank: "S" | "A" | "B" | "C"; // /aisho ヒーローのランク画像に対応
  /**
   * 相性の本文 (2026-07-20 指示: 見出し・軸分解なしのひと続きの読み物)。
   * 総評 → 具体的なシーン (たとえば、〜) → ズレの描写 (いっぽうで、〜) → 締め の順。
   */
  summaryParas: string[];
  /** 5軸それぞれの見え方の一致/ズレ解説 (OCEAN 順)。内部組み立て用。 */
  axes: EstimatedAxisInsight[];
  /** 関係を深めるヒント (CheckList 表示用・8つ) */
  kotsu: { title: string; body: string }[];
  /** 関係を壊すワナ (WarnList 表示用・8つ) */
  wana: { title: string; body: string }[];
};

// 軸ごとの「関係を深めるヒント」({name} は viewer に置換)。
//   match = 見え方が一致している軸向け / off = ズレている軸向け。各 2 個ずつ。
type KotsuItem = { title: string; body: string };
const KOTSU_COPY: Record<string, { match: KotsuItem[]; off: KotsuItem[] }> = {
  開放性: {
    match: [
      {
        title: "思いつきはすぐ共有",
        body: "「これ面白そう」と思ったら、その日のうちに{name}に送ってみて。ワクワクの温度が同じふたりは、ノリの鮮度がいちばんのごちそうだよ。",
      },
      {
        title: "ハマりものは一緒に沼る",
        body: "どちらかがハマったものは、とりあえずふたりで試すのがおすすめ。同じ熱量で楽しめる相手は貴重だよ。",
      },
    ],
    off: [
      {
        title: "誘いの温度を合わせる",
        body: "新しい遊びに誘うときは、「気になってるんだけど、どう?」のひとことから。腰の軽さの違いは、聞き方ひとつでちょうどいい橋になるよ。",
      },
      {
        title: "行き先はふたつ用意",
        body: "定番の場所と新しい場所、両方の案を出して選んでもらおう。どっちに転んでも楽しいのがこのふたりだよ。",
      },
    ],
  },
  誠実性: {
    match: [
      {
        title: "段取りは交互に担当",
        body: "感覚が近いぶん、計画をどちらかに任せきりにしなくても回る。「次はわたしが決めるね」の交代制が、いちばん長続きするよ。",
      },
      {
        title: "目標はふたりで宣言",
        body: "資格でもバイトでも、ふたりで宣言すると続く。進め方の感覚が同じだから、いいペースメーカーになれるよ。",
      },
    ],
    off: [
      {
        title: "大事な予定は先に固める",
        body: "日時と集合場所を早めに確定させておこう。段取り感覚のズレは、先に決めてしまうだけでほとんど消えるよ。",
      },
      {
        title: "遅刻は責めずにルール化",
        body: "時間感覚のズレは性格の違い。「10分前集合ね」みたいなゆるいルールにしておくと、お互い責めずにすむよ。",
      },
    ],
  },
  外向性: {
    match: [
      {
        title: "休む日も一緒でいい",
        body: "盛り上がる日だけじゃなく、何もしない時間も共有できるふたり。「今日はだらだらしよ」って言える関係を大事にして。",
      },
      {
        title: "予定ゼロの日をつくる",
        body: "あえて何も決めない日を一緒に過ごしてみて。テンションが同じふたりは、無計画こそ楽しいよ。",
      },
    ],
    off: [
      {
        title: "テンションの正直申告",
        body: "今日は静かに過ごしたいのか、騒ぎたいのか。先に言葉にするだけで、{name}との時間はもっと楽になるよ。",
      },
      {
        title: "短く濃く会う",
        body: "長時間より、短くて濃い時間のほうがお互い心地いいかも。解散時間を先に決めておくのも優しさだよ。",
      },
    ],
  },
  協調性: {
    match: [
      {
        title: "たまにワガママを見せ合う",
        body: "気づかい上手なふたりだからこそ、たまの「本当はこうしたい」が効く。先に見せたほうが、関係はもっと近くなるよ。",
      },
      {
        title: "じゃんけんで決める勇気",
        body: "ふたりとも譲り合って決まらないときは、じゃんけんやコイントスでOK。決め方すら遊びにできる関係だよ。",
      },
    ],
    off: [
      {
        title: "してほしいことは言葉で",
        body: "察してもらうのを待つより、「これ手伝って」と口に出すほうが早い。{name}はきっと、頼られるのを待ってるよ。",
      },
      {
        title: "お礼は大げさなくらいで",
        body: "やってもらったことには「ありがとう」を大きめに。気づかいの見え方のズレは、感謝の言葉で埋まるよ。",
      },
    ],
  },
  神経症傾向: {
    match: [
      {
        title: "しんどい日は隣にいるだけ",
        body: "励まし合わなくても、一緒にいるだけで回復できるふたり。「今日は聞くだけでいい?」が合言葉だよ。",
      },
      {
        title: "浮上したら打ち上げ",
        body: "ふたりとも元気な日に「復活祝い」をしよう。沈む日を知っている同士だから、楽しい日の価値も倍になるよ。",
      },
    ],
    off: [
      {
        title: "「大丈夫?」は答え合わせ",
        body: "平気そうに見えても、内側では気を張っているかも。ときどき「ほんとに大丈夫?」と聞いてみて。そのひとことが安全基地になるよ。",
      },
      {
        title: "返信の速さを気にしない",
        body: "返事が遅い日は、そっとしておく合図。「既読スルーOK」をふたりのルールにすると、ずっと楽になるよ。",
      },
    ],
  },
};

// 軸ごとの「関係を壊すワナ」({name} は viewer に置換)。
//   match = 見え方が一致しているふたりが陥りがちなワナ / off = ズレているふたりのワナ。
//   注意喚起でも「愛されるクセ」トーンを守り、責める表現にしない。
const WANA_COPY: Record<string, { match: KotsuItem[]; off: KotsuItem[] }> = {
  開放性: {
    match: [
      {
        title: "ノリの無限ループ",
        body: "「いいじゃん」が通じすぎて、予定もお金も気づけばパンパンに。ときどき、どちらかがブレーキ役を引き受けよう。",
      },
      {
        title: "飽きのシンクロ",
        body: "ふたり同時に熱が冷めると、連絡まで一緒に途切れがち。ブームが去っても「元気?」だけは続けよう。",
      },
    ],
    off: [
      {
        title: "置いてけぼり招待",
        body: "片方のペースで誘い続けると、相手は断るのに疲れてしまう。返事が鈍いときは「一回休み」の合図だよ。",
      },
      {
        title: "思い出の上書き合戦",
        body: "新しい話ばかりだと、片方は置いていかれた気分に。たまには定番のお店で、いつもの話をする日も作って。",
      },
    ],
  },
  誠実性: {
    match: [
      {
        title: "「任せた」の空白",
        body: "ふたりとも「あの人がやるでしょ」と思った瞬間、誰も予約していない事件が起きる。担当だけは口に出して決めて。",
      },
      {
        title: "予定の詰め込みすぎ",
        body: "きっちり者同士、予定表がびっしりになりがち。余白のない計画は、どちらかが倒れたら全部崩れるよ。",
      },
    ],
    off: [
      {
        title: "小さなイラッの積み立て",
        body: "「なんで決めないの?」「なんで急かすの?」は、このふたりの定番のすれ違い。性格の違いだと知っているだけで、半分は消えるよ。",
      },
      {
        title: "「言ったのに」の水掛け論",
        body: "口約束はズレのもと。決まったことはトークに一行残しておくと、「言った言わない」が消えるよ。",
      },
    ],
  },
  外向性: {
    match: [
      {
        title: "休息不足の共倒れ",
        body: "盛り上がれるふたりほど、疲れに気づくのが遅れがち。「今日は解散!」を言い出せるのも仲の証だよ。",
      },
      {
        title: "ふたりだけで完結",
        body: "居心地が良すぎて、ほかの友達との予定が後回しに。たまには別々の輪で過ごすと、話のネタも増えるよ。",
      },
    ],
    off: [
      {
        title: "テンションの置き去り",
        body: "片方だけ盛り上がる時間が続くと、もう片方は静かにすり減っていく。ノリの温度確認をサボらないで。",
      },
      {
        title: "無言=不機嫌の誤解",
        body: "静かな時間を「怒ってる?」と受け取るとすれ違う。無言でも大丈夫な関係だと、お互い覚えておこう。",
      },
    ],
  },
  協調性: {
    match: [
      {
        title: "遠慮の無限ループ",
        body: "「どこでもいいよ」「私も」で30分たつのがこのふたり。譲り合いすぎたら、じゃんけんに切り替えよう。",
      },
      {
        title: "不満の在庫化",
        body: "優しいふたりほど、小さなモヤモヤを言わずに溜めがち。在庫が増える前に、軽いうちに出しちゃおう。",
      },
    ],
    off: [
      {
        title: "気づかいの一方通行",
        body: "合わせてもらっている側がそれを当たり前にすると、関係は静かに傾く。「いつもありがとう」を忘れずに。",
      },
      {
        title: "「言わなくても分かる」の期待",
        body: "察する力には個人差がある。期待して待つより、言葉にしたほうがずっと早く伝わるよ。",
      },
    ],
  },
  神経症傾向: {
    match: [
      {
        title: "一緒に沈むスパイラル",
        body: "ふたりとも落ち込むと、浮上のきっかけを失いがち。しんどい話は「30分だけ」と区切るのがコツだよ。",
      },
      {
        title: "不安の伝染",
        body: "片方の心配が、もう片方の不安に火をつけることがある。深呼吸してから話すだけで、だいぶ違うよ。",
      },
    ],
    off: [
      {
        title: "「平気」の鵜呑み",
        body: "「大丈夫」をそのまま信じ続けると、限界まで気づけない。たまに疑ってみるのも優しさだよ。",
      },
      {
        title: "温度差へのイライラ",
        body: "「なんでそんなに気にするの?」「なんで平気なの?」は禁句。感じ方の違いは、直すものじゃなく知っておくものだよ。",
      },
    ],
  },
};

// 軸ごと・方向ごとの解説コピー ({name} は viewer に置換)。
//   match  = 見え方がほぼ一致
//   higher = 友達のほうが高く見ている (自分で思うより「ある」と見られている)
//   lower  = 友達のほうが低く見ている
const AXIS_INSIGHT_COPY: Record<
  string,
  { match: string; higher: string; lower: string }
> = {
  開放性: {
    match:
      "「今度あそこ行かない?」と誰かが言い出したときのノリの良さが、ふたりはほぼ同じ。気になるカフェも、思いつきの小旅行も、「それ、いいじゃん」のひとことでトントン進んでいくよ。",
    higher:
      "{name}と一緒のとき、アナタは自分で思うよりフットワークが軽くなるみたい。「ちょっと気になる」とつぶやいたお店に、気づけばふたりで並んでいる——そんな展開が多いはず。",
    lower:
      "本当は気になっているイベントやお店を、アナタはまだ{name}に言えていないのかも。「実はこれ行きたくて」と見せた瞬間、ふたりの週末は一気ににぎやかになるよ。",
  },
  誠実性: {
    match:
      "テスト前の計画も、旅行のしおりも、ふたりの「ちゃんとやる度」はほぼ同じ。集合時間の感覚まで似ているから、待ち合わせでイライラした記憶がほとんどないんじゃないかな。",
    higher:
      "課題や約束をきっちり守るアナタの姿を、{name}は横でちゃんと見てる。「この人に任せれば大丈夫」——グループワークでそう思われているのは、たぶんアナタだよ。",
    lower:
      "アナタなりの段取りは、{name}には少し自由に見えているみたい。旅行や大事な予定のときだけ「ここは決めておこう」と先に握っておくと、ふたりの時間はもっとスムーズになるよ。",
  },
  外向性: {
    match:
      "オールではしゃぐ日も、家でだらだら動画を見る日も、ふたりのテンションは自然にそろう。「今日はどっちの気分?」と確認しなくていいのが、この関係のいちばん楽なところ。",
    higher:
      "{name}の前のアナタは、ふだん見せている顔よりずっとよく笑ってるみたい。疲れた日の帰り道、{name}と話しているうちに元気になってた——そんな経験、きっとあるはず。",
    lower:
      "{name}にはアナタが少し物静かに映っているみたい。カラオケでもドライブでも、本気ではしゃぐアナタを見せたら、{name}はもっと喜ぶよ。",
  },
  協調性: {
    match:
      "お店を決めるときも、割り勘のときも、どっちが我慢するでもなく自然に折り合える。「合わせすぎて疲れた」がないのは、気づかいの温度が同じだからだよ。",
    higher:
      "グラスが空いたら注ぐ、疲れてそうなら早めに切り上げる——アナタのさりげない気づかいを、{name}は全部ちゃんと受け取ってる。今度は遠慮せず、頼る側にも回ってみて。",
    lower:
      "アナタの気づかいは、{name}にはまだ半分しか届いていないかも。「荷物持つよ」「大丈夫?」を言葉にした日から、{name}の中のアナタはもっとあったかい人になるよ。",
  },
  神経症傾向: {
    match:
      "落ち込んだ夜に長文を送っても引かれない安心感がある。励ましの言葉がなくても、通話をつないでおくだけで回復できる。しんどい日の過ごし方まで似ているふたりだよ。",
    higher:
      "「平気だよ」と笑った日の帰り際に「ほんとに?」と聞いてくるのが{name}。アナタの強がりは、たぶんもうバレてる。先に弱音を吐いちゃうほうが、このふたりはうまくいくよ。",
    lower:
      "{name}の前では、アナタはいつも落ち着いて見えているみたい。それだけ安心できる相手ということ。でも無理してる日は正直に言って大丈夫、ちゃんと受け止めてくれるよ。",
  },
};

// まとめ (2 段落)。1 段落目 = 一致度の総評、2 段落目 = その意味づけ。
function estimatedSummaryParas(percent: number, viewer: string): string[] {
  if (percent >= 85) {
    return [
      `回答を見るかぎり、${viewer}はアナタのことをかなり正確に見てる。わかってもらえてる安心感があるから、素のままで居られる相性だよ。`,
      `「わかってくれてる」って、実は当たり前じゃない。${viewer}の回答は、アナタが言葉にしていない部分までちゃんと見てくれている証拠。この安心感は、ふたりの関係のいちばんの武器だよ。`,
    ];
  }
  if (percent >= 70) {
    return [
      `${viewer}の見ているアナタと、自分の思うアナタはだいたい重なってる。ときどき見え方のズレはあるけど、それが会話のネタになるくらいのいい距離感。`,
      `全部が一致していないのが、むしろちょうどいい。わかり合えている土台があるから、ズレは「へえ、そう見えてたんだ」って楽しめる。話すたびに発見がある関係だよ。`,
    ];
  }
  if (percent >= 55) {
    return [
      `${viewer}から見えているアナタには、自分の認識とちょっと違う部分があるみたい。そのズレこそ、お互いをもっと知る伸びしろだよ。`,
      `ギャップは悪いことじゃなくて、${viewer}がアナタの知らない一面を見つけてくれてるということ。気になったところは本人に聞いてみると、思った以上に会話が盛り上がるよ。`,
    ];
  }
  return [
    `${viewer}とは見え方のギャップが大きめ。それは合わないというより、意外な自分を教えてくれる貴重な存在ということでもあるよ。`,
    `大きなギャップは、${viewer}の前で見せている顔と、自分で思う顔が違うということ。どっちも本物のアナタ。両方知っている人が増えるほど、アナタはもっと自由になれるよ。`,
  ];
}

/**
 * 自己スコアと友達の perceived_scores のギャップから相性を推定する。
 * 一致度 (calcMutualUnderstanding) を compat() と同じ 40-95% レンジに写像。
 * スコアが欠損して計算できない場合は null。
 */
export function estimateCompatFromGaps(
  selfScores: BigFiveScores,
  perceivedScores: BigFiveScores,
  viewer: string,
): EstimatedCompat | null {
  const gaps = buildDimensionGaps(selfScores, perceivedScores);
  if (gaps.length === 0) return null;
  if (gaps.some((g) => !Number.isFinite(g.diffPoints))) return null;

  const agreement = calcMutualUnderstanding(gaps); // 0-100
  const percent = Math.max(40, Math.min(95, Math.round(40 + agreement * 0.55)));
  const stars =
    percent >= 90 ? 5 : percent >= 75 ? 4 : percent >= 60 ? 3 : percent >= 45 ? 2 : 1;
  // ランクは compat() (aisho-compat.ts rankFor) と同じ閾値
  const rank = percent >= 85 ? "S" : percent >= 70 ? "A" : percent >= 55 ? "B" : "C";

  // 5軸ぶんの見え方解説。並びは発散バーと同じ O→C→E→A→N に揃える。
  const GRAPH_ORDER: BigFiveDimension[] = ["O", "C", "E", "A", "N"];
  const ordered = [...gaps].sort(
    (x, y) => GRAPH_ORDER.indexOf(x.key) - GRAPH_ORDER.indexOf(y.key),
  );
  const axes: EstimatedAxisInsight[] = ordered.map((g) => {
    const label = WARM_AXIS_LABEL[g.key];
    const copySet = AXIS_INSIGHT_COPY[label];
    const state: EstimatedAxisInsight["state"] =
      g.diffPoints <= 10 ? "match" : g.diffPoints <= 25 ? "close" : "gap";
    const body =
      state === "match"
        ? copySet.match
        : g.otherPercent > g.selfPercent
          ? copySet.higher
          : copySet.lower;
    return {
      label,
      state,
      selfPercent: g.selfPercent,
      otherPercent: g.otherPercent,
      body: body.replaceAll("{name}", viewer),
    };
  });

  // ===== 5軸の解説を自然な読み物に組む =====
  // 一致した軸 (差が小さい順) → ズレた軸 (差が大きい順) の順で、接続詞をつけて流す。
  const matched = axes
    .filter((ax) => ax.state === "match")
    .sort(
      (x, y) =>
        Math.abs(x.selfPercent - x.otherPercent) -
        Math.abs(y.selfPercent - y.otherPercent),
    );
  const offAxes = axes
    .filter((ax) => ax.state !== "match")
    .sort(
      (x, y) =>
        Math.abs(y.selfPercent - y.otherPercent) -
        Math.abs(x.selfPercent - x.otherPercent),
    );
  // 相性の本文: 総評 → シーン描写 (2つずつ接続詞で連結) → ズレ → 締め、のひと続き。
  // 2026-07-20 指示で少し短く: シーンは合計 4 つまで (ズレ軸を優先し、残りを一致軸で埋める)。
  const MAX_SCENES = 4;
  const [sumOpen, sumClose] = estimatedSummaryParas(percent, viewer);
  const offScenes = offAxes.slice(0, 3).map((ax) => ax.body);
  const matchScenes = matched
    .slice(0, Math.max(0, MAX_SCENES - offScenes.length))
    .map((ax) => ax.body);
  const summaryParas: string[] = [sumOpen];
  if (matchScenes.length > 0) {
    // 2 シーンずつ 1 段落に。段落頭だけ接続詞を変える (たとえば → それだけじゃなく)。
    const CHUNK_LEADS = ["たとえば、", "それだけじゃなく、", "さらに言えば、"];
    for (let i = 0; i < matchScenes.length; i += 2) {
      const lead = CHUNK_LEADS[Math.min(i / 2, CHUNK_LEADS.length - 1)];
      summaryParas.push(lead + matchScenes.slice(i, i + 2).join(""));
    }
  }
  if (offScenes.length > 0) {
    summaryParas.push("いっぽうで、" + offScenes.join("それから、"));
  }
  summaryParas.push(sumClose);

  // ===== 関係を深めるヒント (8つ) =====
  // ズレた軸 (差が大きい順) の off 版 2 個ずつを優先し、
  // 残りを一致軸 (差が小さい順) の match 版で埋める。
  const kotsu = [
    ...offAxes.flatMap((ax) => KOTSU_COPY[ax.label].off),
    ...matched.flatMap((ax) => KOTSU_COPY[ax.label].match),
  ]
    .slice(0, 8)
    .map((k) => ({
      title: k.title,
      body: k.body.replaceAll("{name}", viewer),
    }));

  // ===== 関係を壊すワナ (8つ) =====
  // ズレた軸 (差が大きい順) の off 版 2 個ずつを優先し、残りを一致軸の match 版で埋める。
  const wana = [
    ...offAxes.flatMap((ax) => WANA_COPY[ax.label].off),
    ...matched.flatMap((ax) => WANA_COPY[ax.label].match),
  ]
    .slice(0, 8)
    .map((k) => ({
      title: k.title,
      body: k.body.replaceAll("{name}", viewer),
    }));

  return {
    percent,
    stars,
    rank,
    summaryParas,
    axes,
    kotsu,
    wana,
  };
}
