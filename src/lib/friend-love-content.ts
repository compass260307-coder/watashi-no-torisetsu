// 「友達から見た恋愛傾向 / あなたのモテポイントは実はここ」セクションのデータとロジック。
// 友達平均スコア (他者が付けた OCEAN) からモテ寄与度を出し、主/隠れのモテポイントを決定的に選ぶ。

import type { BigFiveDimension } from "./types";

export type MotePoint = {
  /** 軸ラベル (見出し用の短いキーワード)。 */
  keyword: string;
  /** 「あなたのモテポイントは実はここ」の主見出し (1行)。 */
  headline: string;
  /** 本文 (友達視点でモテる理由を掘り下げる)。 */
  body: string;
};

// 各軸が「モテ寄与度トップ」だったときの文言。E/A/O/C は高いとき、N は低いとき (安定) に出る。
const MOTE_BY_AXIS: Record<BigFiveDimension, MotePoint> = {
  E: {
    keyword: "一緒にいて楽しい",
    headline: "あなたのモテポイントは、その場を明るくする空気感。",
    body: "友達から見たあなたは、いるだけで場がぱっと華やぐ人。会話を回すのも、誰かの一言を拾って盛り上げるのも自然にできてしまう。本人は「ただ楽しんでるだけ」のつもりでも、周りは『この人といると退屈しない』と感じています。デートでも遊びでも、あなたと過ごす時間はいつも記憶に残る——それが、いちばんのモテポイントです。",
  },
  A: {
    keyword: "安心して隣にいられる",
    headline: "あなたのモテポイントは、そばにいてホッとする安心感。",
    body: "友達から見たあなたは、相手の気持ちにちゃんと気づいて、さりげなく寄り添える人。無理に盛り上げなくても、隣にいるだけで空気がやわらかくなる。この『一緒にいて疲れない』感覚は、実は恋愛でいちばん長続きする魅力です。本人は当たり前にやっているぶん気づいていないけれど、周りは『こういう人と付き合ったら幸せだろうな』とちゃんと見ています。",
  },
  O: {
    keyword: "一緒にいると世界が広がる",
    headline: "あなたのモテポイントは、話していて飽きない好奇心。",
    body: "友達から見たあなたは、知らないことや面白いものをたくさん持っている人。あなたと話すと『そんな見方があるんだ』と世界がひとつ広がる。同じ景色でも、あなたと見ると違って見える——その刺激が、相手をどんどん惹きつけます。本人は「好きなことを話してるだけ」でも、周りにとってあなたは『一緒にいると毎日が新しくなる人』なんです。",
  },
  C: {
    keyword: "ちゃんとしてて頼れる",
    headline: "あなたのモテポイントは、言葉より行動で示す誠実さ。",
    body: "友達から見たあなたは、約束を守る・任されたことをやり遂げる、その一つひとつが信頼になっている人。派手なアピールはしないけれど、『この人は言ったことを必ずやる』という安心感は、どんな甘い言葉より強い。本人は当たり前のつもりでも、周りは『こういう人こそ、いざという時に頼れる』とちゃんと見抜いています。それが、じわじわ効くモテポイントです。",
  },
  N: {
    keyword: "どんな時も動じない余裕",
    headline: "あなたのモテポイントは、隣にいて安心できる落ち着き。",
    body: "友達から見たあなたは、ちょっとしたことでは動じない、腰の据わった人。周りが慌てている時ほど、あなたの落ち着きが場を安定させる。この『一緒にいて振り回されない』余裕は、付き合うほどにありがたみが分かる魅力です。本人は自然体でいるだけでも、周りは『この人といると安心する』と、その包容力をちゃんと感じています。",
  },
};

export type FriendLoveContent = {
  /** 主モテポイント (寄与度トップの軸)。 */
  main: MotePoint;
  /** 隠れモテポイント (寄与度2番目の軸)。main と別軸。 */
  hidden: MotePoint;
};

/**
 * 友達平均スコアからモテポイントを決定的に選ぶ。数値のある軸だけを対象にする。
 * スコアが2軸未満なら null (セクション非表示)。
 */
