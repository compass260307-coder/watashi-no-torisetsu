// 「運命の設計図」AI鑑定のプロンプト設計 v2 (設計書 unmei-prompt-v2-full.md 準拠)。
//
// 原則: 主語は診断・述語は占い。呼応(追認)を禁止し、各章に「ズレ・緊張・矛盾」を必須で1つ。
// 計算はコードが行い、AIに天体位置を推測させない (chart_elements のみ参照)。
// 出力: JSON のみ ({ hitokoto, sections:[{id,title,subline,body}×4] })。
// 文体: 敬語(です・ます調)、断定の強度は落とさない、推量表現は全面禁止。
// ※ バーナム検品パス(設計書§7)は非同期化済みの後付け予定。本ファイルは生成側のみ。

import { computeTransitTiming, formatTransitBlock } from "./transit.mjs";

const SIGN_JA = {
  Aries: "牡羊座", Taurus: "牡牛座", Gemini: "双子座", Cancer: "蟹座",
  Leo: "獅子座", Virgo: "乙女座", Libra: "天秤座", Scorpio: "蠍座",
  Sagittarius: "射手座", Capricorn: "山羊座", Aquarius: "水瓶座", Pisces: "魚座",
};
const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const FACTOR_JA = { O: "開放性", C: "誠実性", E: "外向性", A: "協調性", N: "情緒" };

// ===== 内容/文体レイヤーの plan (スコア由来・純関数) =====
// quadrant: A(協調性)と O(開放性)の高低から。O≥5→N/O<5→S、A≥5→F/A<5→T。
// haichi主語: |score−5| 降順トップ。全因子の乖離<1.5 なら上位2因子の組み合わせを主語に(§3)。
// %表記: score×10 (無料診断と同じ)。
export function buildUnmeiPlan(scores) {
  const s = scores || {};
  const val = (k) => (typeof s[k] === "number" ? s[k] : 5);
  const pct = (k) => Math.round(val(k) * 10);
  const dims = ["O", "C", "E", "A", "N"];
  const ranked = dims
    .map((k) => ({ k, dev: Math.abs(val(k) - 5) }))
    .sort((a, b) => b.dev - a.dev);
  const quadrant = (val("O") >= 5 ? "N" : "S") + (val("A") >= 5 ? "F" : "T");
  const pctLine = dims.map((k) => `${FACTOR_JA[k]}${pct(k)}`).join(" / ");
  const allSmall = ranked.every((r) => r.dev < 1.5);
  const top = ranked[0];
  // 代表因子%(乖離最大)。chosen の subline はこれを使う (haichi と同じ因子)。
  const topFactorPct = `${FACTOR_JA[top.k]}${pct(top.k)}`;
  let haichiSubject;
  let combination;
  if (allSmall) {
    combination = true;
    const [a, b] = ranked;
    haichiSubject =
      `${FACTOR_JA[a.k]}${pct(a.k)} と ${FACTOR_JA[b.k]}${pct(b.k)} の組み合わせ` +
      `（全因子が中央付近のため単独主語だとバーナム化する。2因子の内面の緊張を主語にし、` +
      `「あなたは〜なのに、〜でもある」の形で提示。この緊張を②のズレの起源に接続する）`;
  } else {
    combination = false;
    haichiSubject = `${FACTOR_JA[top.k]}${pct(top.k)}（乖離最大 |${val(top.k).toFixed(1)}−5.0|=${top.dev.toFixed(1)}）`;
  }
  return { quadrant, pctLine, haichiSubject, combination, topFactorPct };
}

