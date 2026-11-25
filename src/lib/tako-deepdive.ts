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
import type { AppResultLocale } from "@/i18n/result";
import {
  ID_AXIS_INSIGHT_COPY,
  ID_KOTSU_COPY,
  ID_WANA_COPY,
  idEstimatedSummaryParas,
} from "@/i18n/id/friend-result-content";

// ② 一言テンプレート用の軸名 (発散バーの AXES.title と同一)。
const WARM_AXIS_LABEL: Record<BigFiveDimension, string> = {
  O: "開放性",
  C: "誠実性",
  E: "外向性",
  A: "協調性",
  N: "神経症傾向",
};

const KO_AXIS_LABEL: Record<BigFiveDimension, string> = {
  O: "개방성",
  C: "성실성",
  E: "외향성",
  A: "우호성",
  N: "정서적 민감성",
};
const ID_AXIS_LABEL: Record<BigFiveDimension, string> = {
  O: "Keterbukaan",
  C: "Ketelitian",
  E: "Ekstroversi",
  A: "Keramahan",
  N: "Kepekaan emosional",
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
  locale: AppResultLocale = "ja",
): DeepDiveData | null {
  if (!friendAvgScores) return null;

  const gaps = buildDimensionGaps(selfScores, friendAvgScores);
  if (gaps.length === 0) return null;

  const agreement = calcMutualUnderstanding(gaps);

  const toWarm = (g: (typeof gaps)[number]): DeepDiveGap => ({
    label: locale === "id" ? ID_AXIS_LABEL[g.key] : locale === "ko" ? KO_AXIS_LABEL[g.key] : WARM_AXIS_LABEL[g.key],
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
  return `一番のギャップは${gap.label}です。自分では${selfText}、でも友達は${gap.otherPercent}%感じています。`;
}

/** 隠れた長所の一言。 */
export function hiddenStrengthSentence(gap: DeepDiveGap): string {
  return `気づいていない強みは${gap.label}です。自分で思うより高く見られています。`;
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
export function buildMinnaProse(
  deep: DeepDiveData,
  viewer?: string,
  locale: AppResultLocale = "ja",
): string[] {
  const { gap, hiddenStrength, agreement } = deep;
  const diff = gap.otherPercent - gap.selfPercent;
  if (locale === "ko") {
    const who = viewer ?? "친구들";
    const friendWord = viewer ?? "친구들의 눈";
    const paras: string[] = [];
    if (diff >= 8) {
      paras.push(
        `${friendWord}에는 스스로 생각하는 것보다 훨씬 ‘${gap.label}이 높은 사람’으로 보여요. 자신에게는 당연한 행동이지만 ${who}은 그 모습을 분명한 장점으로 받아들이고 있어요.`,
      );
    } else if (diff <= -8) {
      paras.push(
        `스스로는 ‘${gap.label}’을 강하게 드러낸다고 생각하지만, ${friendWord}에는 조금 더 힘을 뺀 자연스러운 모습으로 보여요. 그 편안함이 사람들이 가까이 다가오는 이유가 되고 있어요.`,
      );
    } else {
      paras.push(
        `‘${gap.label}’을 보는 관점은 나와 ${who} 사이에서 거의 같아요. 자기 이미지와 주변의 인상이 겹친다는 것은 꾸미지 않은 모습이 잘 전해지고 있다는 뜻이에요.`,
      );
    }
    if (hiddenStrength) {
      paras.push(
        `또 스스로 크게 의식하지 못한 ‘${hiddenStrength.label}’도 ${who}에게는 확실히 전해지고 있어요.`,
      );
    }
    paras.push(
      agreement >= 70
        ? `${who}과 보는 관점의 일치도는 ${agreement}%예요. 지금의 나다움이 주변에도 자연스럽게 전달되고 있어요.`
        : `${who}과 보는 관점의 일치도는 ${agreement}%예요. 차이는 틀림이 아니라 내가 미처 몰랐던 모습을 친구가 발견했다는 뜻이에요.`,
    );
    return paras;
  }
  if (locale === "id") {
    const who = viewer ?? "teman Anda";
    const friendWord = viewer ?? "teman Anda";
    const paras: string[] = [];
    if (diff >= 8) {
      paras.push(`Di mata ${friendWord}, Anda terlihat jauh lebih memiliki “${gap.label}” daripada yang Anda kira. ${who} mengandalkan sisi itu lebih dari yang Anda sadari. Hal yang terasa biasa bagi Anda sudah tersampaikan dengan jelas kepada orang di sekitar.`);
    } else if (diff <= -8) {
      paras.push(`Anda merasa cukup kuat menunjukkan “${gap.label}”, tetapi di mata ${friendWord} Anda terlihat lebih santai dan alami. Sikap tanpa ketegangan berlebihan itulah yang membuat orang lain merasa aman untuk mendekat.`);
    } else {
      paras.push(`Cara Anda dan ${who} melihat “${gap.label}” hampir sama. Citra diri dan kesan dari luar bertemu dengan rapi; ini menandakan bahwa diri Anda yang alami sudah tersampaikan dalam hubungan.`);
    }
    if (hiddenStrength) paras.push(`Selain itu, “${hiddenStrength.label}” yang jarang Anda sadari juga telah tersampaikan dengan jelas kepada ${who}.`);
    paras.push(agreement >= 70
      ? `Kesesuaian cara pandang Anda dan ${who} adalah ${agreement}%. Diri Anda yang alami sudah tersampaikan apa adanya, dan orang di sekitar menerimanya dengan baik.`
      : `Kesesuaian cara pandang Anda dan ${who} adalah ${agreement}%. Sisi yang terasa biasa bagi Anda mungkin terlihat segar bagi orang lain; kualitas yang belum dikenal pun dapat tersampaikan sedikit demi sedikit.`);
    return paras;
  }

  const paras: string[] = [];
  const who = viewer ?? "みんな"; // 主語 (〜は頼りにしている / 〜との見方の一致)
  const friendWord = viewer ?? "友達"; // 「友達の目には」の置き換え

  // P1: ギャップの方向
  if (diff >= 8) {
    // 友達のほうが高く見ている: 自己評価より周りが頼りにしている軸。
    paras.push(
      `${friendWord}の目には、自分が思うよりずっと「${gap.label}のある人」として映っています。その${gap.label}を、あなたが思う以上に${who}は頼りにしているはずです。自分では当たり前にやっていることが、周りにはしっかり届いています。`,
    );
  } else if (diff <= -8) {
    // 友達のほうが低く見ている: 気を張らない姿として伝わっている。
    paras.push(
      `自分では「${gap.label}」を強めに出しているつもりでも、${friendWord}にはもう少し肩の力を抜いた姿として映っています。気を張りすぎないその自然体こそ、まわりが安心して寄ってくる理由になっているようです。`,
    );
  } else {
    // ほぼ一致: 自己像と周りの印象が重なっている。
    paras.push(
      `「${gap.label}」の見え方は、自分と${who}でほとんど同じです。自己イメージと周りの印象がきれいに重なっているのは、あなたが素のままで人と関われている証拠です。`,
    );
  }

  // P2: 隠れた長所 (一文だけ。2026-07-20 指示で短縮)
  if (hiddenStrength) {
    paras.push(
      `それに、自分ではあまり気づいていない「${hiddenStrength.label}」も、${who}にはしっかり届いています。`,
    );
  }

  // P3: 見方の一致で締める
  paras.push(
    agreement >= 70
      ? `${who}との見方の一致は${agreement}%です。自分らしさが、そのまま周りに伝わっています。今のあなたのままで、まわりはちゃんと受け取ってくれています。`
      : `${who}との見方の一致は${agreement}%です。自分では当たり前だと思っている一面が、周りには新鮮に映っていることもあります。まだ知られていない良さも、これから少しずつ伝わっていくはずです。`,
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
  key: BigFiveDimension;
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
        body: "「これ面白そう」と思ったら、その日のうちに{name}に送ってみてください。ワクワクの温度が同じふたりは、ノリの鮮度がいちばんのごちそうです。",
      },
      {
        title: "ハマりものは一緒に沼る",
        body: "どちらかがハマったものは、とりあえずふたりで試すのがおすすめです。同じ熱量で楽しめる相手は貴重です。",
      },
    ],
    off: [
      {
        title: "誘いの温度を合わせる",
        body: "新しい遊びに誘うときは、「気になってるんだけど、どう?」のひとことから。腰の軽さの違いは、聞き方ひとつでちょうどいい橋になります。",
      },
      {
        title: "行き先はふたつ用意",
        body: "定番の場所と新しい場所、両方の案を出して選んでもらってください。どちらに転んでも楽しいのが、このふたりです。",
      },
    ],
  },
  誠実性: {
    match: [
      {
        title: "段取りは交互に担当",
        body: "感覚が近いぶん、計画をどちらかに任せきりにしなくても回ります。「次はわたしが決めるね」の交代制が、いちばん長続きします。",
      },
      {
        title: "目標はふたりで宣言",
        body: "資格でもバイトでも、ふたりで宣言すると続きます。進め方の感覚が同じなので、いいペースメーカーになれます。",
      },
    ],
    off: [
      {
        title: "大事な予定は先に固める",
        body: "日時と集合場所を早めに確定させておいてください。段取り感覚のズレは、先に決めてしまうだけでほとんど消えます。",
      },
      {
        title: "遅刻は責めずにルール化",
        body: "時間感覚のズレは性格の違いです。「10分前集合ね」のようなゆるいルールにしておくと、お互い責めずにすみます。",
      },
    ],
  },
  外向性: {
    match: [
      {
        title: "休む日も一緒でいい",
        body: "盛り上がる日だけでなく、何もしない時間も共有できるふたりです。「今日はだらだらしよ」と言える関係を大事にしてください。",
      },
      {
        title: "予定ゼロの日をつくる",
        body: "あえて何も決めない日を一緒に過ごしてみてください。テンションが同じふたりは、無計画こそ楽しめます。",
      },
    ],
    off: [
      {
        title: "テンションの正直申告",
        body: "今日は静かに過ごしたいのか、騒ぎたいのか。先に言葉にするだけで、{name}との時間はもっと楽になります。",
      },
      {
        title: "短く濃く会う",
        body: "長時間より、短くて濃い時間のほうが、お互い心地よく過ごせます。解散時間を先に決めておくのも優しさです。",
      },
    ],
  },
  協調性: {
    match: [
      {
        title: "たまにワガママを見せ合う",
        body: "気づかい上手なふたりだからこそ、たまの「本当はこうしたい」が効きます。先に見せたほうが、関係はもっと近くなります。",
      },
      {
        title: "じゃんけんで決める勇気",
        body: "ふたりとも譲り合って決まらないときは、じゃんけんやコイントスで大丈夫です。決め方すら遊びにできる関係です。",
      },
    ],
    off: [
      {
        title: "してほしいことは言葉で",
        body: "察してもらうのを待つより、「これ手伝って」と口に出すほうが早く伝わります。{name}は、頼られるのを待っているはずです。",
      },
      {
        title: "お礼は大げさなくらいで",
        body: "やってもらったことには「ありがとう」を大きめに伝えてください。気づかいの見え方のズレは、感謝の言葉で埋まります。",
      },
    ],
  },
  神経症傾向: {
    match: [
      {
        title: "しんどい日は隣にいるだけ",
        body: "励まし合わなくても、一緒にいるだけで回復できるふたりです。「今日は聞くだけでいい?」が合言葉です。",
      },
      {
        title: "浮上したら打ち上げ",
        body: "ふたりとも元気な日に「復活祝い」をしてください。沈む日を知っている同士なので、楽しい日の価値も倍になります。",
      },
    ],
    off: [
      {
        title: "「大丈夫?」は答え合わせ",
        body: "平気そうに見えても、内側では気を張っているかもしれません。ときどき「ほんとに大丈夫?」と聞いてみてください。そのひとことが安全基地になります。",
      },
      {
        title: "返信の速さを気にしない",
        body: "返事が遅い日は、そっとしておく合図です。「既読スルーOK」をふたりのルールにすると、ずっと楽になります。",
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
        body: "「いいじゃん」が通じすぎて、予定もお金も気づけばパンパンになりがちです。ときどき、どちらかがブレーキ役を引き受けてください。",
      },
      {
        title: "飽きのシンクロ",
        body: "ふたり同時に熱が冷めると、連絡まで一緒に途切れがちです。ブームが去っても「元気?」だけは続けてください。",
      },
    ],
    off: [
      {
        title: "置いてけぼり招待",
        body: "片方のペースで誘い続けると、相手は断るのに疲れてしまいます。返事が鈍いときは「一回休み」の合図です。",
      },
      {
        title: "思い出の上書き合戦",
        body: "新しい話ばかりだと、片方は置いていかれた気分になります。たまには定番のお店で、いつもの話をする日も作ってください。",
      },
    ],
  },
  誠実性: {
    match: [
      {
        title: "「任せた」の空白",
        body: "ふたりとも「あの人がやるでしょ」と思った瞬間、誰も予約していない事件が起きます。担当だけは口に出して決めてください。",
      },
      {
        title: "予定の詰め込みすぎ",
        body: "きっちり者同士、予定表がびっしりになりがちです。余白のない計画は、どちらかが倒れたら全部崩れます。",
      },
    ],
    off: [
      {
        title: "小さなイラッの積み立て",
        body: "「なんで決めないの?」「なんで急かすの?」は、このふたりの定番のすれ違いです。性格の違いだと知っているだけで、半分は消えます。",
      },
      {
        title: "「言ったのに」の水掛け論",
        body: "口約束はズレのもとです。決まったことはトークに一行残しておくと、「言った言わない」が消えます。",
      },
    ],
  },
  外向性: {
    match: [
      {
        title: "休息不足の共倒れ",
        body: "盛り上がれるふたりほど、疲れに気づくのが遅れがちです。「今日は解散!」を言い出せるのも仲の証です。",
      },
      {
        title: "ふたりだけで完結",
        body: "居心地が良すぎて、ほかの友達との予定が後回しになりがちです。たまには別々の輪で過ごすと、話のネタも増えます。",
      },
    ],
    off: [
      {
        title: "テンションの置き去り",
        body: "片方だけ盛り上がる時間が続くと、もう片方は静かにすり減っていきます。ノリの温度確認を忘れないでください。",
      },
      {
        title: "無言=不機嫌の誤解",
        body: "静かな時間を「怒ってる?」と受け取るとすれ違います。無言でも大丈夫な関係だと、お互いに覚えておいてください。",
      },
    ],
  },
  協調性: {
    match: [
      {
        title: "遠慮の無限ループ",
        body: "「どこでもいいよ」「私も」で30分たつのが、このふたりです。譲り合いすぎたら、じゃんけんに切り替えてください。",
      },
      {
        title: "不満の在庫化",
        body: "優しいふたりほど、小さなモヤモヤを言わずに溜めがちです。在庫が増える前に、軽いうちに出してください。",
      },
    ],
    off: [
      {
        title: "気づかいの一方通行",
        body: "合わせてもらっている側がそれを当たり前にすると、関係は静かに傾きます。「いつもありがとう」を忘れないでください。",
      },
      {
        title: "「言わなくても分かる」の期待",
        body: "察する力には個人差があります。期待して待つより、言葉にしたほうがずっと早く伝わります。",
      },
    ],
  },
  神経症傾向: {
    match: [
      {
        title: "一緒に沈むスパイラル",
        body: "ふたりとも落ち込むと、浮上のきっかけを失いがちです。しんどい話は「30分だけ」と区切るのがコツです。",
      },
      {
        title: "不安の伝染",
        body: "片方の心配が、もう片方の不安に火をつけることがあります。深呼吸してから話すだけで、だいぶ違います。",
      },
    ],
    off: [
      {
        title: "「平気」の鵜呑み",
        body: "「大丈夫」をそのまま信じ続けると、限界まで気づけません。たまに疑ってみるのも優しさです。",
      },
      {
        title: "温度差へのイライラ",
        body: "「なんでそんなに気にするの?」「なんで平気なの?」は禁句です。感じ方の違いは、直すものではなく知っておくものです。",
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
      "「今度あそこ行かない?」と誰かが言い出したときのノリの良さが、ふたりはほぼ同じです。気になるカフェも、思いつきの小旅行も、「それ、いいじゃん」のひとことでトントン進んでいきます。",
    higher:
      "{name}と一緒のとき、あなたは自分で思うよりフットワークが軽くなっています。「ちょっと気になる」とつぶやいたお店に、気づけばふたりで並んでいる。そんな展開が多いはずです。",
    lower:
      "本当は気になっているイベントやお店を、あなたはまだ{name}に言えていないのかもしれません。「実はこれ行きたくて」と見せた瞬間、ふたりの週末は一気ににぎやかになります。",
  },
  誠実性: {
    match:
      "テスト前の計画も、旅行のしおりも、ふたりの「ちゃんとやる度」はほぼ同じです。集合時間の感覚まで似ているので、待ち合わせでイライラした記憶はほとんどないはずです。",
    higher:
      "課題や約束をきっちり守るあなたの姿を、{name}は横でちゃんと見ています。グループワークで「この人に任せれば大丈夫」と思われているのは、あなたのはずです。",
    lower:
      "あなたなりの段取りは、{name}には少し自由に見えています。旅行や大事な予定のときだけ「ここは決めておこう」と先に握っておくと、ふたりの時間はもっとスムーズになります。",
  },
  外向性: {
    match:
      "オールではしゃぐ日も、家でだらだら動画を見る日も、ふたりのテンションは自然にそろいます。「今日はどっちの気分?」と確認しなくていいのが、この関係のいちばん楽なところです。",
    higher:
      "{name}の前のあなたは、ふだん見せている顔よりずっとよく笑っているようです。疲れた日の帰り道、{name}と話しているうちに元気になっていた。そんな経験があるはずです。",
    lower:
      "{name}には、あなたが少し物静かに映っています。カラオケでもドライブでも、本気ではしゃぐあなたを見せたら、{name}はもっと喜ぶはずです。",
  },
  協調性: {
    match:
      "お店を決めるときも、割り勘のときも、どちらかが我慢することなく自然に折り合えます。「合わせすぎて疲れた」がないのは、気づかいの温度が同じだからです。",
    higher:
      "グラスが空いたら注ぐ、疲れていそうなら早めに切り上げる。あなたのさりげない気づかいを、{name}は全部ちゃんと受け取っています。今度は遠慮せず、頼る側にも回ってみてください。",
    lower:
      "あなたの気づかいは、{name}にはまだ半分しか届いていないかもしれません。「荷物持つよ」「大丈夫?」を言葉にした日から、{name}の中のあなたはもっとあったかい人になります。",
  },
  神経症傾向: {
    match:
      "落ち込んだ夜に長文を送っても引かれない安心感があります。励ましの言葉がなくても、通話をつないでおくだけで回復できます。しんどい日の過ごし方まで似ているふたりです。",
    higher:
      "「平気だよ」と笑った日の帰り際に「ほんとに?」と聞いてくるのが{name}です。あなたの強がりは、もう見抜かれているはずです。先に弱音を吐いてしまうほうが、このふたりはうまくいきます。",
    lower:
      "{name}の前では、あなたはいつも落ち着いて見えています。それだけ安心できる相手ということです。でも無理をしている日は、正直に言って大丈夫です。ちゃんと受け止めてくれるはずです。",
  },
};

// まとめ (2 段落)。1 段落目 = 一致度の総評、2 段落目 = その意味づけ。
function estimatedSummaryParas(percent: number, viewer: string): string[] {
  if (percent >= 85) {
    return [
      `回答を見るかぎり、${viewer}はあなたのことをかなり正確に見ています。分かってもらえている安心感があるので、素のままでいられる相性です。`,
      `「分かってくれている」のは、当たり前のことではありません。${viewer}の回答は、あなたが言葉にしていない部分までちゃんと見てくれている証拠です。この安心感は、ふたりの関係のいちばんの武器です。`,
    ];
  }
  if (percent >= 70) {
    return [
      `${viewer}の見ているあなたと、自分の思うあなたはだいたい重なっています。ときどき見え方のズレはありますが、それが会話のネタになるくらいのいい距離感です。`,
      `全部が一致していないのが、むしろちょうどいい関係です。分かり合えている土台があるので、ズレは「へえ、そう見えてたんだ」と楽しめます。話すたびに発見がある関係です。`,
    ];
  }
  if (percent >= 55) {
    return [
      `${viewer}から見えているあなたには、自分の認識と少し違う部分があります。そのズレこそ、お互いをもっと知る伸びしろです。`,
      `ギャップは悪いことではなく、${viewer}があなたの知らない一面を見つけてくれているということです。気になったところは本人に聞いてみると、思った以上に会話が盛り上がります。`,
    ];
  }
  return [
    `${viewer}とは見え方のギャップが大きめです。それは合わないというより、意外な自分を教えてくれる貴重な存在ということでもあります。`,
    `大きなギャップは、${viewer}の前で見せている顔と、自分で思う顔が違うということです。どちらも本物のあなたです。両方知っている人が増えるほど、あなたはもっと自由になれます。`,
  ];
}

const KO_AXIS_INSIGHT_COPY: Record<
  BigFiveDimension,
  { match: string; higher: string; lower: string }
> = {
  O: {
    match:
      "새로운 곳이나 재미있는 일을 발견했을 때 움직이는 속도가 두 사람은 꽤 비슷해요. ‘그거 좋다’는 한마디만으로도 계획이 자연스럽게 이어져요.",
    higher:
      "{name}과 함께 있을 때 당신은 스스로 생각하는 것보다 훨씬 적극적으로 새로운 일을 즐기는 모습이에요.",
    lower:
      "사실 궁금했던 장소나 해 보고 싶은 일을 아직 {name}에게 다 말하지 않았을지도 몰라요. 먼저 꺼내면 둘의 시간이 더 다채로워져요.",
  },
  C: {
    match:
      "약속과 계획을 대하는 감각이 비슷해서 함께 움직일 때 불필요한 스트레스가 적어요.",
    higher:
      "{name}은 약속을 지키고 해야 할 일을 끝까지 해내는 당신을 보며 ‘이 사람에게 맡기면 괜찮다’고 느끼고 있어요.",
    lower:
      "당신 나름의 계획은 {name}에게 조금 더 자유롭게 보이는 듯해요. 중요한 일정만 미리 맞추면 훨씬 편해져요.",
  },
  E: {
    match:
      "신나게 떠드는 날과 조용히 쉬는 날의 온도가 비슷해서 굳이 분위기를 설명하지 않아도 편안해요.",
    higher:
      "{name} 앞에서 당신은 평소보다 더 자주 웃고 활기차 보여요. 함께 이야기하는 것만으로 에너지가 채워지는 관계예요.",
    lower:
      "{name}에게 당신은 조금 차분하게 보이는 듯해요. 마음껏 즐기는 모습을 보여 주면 둘의 거리가 더 가까워져요.",
  },
  A: {
    match:
      "서로를 배려하는 온도가 비슷해서 한쪽만 참고 맞추는 일이 적어요. 자연스럽게 타협할 수 있는 관계예요.",
    higher:
      "상대가 피곤해 보이면 먼저 살피는 당신의 작은 배려를 {name}은 빠짐없이 느끼고 있어요.",
    lower:
      "당신의 배려가 {name}에게는 아직 전부 보이지 않았을 수 있어요. 마음을 말로 표현하면 훨씬 정확히 전해져요.",
  },
  N: {
    match:
      "힘든 날을 보내는 방식과 감정의 온도가 비슷해서 긴 설명 없이도 서로의 상태를 이해할 수 있어요.",
    higher:
      "괜찮다고 웃어도 다시 한번 물어봐 주는 사람이 {name}이에요. 당신의 섬세한 마음을 이미 알아보고 있어요.",
    lower:
      "{name} 앞에서 당신은 늘 차분하고 안정적으로 보여요. 힘든 날에는 솔직하게 말해도 충분히 받아 줄 관계예요.",
  },
};

const KO_KOTSU_COPY: Record<
  BigFiveDimension,
  { match: KotsuItem[]; off: KotsuItem[] }
> = {
  O: {
    match: [
      { title: "생각난 건 바로 공유하기", body: "재미있다고 느낀 순간 {name}에게 보내 보세요. 같은 온도의 호기심이 관계를 더 즐겁게 해요." },
      { title: "좋아하는 것 함께 파 보기", body: "한 사람이 빠진 것이 생기면 둘이 같이 경험해 보세요. 공통의 이야기가 자연스럽게 늘어나요." },
    ],
    off: [
      { title: "초대의 온도 맞추기", body: "새로운 일을 권할 때는 ‘나는 궁금한데 어때?’라고 먼저 물어보세요." },
      { title: "익숙한 곳과 새로운 곳을 함께 제안하기", body: "두 가지 선택지를 함께 내놓으면 속도가 달라도 둘 다 편하게 고를 수 있어요." },
    ],
  },
  C: {
    match: [
      { title: "계획은 번갈아 맡기", body: "‘다음에는 내가 정할게’라고 번갈아 맡으면 한쪽에 부담이 몰리지 않아요." },
      { title: "목표를 함께 선언하기", body: "하고 싶은 일을 서로에게 말해 두면 좋은 페이스메이커가 되어 줄 수 있어요." },
    ],
    off: [
      { title: "중요한 일정은 먼저 확정하기", body: "날짜와 장소를 일찍 정해 두면 계획 감각의 차이가 대부분 사라져요." },
      { title: "시간 약속은 규칙으로 만들기", body: "서로 탓하기보다 두 사람에게 맞는 느슨한 규칙을 정해 보세요." },
    ],
  },
  E: {
    match: [
      { title: "쉬는 날도 함께 보내기", body: "신나는 날뿐 아니라 아무것도 하지 않는 시간도 편하게 공유해 보세요." },
      { title: "아무 계획 없는 날 만들기", body: "분위기가 잘 맞는 두 사람은 계획하지 않은 시간도 충분히 즐거워요." },
    ],
    off: [
      { title: "오늘의 에너지 먼저 말하기", body: "조용히 있고 싶은지 신나게 놀고 싶은지 먼저 말하면 {name}과의 시간이 편해져요." },
      { title: "짧고 진하게 만나기", body: "긴 시간보다 짧고 밀도 있는 만남이 서로에게 더 잘 맞을 수 있어요." },
    ],
  },
  A: {
    match: [
      { title: "가끔은 원하는 것을 먼저 말하기", body: "배려를 잘하는 두 사람일수록 ‘사실 나는 이게 좋아’라는 말이 관계를 가까이 해요." },
      { title: "결정도 놀이처럼 하기", body: "서로 양보하다 정하기 어렵다면 가위바위보처럼 가볍게 결정해도 괜찮아요." },
    ],
    off: [
      { title: "원하는 것은 말로 부탁하기", body: "알아주길 기다리기보다 ‘이걸 도와줘’라고 말하면 {name}도 더 편해요." },
      { title: "고마움은 분명하게 표현하기", body: "작은 배려에도 고맙다고 말하면 서로 다른 표현 방식이 자연스럽게 연결돼요." },
    ],
  },
  N: {
    match: [
      { title: "힘든 날엔 곁에만 있어 주기", body: "해결하려 애쓰기보다 들어 주는 것만으로도 충분한 날이 있어요." },
      { title: "회복한 날 함께 축하하기", body: "서로 힘든 날을 아는 만큼 좋은 날의 기쁨도 크게 나눌 수 있어요." },
    ],
    off: [
      { title: "‘괜찮아?’를 한 번 더 묻기", body: "겉으로 멀쩡해 보여도 마음은 다를 수 있어요. 확인하는 한마디가 안심을 줘요." },
      { title: "답장 속도를 신경 쓰지 않기", body: "답이 늦은 날은 쉬고 있다는 신호로 받아들이면 관계가 훨씬 편해져요." },
    ],
  },
};

const KO_WANA_COPY: Record<
  BigFiveDimension,
  { match: KotsuItem[]; off: KotsuItem[] }
> = {
  O: {
    match: [
      { title: "신나는 계획의 과부하", body: "둘 다 좋다고 하다 보면 일정이 빽빽해지고 지출도 늘어날 수 있어요. 가끔은 한 사람이 브레이크를 맡아 주세요." },
      { title: "흥미가 동시에 식는 순간", body: "열기가 같이 식어도 ‘잘 지내?’라는 짧은 연락은 이어 가세요." },
    ],
    off: [
      { title: "한쪽 속도로 계속 초대하기", body: "반응이 느릴 때는 잠깐 쉬어 가라는 신호일 수 있어요." },
      { title: "새로운 것만 찾기", body: "가끔은 익숙한 장소에서 늘 하던 이야기를 나누는 날도 필요해요." },
    ],
  },
  C: {
    match: [
      { title: "서로 맡겼다고 생각하기", body: "둘 다 상대가 하겠지 생각하면 아무도 준비하지 않을 수 있어요. 담당은 말로 정해 주세요." },
      { title: "일정을 너무 꽉 채우기", body: "빈틈없는 계획은 한 사람이 지치면 함께 무너져요. 여유를 남겨 두세요." },
    ],
    off: [
      { title: "작은 짜증을 쌓아 두기", body: "재촉하는 쪽과 기다리는 쪽의 차이는 잘못이 아니라 성향의 차이예요." },
      { title: "말했는지 다투기", body: "중요한 약속은 메시지로 한 줄 남기면 불필요한 오해가 줄어요." },
    ],
  },
  E: {
    match: [
      { title: "함께 지칠 때까지 놀기", body: "즐거운 두 사람일수록 피로를 늦게 알아차려요. 먼저 쉬자고 말하는 것도 친밀함이에요." },
      { title: "두 사람 안에서만 끝내기", body: "가끔은 각자 다른 친구들과 시간을 보내면 다시 만났을 때 나눌 이야기도 늘어나요." },
    ],
    off: [
      { title: "서로 다른 텐션을 방치하기", body: "한쪽만 계속 신나 있으면 다른 쪽은 조용히 지칠 수 있어요." },
      { title: "침묵을 불만으로 오해하기", body: "말이 없다고 해서 화가 난 것은 아니라는 걸 서로 기억해 주세요." },
    ],
  },
  A: {
    match: [
      { title: "양보만 반복하기", body: "‘아무거나 좋아’만 반복되면 오히려 둘 다 피곤해져요. 한 번씩 먼저 골라 주세요." },
      { title: "작은 불만을 저장하기", body: "다정한 두 사람일수록 가벼울 때 솔직하게 말하는 연습이 필요해요." },
    ],
    off: [
      { title: "배려를 당연하게 여기기", body: "맞춰 주는 사람의 수고를 알아보고 고맙다는 말을 잊지 마세요." },
      { title: "말하지 않아도 알 거라 기대하기", body: "눈치의 방식은 사람마다 달라요. 기다리기보다 말하는 편이 정확해요." },
    ],
  },
  N: {
    match: [
      { title: "함께 가라앉기", body: "힘든 이야기는 시간을 정해 나누고, 그 뒤에는 가볍게 숨 돌릴 일을 만들어 보세요." },
      { title: "불안을 서로 키우기", body: "한 사람의 걱정이 다른 사람에게 번질 수 있어요. 잠깐 숨을 고른 뒤 이야기해요." },
    ],
    off: [
      { title: "‘괜찮아’를 그대로 믿기", body: "가끔은 한 번 더 확인하는 것이 상대를 위한 다정함이 될 수 있어요." },
      { title: "느끼는 온도를 탓하기", body: "감정의 차이는 고칠 문제가 아니라 서로 알아 두어야 할 차이예요." },
    ],
  },
};

// Korean callers use either a name ending in 님 or the unnamed fallback 친구.
function fillKoViewer(text: string, viewer: string): string {
  const endings: Record<string, string> =
    viewer === "친구" ? { 은: "는", 이: "가", 과: "와", 이에요: "예요" } : {};
  return text.replace(
    /\{name\}(이에요|은|이|과)?/g,
    (_match, ending: string = "") => `${viewer}${endings[ending] ?? ending}`,
  );
}

function koEstimatedSummaryParas(percent: number, viewer: string): string[] {
  const topic = fillKoViewer("{name}은", viewer);
  const subject = fillKoViewer("{name}이", viewer);
  const companion = fillKoViewer("{name}과", viewer);
  if (percent >= 85) {
    return [
      `답변을 보면 ${topic} 당신을 꽤 정확히 이해하고 있어요. 있는 그대로 있어도 편안한 관계예요.`,
      `말하지 않은 부분까지 알아봐 주는 건 당연한 일이 아니에요. 이 이해와 안심이 두 사람 관계의 가장 큰 힘이에요.`,
    ];
  }
  if (percent >= 70) {
    return [
      `${subject} 보는 당신과 스스로 생각하는 당신은 대체로 겹쳐요. 가끔 생기는 차이도 편하게 이야기할 수 있는 거리예요.`,
      `모든 것이 같지 않아서 오히려 좋아요. 서로를 이해하는 바탕 위에서 차이를 새로운 발견처럼 즐길 수 있어요.`,
    ];
  }
  if (percent >= 55) {
    return [
      `${viewer}에게 보이는 당신은 자기 인식과 조금 다른 부분이 있어요. 그 차이가 서로를 더 알아 갈 여지를 만들어요.`,
      `차이는 나쁜 것이 아니라 ${subject} 당신도 몰랐던 모습을 발견했다는 뜻이에요. 직접 물어보면 좋은 대화가 시작될 거예요.`,
    ];
  }
  return [
    `${companion}는 서로 보는 방식의 차이가 큰 편이에요. 맞지 않는다기보다 예상 밖의 나를 알려 주는 소중한 관계예요.`,
    `그 사람 앞에서 보이는 모습과 스스로 생각하는 모습은 둘 다 진짜 당신이에요. 두 모습을 함께 알수록 더 자유로워질 수 있어요.`,
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
  locale: AppResultLocale = "ja",
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
    const label = locale === "id" ? ID_AXIS_LABEL[g.key] : locale === "ko" ? KO_AXIS_LABEL[g.key] : WARM_AXIS_LABEL[g.key];
    const copySet =
      locale === "id"
        ? ID_AXIS_INSIGHT_COPY[g.key]
        : locale === "ko"
          ? KO_AXIS_INSIGHT_COPY[g.key]
          : AXIS_INSIGHT_COPY[WARM_AXIS_LABEL[g.key]];
    const state: EstimatedAxisInsight["state"] =
      g.diffPoints <= 10 ? "match" : g.diffPoints <= 25 ? "close" : "gap";
    const body =
      state === "match"
        ? copySet.match
        : g.otherPercent > g.selfPercent
          ? copySet.higher
          : copySet.lower;
    return {
      key: g.key,
      label,
      state,
      selfPercent: g.selfPercent,
      otherPercent: g.otherPercent,
      body: locale === "ko" ? fillKoViewer(body, viewer) : body.replaceAll("{name}", viewer),
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
  const [sumOpen, sumClose] =
    locale === "id"
      ? idEstimatedSummaryParas(percent, viewer)
      : locale === "ko"
        ? koEstimatedSummaryParas(percent, viewer)
        : estimatedSummaryParas(percent, viewer);
  const offScenes = offAxes.slice(0, 3).map((ax) => ax.body);
  const matchScenes = matched
    .slice(0, Math.max(0, MAX_SCENES - offScenes.length))
    .map((ax) => ax.body);
  const summaryParas: string[] = [sumOpen];
  const lowerIdInitial = (text: string) =>
    locale === "id" ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
  if (matchScenes.length > 0) {
    // 2 シーンずつ 1 段落に。段落頭だけ接続詞を変える (たとえば → それだけじゃなく)。
    const CHUNK_LEADS =
      locale === "id"
        ? ["Misalnya, ", "Tidak hanya itu, ", "Lebih lanjut, "]
        : locale === "ko"
          ? ["예를 들면, ", "그뿐만 아니라, ", "조금 더 말하면, "]
          : ["たとえば、", "それだけでなく、", "さらに言えば、"];
    for (let i = 0; i < matchScenes.length; i += 2) {
      const lead = CHUNK_LEADS[Math.min(i / 2, CHUNK_LEADS.length - 1)];
      summaryParas.push(
        lead +
          matchScenes
            .slice(i, i + 2)
            .map((scene, sceneIndex) =>
              sceneIndex === 0 ? lowerIdInitial(scene) : scene,
            )
            .join(locale === "ja" ? "" : " "),
      );
    }
  }
  if (offScenes.length > 0) {
    summaryParas.push(
      locale === "id"
        ? `Di sisi lain, ${offScenes.map(lowerIdInitial).join(" Selain itu, ")}`
        : locale === "ko"
          ? `한편, ${offScenes.join(" 그리고 ")}`
          : "いっぽうで、" + offScenes.join("それから、"),
    );
  }
  summaryParas.push(sumClose);

  // ===== 関係を深めるヒント (8つ) =====
  // ズレた軸 (差が大きい順) の off 版 2 個ずつを優先し、
  // 残りを一致軸 (差が小さい順) の match 版で埋める。
  const kotsu = [
    ...offAxes.flatMap((ax) =>
      locale === "id"
        ? ID_KOTSU_COPY[ax.key].off
        : locale === "ko"
          ? KO_KOTSU_COPY[ax.key].off
          : KOTSU_COPY[ax.label].off,
    ),
    ...matched.flatMap((ax) =>
      locale === "id"
        ? ID_KOTSU_COPY[ax.key].match
        : locale === "ko"
          ? KO_KOTSU_COPY[ax.key].match
          : KOTSU_COPY[ax.label].match,
    ),
  ]
    .slice(0, 8)
    .map((k) => ({
      title: k.title,
      body: locale === "ko" ? fillKoViewer(k.body, viewer) : k.body.replaceAll("{name}", viewer),
    }));

  // ===== 関係を壊すワナ (8つ) =====
  // ズレた軸 (差が大きい順) の off 版 2 個ずつを優先し、残りを一致軸の match 版で埋める。
  const wana = [
    ...offAxes.flatMap((ax) =>
      locale === "id"
        ? ID_WANA_COPY[ax.key].off
        : locale === "ko"
          ? KO_WANA_COPY[ax.key].off
          : WANA_COPY[ax.label].off,
    ),
    ...matched.flatMap((ax) =>
      locale === "id"
        ? ID_WANA_COPY[ax.key].match
        : locale === "ko"
          ? KO_WANA_COPY[ax.key].match
          : WANA_COPY[ax.label].match,
    ),
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