export function resolveFriendLove(
  friendAvgScores: Partial<Record<BigFiveDimension, number>>,
): FriendLoveContent | null {
  const AXES: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  // モテ寄与度: E/A/O/C はそのまま、N は反転 (低いほど安定=モテ)。
  const contrib = AXES.map((ax) => {
    const v = friendAvgScores[ax];
    if (typeof v !== "number") return null;
    return { ax, score: ax === "N" ? 10 - v : v };
  }).filter((x): x is { ax: BigFiveDimension; score: number } => x !== null);

  if (contrib.length < 2) return null;

  contrib.sort((a, b) => b.score - a.score);
  return {
    main: MOTE_BY_AXIS[contrib[0].ax],
    hidden: MOTE_BY_AXIS[contrib[1].ax],
  };
}


// =====================================================================
// チェックリスト版モテポイント (2026-07-20 リッチ化)。
// 5軸それぞれの「モテ理由」を短いタイトル+一言で出す。
// high/low は友達がつけたスコア (0-10) の 5 を境に選ぶ (どちらも魅力として書く)。
// =====================================================================

export type MoteCheckItem = { title: string; body: string };

const MOTE_CHECK_BY_AXIS: Record<
  BigFiveDimension,
  { high: MoteCheckItem; low: MoteCheckItem }
> = {
  E: {
    high: {
      title: "場を明るくする太陽感",
      body: "いるだけで空気が華やぐ人。あなたと過ごす時間は記憶に残る、と思われてるよ。",
    },
    low: {
      title: "ふたりの時間が濃くなる",
      body: "大人数より一対一で光るタイプ。静かに深く向き合える時間が、特別なものになってるよ。",
    },
  },
  A: {
    high: {
      title: "気づかいの名人",
      body: "さりげないフォローに、周りはちゃんと気づいてる。「優しい人」の代名詞になってるかも。",
    },
    low: {
      title: "ブレない自分軸",
      body: "流されない意見の強さが、頼りがいとして映ってる。芯のある人は、それだけでモテるよ。",
    },
  },
  O: {
    high: {
      title: "世界が広がる面白さ",
      body: "新しい遊びも話題も次々見つけてくる。あなたといると退屈しない、と思われてるよ。",
    },
    low: {
      title: "安定感のある居心地",
      body: "流行に振り回されない落ち着きが、「一緒にいて安心する」魅力になってるよ。",
    },
  },
  C: {
    high: {
      title: "約束を守る誠実さ",
      body: "言ったことをちゃんとやる姿に、「この人は信じられる」と株が上がってるよ。",
    },
    low: {
      title: "肩の力が抜けた自由さ",
      body: "きっちりしすぎない自然体が、「一緒にいて楽な人」という魅力になってるよ。",
    },
  },
  N: {
    high: {
      title: "繊細な感受性",
      body: "小さな変化に気づける細やかさが、「わかってくれる人」という安心になってるよ。",
    },
    low: {
      title: "動じない包容力",
      body: "何があっても慌てない落ち着きが、「この人といると安心」という魅力になってるよ。",
    },
  },
};

// 6項目目用の追加モテ項目 (寄与度トップの軸をもう一押しする別コピー)。
const MOTE_CHECK_EXTRA_BY_AXIS: Record<
  BigFiveDimension,
  { high: MoteCheckItem; low: MoteCheckItem }
> = {
  E: {
    high: {
      title: "ノリのいい返事",
      body: "誘いへの「いいね、行く!」の即答が、誘った側の勇気を報われた気持ちにさせてるよ。",
    },
    low: {
      title: "聞き上手の相槌",
      body: "静かにちゃんと聞いてくれる姿勢が、「もっと話したい」を引き出してるよ。",
    },
  },
  A: {
    high: {
      title: "裏表のない公平さ",
      body: "誰にでも同じ温度で接する姿が、「裏表がない人」という信頼になってるよ。",
    },
    low: {
      title: "はっきりした好み",
      body: "好き嫌いを隠さない正直さが、むしろ「分かりやすくて楽」と好かれてるよ。",
    },
  },
  O: {
    high: {
      title: "話題の引き出しの多さ",
      body: "会話が途切れないネタの豊富さが、「また話したい」につながってるよ。",
    },
    low: {
      title: "変わらない定番の安心",
      body: "いつもの場所といつもの話を大事にする姿勢が、「長く付き合える人」という印象になってるよ。",
    },
  },
  C: {
    high: {
      title: "返信と時間のきちんと感",
      body: "連絡や待ち合わせの誠実さが、「大事にされてる」と感じさせてるよ。",
    },
    low: {
      title: "ゆるさがくれる気楽さ",
      body: "予定に縛られないゆるさが、「気を張らなくていい人」という魅力になってるよ。",
    },
  },
  N: {
    high: {
      title: "気持ちに寄り添う言葉",
      body: "しんどい時にかけてくれる言葉の的確さは、繊細なあなたにしか出せないよ。",
    },
    low: {
      title: "いつでも同じテンション",
      body: "会うたびに安定した空気感が、「ホーム」みたいな存在感になってるよ。",
    },
  },
};