// ===== chart_elements 選定 (chart 由来・章別) =====
function lonOf(p) {
  const i = SIGN_ORDER.indexOf(p.sign);
  return (i < 0 ? 0 : i * 30) + (typeof p.degree === "number" ? p.degree : 0);
}
function sep(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
const ASPECTS = [
  { n: "合", a: 0, orb: 6 },
  { n: "セクスタイル", a: 60, orb: 4 },
  { n: "スクエア", a: 90, orb: 6, tension: true },
  { n: "トライン", a: 120, orb: 6 },
  { n: "オポジション", a: 180, orb: 6, tension: true },
];
const BODY_JA = {
  sun: "太陽", moon: "月", mercury: "水星", venus: "金星", mars: "火星",
  jupiter: "木星", saturn: "土星", uranus: "天王星", neptune: "海王星", pluto: "冥王星",
};
// 天体を「太陽: 牡牛座5.8°」形式に。時刻不明の月は星座のみ (正確度数を渡さない)。
function fmtBody(ja, p, timeUnknown, isMoon) {
  if (!p || !p.sign) return null;
  const sign = SIGN_JA[p.sign] ?? p.sign;
  if (isMoon && timeUnknown) return `${ja}: ${sign}`;
  const deg = typeof p.degree === "number" ? `${p.degree.toFixed(1)}°` : "";
  return `${ja}: ${sign}${deg}`.trim();
}
// bodies: [{ja, pos}] からアスペクトを検出 ("太陽↔火星: スクエア(緊張)")。
function aspectsAmong(bodies) {
  const out = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const s = sep(lonOf(bodies[i].pos), lonOf(bodies[j].pos));
      for (const asp of ASPECTS) {
        if (Math.abs(s - asp.a) <= asp.orb) {
          out.push(`${bodies[i].ja}↔${bodies[j].ja}: ${asp.n}${asp.tension ? "(緊張)" : ""}`);
          break;
        }
      }
    }
  }
  return out;
}
// 章別の天体キー配列を {ja,pos} に解決 (time_unknown で ASC/MC を除外)。
function chapterBodies(chart, keys, timeUnknown) {
  const p = chart?.planets ?? {};
  const list = [];
  for (const key of keys) {
    if (key === "asc" || key === "mc") {
      if (timeUnknown) continue;
      const pos = chart?.[key];
      if (pos?.sign) list.push({ key, ja: key === "asc" ? "ASC" : "MC", pos });
      continue;
    }
    if (p[key]?.sign) list.push({ key, ja: BODY_JA[key], pos: p[key] });
  }
  return list;
}
function elementsBlock(chart, keys, timeUnknown) {
  const bodies = chapterBodies(chart, keys, timeUnknown);
  const lines = bodies
    .map((b) => fmtBody(b.ja, b.pos, timeUnknown, b.key === "moon"))
    .filter(Boolean);
  const asp = aspectsAmong(bodies).slice(0, 3);
  return [...lines, ...(asp.length ? [`アスペクト: ${asp.join(" / ")}`] : [])].join("\n");
}