/**
 * チェックリスト版モテポイント: 5軸 (モテ寄与度の高い順) + トップ軸の追加項目 = 6 項目。
 */
export function resolveFriendLoveChecklist(
  friendScores: Partial<Record<BigFiveDimension, number>>,
): MoteCheckItem[] {
  const AXES: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const contrib = AXES.map((ax) => {
    const v = friendScores[ax];
    if (typeof v !== "number") return null;
    return { ax, v, score: ax === "N" ? 10 - v : v };
  }).filter((x): x is { ax: BigFiveDimension; v: number; score: number } => x !== null);
  if (contrib.length < 2) return [];

  contrib.sort((a, b) => b.score - a.score);
  const items = contrib.map(({ ax, v }) =>
    v >= 5 ? MOTE_CHECK_BY_AXIS[ax].high : MOTE_CHECK_BY_AXIS[ax].low,
  );
  // 6項目目: 寄与度トップの軸をもう一押しする追加コピー
  const top = contrib[0];
  items.push(
    top.v >= 5
      ? MOTE_CHECK_EXTRA_BY_AXIS[top.ax].high
      : MOTE_CHECK_EXTRA_BY_AXIS[top.ax].low,
  );
  return items;
}

// =====================================================================
// 「モテるための◯◯さんからのヒント」(2026-07-20 追加)。
// 友達の回答でモテ寄与度が低かった軸 = 「まだ見せられていない一面」への
// 軽いアドバイスを 2 つ選び、導入・締めを付けて読み物にする。
// =====================================================================

const MOTE_HINT_CHECKS_BY_AXIS: Record<BigFiveDimension, MoteCheckItem[]> = {
  E: [
    {
      title: "はしゃぐ一面を解禁",
      body: "今度の集まりでは、ちょっとだけはしゃいでみて。ふだん落ち着いて見えるぶん、振り幅は想像以上に効くよ。",
    },
    {
      title: "自分から誘ってみる",
      body: "「今度これ行かない?」のひとことを自分から。受け身じゃない一面は新鮮に映るよ。",
    },
  ],
  A: [
    {
      title: "優しさは言葉にする",
      body: "「大丈夫?」「手伝おうか?」をひとこと多めに。優しさは言葉になった瞬間から伝わり始めるよ。",
    },
    {
      title: "小さなお礼を忘れずに",
      body: "してもらったことへの「ありがとう」をていねいに。気づかいの往復が距離を縮めるよ。",
    },
  ],
  O: [
    {
      title: "「気になる」を口に出す",
      body: "行きたいお店や遊びを自分から提案してみて。「意外とアクティブ」のギャップは強力だよ。",
    },
    {
      title: "新しい一面を仕入れる",
      body: "小さな挑戦をひとつ始めてみよう。その話題だけで、印象はぐっと立体的になるよ。",
    },
  ],
  C: [
    {
      title: "小さな約束こそきっちり",
      body: "待ち合わせや返信の「ちゃんと感」を見せてみて。それだけで印象は一段変わるよ。",
    },
    {
      title: "有言実行をチラ見せ",
      body: "「やる」と言ったことを黙って達成してみせる。さりげない実行力は、じわじわ効くよ。",
    },
  ],
  N: [
    {
      title: "弱音は素直に出す",
      body: "元気がない日は「今日ちょっと元気ない」と言っちゃおう。素直さは繊細さを魅力に変えるよ。",
    },
    {
      title: "いつも通りの日を増やす",
      body: "安定したテンションで接する日を増やしてみて。安心感は最強のモテ要素だよ。",
    },
  ],
};

/**
 * 「モテるための◯◯さんからのヒント」: モテ寄与度が低い軸 (=まだ見せられていない一面)
 * 3 つ × 2 項目 = 6 項目のチェックリストで返す。
 */
export function resolveMoteHints(
  friendScores: Partial<Record<BigFiveDimension, number>>,
): MoteCheckItem[] {
  const AXES: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const contrib = AXES.map((ax) => {
    const v = friendScores[ax];
    if (typeof v !== "number") return null;
    return { ax, score: ax === "N" ? 10 - v : v };
  }).filter((x): x is { ax: BigFiveDimension; score: number } => x !== null);
  if (contrib.length < 2) return [];

  contrib.sort((a, b) => a.score - b.score); // 寄与度が低い順
  return contrib.slice(0, 3).flatMap(({ ax }) => MOTE_HINT_CHECKS_BY_AXIS[ax]);
}


// =====================================================================
// 恋愛の具体的シチュエーション (2026-07-20 追加)。
// 友達がつけたスコアのモテ寄与度トップ2軸から、デート・恋愛の
// 「あるあるシーン」を 1 段落で返す (本文の抽象さを補う具体描写)。
// =====================================================================

const LOVE_SCENE_BY_AXIS: Record<BigFiveDimension, { high: string; low: string }> = {
  E: {
    high: "合コンでも飲み会でも、気づけばあなたの周りに笑いが起きてる。帰り道に「今日楽しかったね」と言われるのは、だいたいあなたのおかげだよ。",
    low: "大人数の飲み会より、ふたりでカフェにいるときのあなたがいちばんいい顔をしてる。ぽつぽつ話す時間の心地よさで、気づけば相手が沼っているパターンだよ。",
  },
  A: {
    high: "サラダを取り分けるとか、相手の終電をさりげなく気にするとか。デート中の小さな気配りが、「次も誘いたい」の決め手になってるよ。",
    low: "行きたいお店も観たい映画もはっきり言えるから、デートがサクサク決まる。「どこでもいいよ」と言わないところ、実はかなり好かれてるよ。",
  },
  O: {
    high: "「ここ行ってみない?」と出してくるお店がいつもツボ。あなたと行くデートは外れがない、と思われてるよ。",
    low: "いつものお店、いつもの道、いつもの話。あなたとの定番デートの安心感が、「この関係、落ち着く」につながってるよ。",
  },
  C: {
    high: "約束の10分前には着いているタイプ。記念日や小さな約束を覚えているまめさが、じわじわ効いてるよ。",
    low: "予定を決めすぎない気ままなデートができる人。「なんとなく集合して、なんとなく解散」が心地いい相手は、実は貴重だよ。",
  },
  N: {
    high: "LINEの文面がいつもとちょっと違うだけで「何かあった?」と気づける。その察知力に救われた人、絶対にいるよ。",
    low: "ドタキャンや小さなトラブルがあっても「まあいっか」と笑っていられる。デート中に何が起きても、楽しい方に変えられる人だよ。",
  },
};

/** モテ寄与度トップ2軸のシーンを 1 段落にまとめて返す。計算不能なら null。 */
export function resolveLoveScene(
  friendScores: Partial<Record<BigFiveDimension, number>>,
): string | null {
  const AXES: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const contrib = AXES.map((ax) => {
    const v = friendScores[ax];
    if (typeof v !== "number") return null;
    return { ax, v, score: ax === "N" ? 10 - v : v };
  }).filter((x): x is { ax: BigFiveDimension; v: number; score: number } => x !== null);
  if (contrib.length < 2) return null;

  contrib.sort((a, b) => b.score - a.score);
  const pick = (i: number) => {
    const { ax, v } = contrib[i];
    return v >= 5 ? LOVE_SCENE_BY_AXIS[ax].high : LOVE_SCENE_BY_AXIS[ax].low;
  };
  return `たとえば、${pick(0)}${pick(1)}`;
}