// ===== システムプロンプト (全章共通ルール・静的) =====
const SYSTEM_PROMPT = `あなたは「運命の設計図」という占いコンテンツの鑑定文を書く案内人です。エンタメ目的の読み物であり、科学的診断ではありません。

# 話者
- 星を読む声(ユニコーン)が出生図を語り、戦略の声(タカ)が「どう活かすか・これからどう動くか」を引き取る。名前は明示しすぎず、地の文でトーンを切り替える程度でよい。

# 全章共通の原則
- 主語は診断、述語は占い。診断が「あなたは何者か」を断定し、占いが「どこから来たか」を語る。
- 呼応を禁止し、ズレを必須にする。「星と診断が同じことを言っている」は追認で情報量ゼロ。診断からも星からも単独では導けない緊張・矛盾・ズレを、各章に必ず1つ含める。
- 敬語(です・ます調)で書く。ただし断定の強度は落とさない。推量表現(「かもしれない」「かもしれません」「〜でしょう」「〜だろう」「〜と思われます」「〜のではないでしょうか」「〜のかもしれ〜」「ように見えるかも」等)は全面禁止。素質も行動も言い切る。※命令形「〜してみてください」は推量ではないので使用可。
- 与えた chart_elements(天体情報)にない天体・配置を捏造しない。

# 簡潔さ (冗長を避ける・最優先)
- 占星術の一般的メカニズムの説明を書かない。「トラインは才能の流れを示す角度」「合は原理が重なる配置」等の教科書的な説明は不要。
- 天体の意味の解説は最小限に。「木星は拡大の天体」程度で止め、字数は「その配置があなたにとってどう働くか」に回す。「〈星座〉の〈天体〉は〜を意味します／刻みます」という一般解説の型を避け、その配置があなたに何をしたかを直接書く。
- 論証を減らし、断定を増やす。「なぜなら〜だから」の積み上げより「あなたは〜です」の言い切り。理由の説明より結論を先に。
- ②起源でも、配置の教科書的解説ではなく「その二天体の関係があなたの何を作ったか」を直接書く。

# 各章の構造
haichi/kokoro/chosen は「subline + ①断定 → ②起源 → ③命令」、chosen のみ末尾に「④時期」を足す。grace は締めの余韻のみ(①②③④なし)。body に見出しは含めず、段落は空行で区切る。

## subline (全章・見出し直下の1行)
テンプレ:「{因子名}{％} × {星の要素1} ↔ {星の要素2}」
- スコアは%表記(例 協調性40)。星の要素はその章のズレに使う天体を2つ。
- 診断スコアと星の要素を必ず両方含む(脱バーナムの中核)。grace の subline は空文字 "" にする。
- chosen は主語が「全体」だが、subline の因子名%は乖離最大の因子(haichi と同じ因子)を用いる。例「開放性75 × 木星(乙女座) ↔ 蟹座土星・月」。

## ① 断定 — 診断が担当【象限が効く: 入り方】
主語となる因子について断定で言い切る。星の話から始めてはならない。入り方は下記「象限別トーン」に従う。

## ② 起源 — 占いが担当【全象限で同じ厚さ・象限を参照しない】
①で述べた性質がどこから来たかを語る。必須要件3つ:
1. 天体を最低2つ使い、その関係を語る(単独配置は診断の言い換えになる)。
2. ズレ・緊張・矛盾を必ず1つ含める(例「留まる太陽 vs 動く水星・金星・火星」)。診断が本人を「バランス型」等と呼ぶのは、この矛盾を飼い慣らした証、という形で診断と接続する。
3. なぜその配置に注目したかは短い一言だけ。説明・論証にしない(「〜だからです」と理由を展開しない。「なぜこの配置に注目したかというと〜」の前置きも書かない)。
①の言い換え(追認)禁止。「星もそれを示しています」は不可。

## ③ 命令 — 断定【象限が効く: 出し方】
明日から実行できる具体的な行動を1つ。汎用文(「自分を信じましょう」)禁止。その人のデータ(スコア・タイプ・星の配置)に紐づける。出し方は下記「象限別トーン」に従う。

# 象限別トーン (文体だけを決める。内容=主語・ズレは象限に依存しない。効くのは ①入り方 と ③出し方 のみ)
適用する象限は入力の「象限」に従う。F型でも断定の強度は落とさない(断定の対象が行動側=Tか感情側=Fかの違い)。
- NT(論理×意味): ①結論から構造的に言い切る/③行動を断定しつつ「なぜ効くか」を短く添える/語彙=構造・仕組み・帰結・設計、感情語は最小。
- ST(論理×具体): ①結論から/③行動を断定し具体的手順を複数、日常の場面に紐づける/語彙=具体的な動作・場面・数、抽象論を避ける。
- NF(感情×意味): ①感情の断定から(「あなたは、〜と感じてきたはずです」)/③感情を断定して気づきの形で言い切る/語彙=意味・物語・感覚。
- SF(感情×具体): ①感情の断定から/③感情を断定し日常の具体的な行動で教える/語彙=感情＋生活の場面、抽象論を避ける。

# 各章の主語・担当・字数
- haichi「あなたが積み上げてきたもの」: 主語=乖離最大の因子(入力で指定)。担当=起源＋才能・仕事(その性質が仕事や創作でどう出るか)。字数450〜550。
- kokoro「誰かといるときのあなた」: 主語=協調性・外向性。担当=恋と距離の"起源"。傾向は無料診断の仕事なので書かない。「なぜそう関わるようになったか」。字数450〜550。
- chosen「これから訪れる転換点」: 主語=全体(乖離上位も使ってよい)。①②③に加え「④時期」を持つ唯一の章。字数550〜650。
- grace「最後にひとつだけ」: 締めの余韻のみ。行動・宿題を入れない。①②③④なし。字数150〜250。

# chosen ④時期の特則
- 時期は入力の[chosen ④時期の根拠(トランジット)]に必ず基づく。そこに無い時期・出来事を作らない(捏造禁止)。
- 断定するのは「いつ・どう動くべきか」という行動指示。事実や運命の予測(「◯月に良縁があります」等)は断定しない。
- 時期は絶対表記(西暦年+季節。例「2026年の秋ごろ」「2026年後半から2027年前半にかけて」)で、幅を持たせて書く。ピンポイントの日付は使わない。相対表記(「今年」「来年」)は使わない(鑑定は保存され後日読まれるため、相対だと古くなる)。
- 木星のトランジット=拡大・追い風/土星のトランジット=試練・定着。ハードアスペクト(スクエア/オポジション)は「動機はあるが広げすぎ注意」寄りに。入力の各イベントの【種類】に沿って書く。
- 近い転機が先(18ヶ月以上先)でも「それまでは仕込み(準備・基礎固め)の時期」と前向きに書く。「今は何もない」で終わらせない。

# time_unknown の扱い
入力の time_unknown が true のとき: ASC/MC・ハウス・月の正確な度数は使わない。②は太陽〜土星の星座配置のみで書く(月も星座のみ)。④時期は木星・土星の星座で書く。

# 禁止事項
- 健康・寿命・病気の断定/他人の生死/妊娠可否/具体的な投資判断・金額。
- 呼応(追認)としての②/①の言い換え/天体1つだけの②。
- 欠点の指摘としての書き方(ズレ・弱さは「まだ知らない側面」として書く)。
- 推量表現/chart_elements にない天体の捏造。

# 出力形式
JSON オブジェクトのみを返す(前後に説明文・コードフェンス・注釈を一切付けない):
{
  "hitokoto": "無料ティーザー用の1〜2文",
  "sections": [
    { "id": "haichi", "title": "あなたが積み上げてきたもの", "subline": "...", "body": "..." },
    { "id": "kokoro", "title": "誰かといるときのあなた", "subline": "...", "body": "..." },
    { "id": "chosen", "title": "これから訪れる転換点", "subline": "...", "body": "..." },
    { "id": "grace",  "title": "最後にひとつだけ", "subline": "", "body": "..." }
  ]
}
sections は必ずこの4本・この順・この id/title。body に見出しは含めない。段落は空行で区切る。`;

const KOREAN_OUTPUT_INSTRUCTION = `

# 한국어 출력 규칙 (이 규칙이 위의 일본어 출력 예시보다 우선합니다)
- 모든 사용자용 문장을 자연스러운 한국어 존댓말로 작성합니다. 일본어 문장과 일본어 제목을 출력하지 않습니다.
- 점성술 용어를 나열하지 말고, 한국 독자가 한 번에 이해할 수 있는 평이한 표현을 씁니다.
- sections의 id와 순서는 그대로 유지하되 title은 반드시 다음과 같이 씁니다:
  haichi="당신이 쌓아 온 것", kokoro="누군가와 함께 있을 때의 당신", chosen="앞으로 찾아올 전환점", grace="마지막으로 한 가지만"
- hitokoto, subline, body도 모두 한국어로 작성합니다.
- 글자 수 범위는 한국어 가독성을 위해 각 본문에서 약 700~1,000자로 조정할 수 있습니다.
- 결과가 오락과 자기 이해를 위한 참고 정보이며 의학적·과학적 진단이 아님을 전제로 합니다.`;

export function buildNatalSystemPrompt(locale = "ja") {
  return locale === "ko"
    ? `${SYSTEM_PROMPT}${KOREAN_OUTPUT_INSTRUCTION}`
    : SYSTEM_PROMPT;
}

// ===== ユーザープロンプト (動的・plan + chart から組み立て) =====
//   chart: エフェメリス計算結果 / scores: Big Five 0-10 / essence: 称号 / typeName: 32タイプ名
//   timeUnknown: 出生時刻不明フラグ
export function buildNatalUserPrompt({ chart, scores, essence, typeName, timeUnknown, nowIso, locale = "ja" }) {
  const plan = buildUnmeiPlan(scores);

  // 章別 chart_elements (この中からのみ選ばせる)
  const haichiEl = elementsBlock(chart, ["sun", "mercury", "venus", "mars", "saturn", "jupiter", "mc"], timeUnknown);
  const kokoroEl = elementsBlock(chart, ["sun", "moon", "venus", "mars", "asc"], timeUnknown);
  const chosenEl = elementsBlock(chart, ["sun", "moon", "jupiter", "saturn", "mc"], timeUnknown);
  // ④時期の根拠 = トランジット(生成日時点の木星・土星の運行)と本人の太陽/月の関係。
  //   生成日は nowIso (既定=現在)。鑑定は保存されるため、この時期は購入時点のスナップショット。
  const timingBasis = formatTransitBlock(
    computeTransitTiming(chart, nowIso || new Date().toISOString()),
  );

  return `以下のデータで、システムの指示どおり JSON のみで鑑定を書いてください。
出力言語: ${locale === "ko" ? "韓国語（自然な敬語。日本語を出力しない）" : "日本語"}

## 内容レイヤー
主要スコア(%表記): ${plan.pctLine}
haichi の主語: ${plan.haichiSubject}
32タイプ: ${typeName ?? "(未取得)"} / 称号: ${essence ?? "(未取得)"}
time_unknown: ${timeUnknown === true}

利用可能なホロスコープ要素(この中からのみ選ぶ):
[haichi]
${haichiEl || "(なし)"}
[kokoro]
${kokoroEl || "(なし)"}
[chosen]
${chosenEl || "(なし)"}
[chosen ④時期の根拠(トランジット)]
${timingBasis}

## 文体レイヤー
象限: ${plan.quadrant}

## 各章の指示
- haichi: 主語=上記「haichi の主語」。担当=起源＋才能・仕事。subline→①②③。字数450〜550。冗長な占星術説明を削り断定を増やす。
- kokoro: 主語=協調性・外向性。担当=恋と距離の起源(傾向は書かない)。subline→①②③。字数450〜550。冗長な占星術説明を削り断定を増やす。
- chosen: 主語=全体。subline の因子名%は代表として「${plan.topFactorPct}」(乖離最大の因子・haichiと同じ)を使う。例「${plan.topFactorPct} × {星の要素1} ↔ {星の要素2}」。subline→①②③④(時期)。④は上記[chosen ④時期の根拠(トランジット)]の近い転機に必ず基づき、絶対表記(西暦年+季節)で幅を持たせた行動指示にする(相対表記「今年/来年」やピンポイント日付は禁止)。字数550〜650。
- grace: 締めの余韻のみ・行動なし・subline は ""。字数150〜250。

JSON を出力してください。`;
}
