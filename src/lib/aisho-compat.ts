// 相性診断ロジック (ルールベース・LLM不使用＝B-1思想)
//
// 型テーブルに 0-10 数値は無い (Step1確定)。各タイプは 5軸の高低(±)二値のみ。
// → 数値化せず、ThirtyTwoType.code ("O＋C＋E＋A＋N＋") を parseAxes で各軸bool化し、
//   軸ごとの効き方テーブルを直引きして合成する。
//   ※ 高低→数値(8/2・10/0等)マッピングは採用しない (8/2だと★5が構造上出ないため経路自体を回避)。
//
// 実データで確認済みの文字コード: ＋ = U+FF0B (高=true) / − = U+2212 (低=false)。

import type { AppResultLocale } from "@/i18n/result";
import { thirtyTwoType, type ThirtyTwoTypeId } from "./thirty-two-types";

const PLUS = "＋"; // U+FF0B = 高

export interface Axes {
  O: boolean;
  C: boolean;
  E: boolean;
  A: boolean;
  N: boolean;
}

export type AxisKey = "A" | "N" | "O" | "C" | "E";

// code ("O＋C＋E＋A＋N＋") をパースし { O,C,E,A,N } の boolean を返す。
// 各軸文字の直後が ＋(U+FF0B) なら高=true、それ以外(−=U+2212)は低=false。
export function parseAxes(code: string): Axes {
  const read = (axis: string): boolean => {
    const i = code.indexOf(axis);
    return i >= 0 && code[i + 1] === PLUS;
  };
  return {
    O: read("O"),
    C: read("C"),
    E: read("E"),
    A: read("A"),
    N: read("N"),
  };
}

// 両者の true 数で 3状態に分類 (A/N の レベル系軸で使用)
type PairState = "both" | "one" | "none";
function pairState(a: boolean, b: boolean): PairState {
  if (a && b) return "both";
  if (a || b) return "one";
  return "none";
}

// 各軸を 0-1 で算出。x,y について対称。
function axisScores(x: Axes, y: Axes): Record<AxisKey, number> {
  // A 思いやり: レベル (高いほど良／片方でも救われる)  両＋1.0 / 片＋0.6 / 両−0.15
  const a = pairState(x.A, y.A);
  const sA = a === "both" ? 1.0 : a === "one" ? 0.6 : 0.15;
  // N 情緒(＋=繊細/N高): 逆レベル (両繊細で不安増幅)  両＋0.2 / 片＋0.55 / 両−1.0
  const n = pairState(x.N, y.N);
  const sN = n === "both" ? 0.2 : n === "one" ? 0.55 : 1.0;
  // O 価値観: 類似  一致1.0 / 不一致0.35
  const sO = x.O === y.O ? 1.0 : 0.35;
  // C 生活リズム: 類似  一致1.0 / 不一致0.35
  const sC = x.C === y.C ? 1.0 : 0.35;
  // E 社交: 補完 (確定)  不一致1.0 / 一致0.35
  const sE = x.E !== y.E ? 1.0 : 0.35;
  return { A: sA, N: sN, O: sO, C: sC, E: sE };
}

// 軸×状態のマイクロコピー辞書 (褒め文／ケア文兼用・状態に応じて読み替わる)。
// 各文は 2 文構成で、結果ページの地の文に馴染む長さ・トーン (「〜。」で完結)。
function axisCopyKo(key: AxisKey, x: Axes, y: Axes): string {
  const a = x[key];
  const b = y[key];
  switch (key) {
    case "A": {
      const s = pairState(a, b);
      return s === "both"
        ? "두 사람 모두 배려가 깊어 상대의 마음을 먼저 생각할 수 있는 유형이에요. 예를 들어 상대가 기운 없어 보이는 날에는 이것저것 캐묻지 않고 살며시 “무리하지 마”라고 한마디 건넬 수 있어요. 조금 부딪혀도 한쪽이 자연스럽게 한발 물러나 부드럽게 풀고, 마음 깊은 곳에 “소중히 대하고 싶다”는 생각이 있어 크게 꼬이기 어려워요."
        : s === "one"
          ? "한 사람의 다정함이 이 관계의 윤활유가 되어 주는 것 같아요. 예를 들어 약속 시간에 조금 늦어도 한쪽이 “괜찮아”라며 웃어넘기는 일이 많을 거예요. 늘 받아 주는 쪽에 기대기보다 가끔은 먼저 “고마워”라고 수고를 알아주면 훨씬 대등하고 편안한 균형이 돼요."
          : "서로 솔직하게 말할 수 있는 만큼 거리낌 없는 한마디가 문득 아프게 꽂힐 때도 있어요. 예를 들어 지친 날에 “그건 아니지 않아?”라는 정답을 들으면 내용이 맞아도 마음은 따끔할 수 있어요. 악의가 없다는 걸 알아도 바쁜 날일수록 말을 골라 주세요. 짧은 격려 한마디만 있어도 분위기는 완전히 달라져요.";
    }
    case "N": {
      const s = pairState(a, b);
      return s === "both"
        ? "두 사람 모두 섬세해서 상대의 기분과 주변 분위기를 잘 알아차리는 유형이에요. 예를 들어 반나절 동안 답장이 없으면 둘 다 “내가 뭘 잘못했나?” 하고 불안해지기 쉬워요. 다정함의 이면에서 걱정이 번지기 쉬우니 혼자 품지 말고 그날 안에 “조금 걱정됐을 뿐이야”라고 말하면 관계가 안정돼요."
        : s === "one"
          ? "한 사람의 마음이 흔들리는 날에도 다른 한 사람이 든든하게 받아 주는 관계예요. 예를 들어 시험을 앞두고 예민해져도 한쪽이 “괜찮아, 어떻게든 될 거야”라며 분위기를 가라앉혀 줘요. 감정의 파도를 한 사람이 받쳐 주기 때문에 크게 무너지지 않고 안심할 수 있어요."
          : "두 사람 모두 정서적으로 안정되어 웬만한 파도에는 흔들리지 않는 조합이에요. 예를 들어 기대하던 약속이 갑자기 취소돼도 오래 끌지 않고 “그럼 다음엔 언제 볼까?”라고 바로 전환할 수 있어요. 감정싸움으로 번지기 어려워 다퉈도 “그래서 이제 어떻게 할까?”라는 해결 모드로 빨리 돌아와요.";
    }
    case "O":
      return a === b
        ? "세상을 바라보는 방향이 닮아서 이야기해도 놀아도 화제가 끊이지 않아요. 예를 들어 같은 영상이나 음악을 보고 동시에 “이거 좋다”라고 느껴 밤늦게까지 대화가 이어지는 유형이에요. 공감이 계속되니 함께 있을 때 가장 편한 사람이 되기 쉬워요."
        : "가치관은 다르지만 그래서 서로에게 혼자서는 만나지 못했을 풍경을 보여 줘요. 예를 들어 한 사람이 권한 행사나 가게가 다른 사람에게는 처음 만나는 세계일 수 있어요. 서로에게 신선한 자극을 주며 각자의 세계를 넓혀 갈 수 있는 관계예요.";
    case "C":
      return a === b
        ? "계획과 속도에 대한 감각이 비슷해서 함께 움직여도 마찰이 적어요. 예를 들어 여행에서도 “일단 만날 시간만 정하고 나머지는 현지에서 편하게”라는 온도가 잘 맞아요. 일을 진행하는 템포가 같아서 놀이나 과제도 기분 좋게 풀어 갈 수 있어요."
        : "한 사람은 계획형, 다른 한 사람은 추진형이에요. 예를 들어 한쪽이 일정표를 꼼꼼히 만드는 옆에서 다른 쪽은 “당일 분위기에 맡기면 안 돼?”라고 할 수 있어요. 그래도 처음에 마감과 만날 시간만 정해 두면 이 차이가 오히려 잘 맞물려 즐겁고 빠른 조합이 돼요.";
    case "E":
      if (a !== b)
        return "분위기를 이끄는 사람과 이야기를 깊게 만드는 사람이 만난 보완형 조합이에요. 예를 들어 모임에서는 한쪽이 전체 분위기를 띄우고 다른 한쪽은 옆에서 한 사람 한 사람의 이야기를 제대로 들어 줘요. 정반대라 역할이 자연스럽게 나뉘어 여럿이 있을 때도 둘만 있을 때도 편안하게 어울려요.";
      return a
        ? "두 사람 모두 바깥 활동을 좋아하고 에너지가 넘쳐요. 예를 들어 “지금 만날래?”라는 갑작스러운 제안에도 둘 다 신나게 응할 수 있는 유형이에요. 텐션이 오르는 지점이 같아서 활기차고 지루할 틈 없는 관계가 되기 쉬워요."
        : "두 사람 모두 조용한 시간을 소중히 여기는 유형이에요. 예를 들어 같은 방에서 각자 휴대폰을 보고만 있어도 침묵이 어색하지 않고 오히려 편안해요. 억지로 분위기를 띄우지 않아도 되니 함께 있을 때 자연스럽게 마음이 놓이는 관계예요.";
  }
}

function axisCopyEn(key: AxisKey, x: Axes, y: Axes): string {
  const a = x[key];
  const b = y[key];
  switch (key) {
    case "A": {
      const state = pairState(a, b);
      return state === "both"
        ? "You both tend to notice the other person's feelings before pushing your own position. That mutual care makes small conflicts easier to soften, but honest needs still deserve to be spoken aloud."
        : state === "one"
          ? "One person's warmth often keeps this relationship moving smoothly. Make appreciation visible so that the more accommodating person does not quietly carry all of the emotional work."
          : "Your directness can be refreshing, but a correct point may still land sharply on a difficult day. A brief sign of care before the solution can change the whole conversation."
    }
    case "N": {
      const state = pairState(a, b);
      return state === "both"
        ? "You are both sensitive to shifts in mood and may amplify each other's uncertainty. Naming a worry early keeps imagination from turning a small silence into a larger story."
        : state === "one"
          ? "When one person feels emotionally unsettled, the other can offer useful steadiness. The relationship works best when calm support does not become dismissal of the more sensitive person's experience."
          : "You both recover from emotional turbulence relatively quickly and can return to problem-solving. Remember that moving on efficiently is not always the same as fully hearing each other."
    }
    case "O":
      return a === b
        ? "You are drawn to a similar kind of world, so ideas, culture, and conversation can feel naturally shared. Familiarity is a strength as long as you still invite each other into something new."
        : "Your different perspectives can introduce each of you to experiences you would not have chosen alone. Curiosity turns the contrast into expansion instead of a debate about which worldview is correct.";
    case "C":
      return a === b
        ? "Your sense of pace and planning is similar, which reduces everyday friction. Shared habits make coordination easy, though unspoken assumptions still need an occasional check-in."
        : "One of you is more planful while the other moves through momentum. Agreeing on deadlines and non-negotiables first lets flexibility and structure support each other.";
    case "E":
      if (a !== b)
        return "This is a complementary social rhythm: one person opens the room while the other deepens the exchange. Respecting different recovery needs makes the contrast genuinely useful.";
      return a
        ? "You both gain energy through activity and can create an exciting, spontaneous relationship. Leave enough quiet space for plans and feelings that need more than momentum."
        : "You both value quiet and can feel comfortable without filling every silence. Make invitations and affection explicit enough that mutual reserve does not look like distance.";
  }
}

function axisCopyId(key: AxisKey, x: Axes, y: Axes): string {
  const a = x[key];
  const b = y[key];
  switch (key) {
    case "A": {
      const state = pairState(a, b);
      return state === "both"
        ? "Kalian sama-sama peka terhadap perasaan satu sama lain. Kepedulian ini membantu meredakan konflik kecil, tetapi kebutuhan yang jujur tetap perlu diucapkan."
        : state === "one"
          ? "Kehangatan salah satu pihak sering menjaga hubungan tetap lancar. Tunjukkan penghargaan agar orang yang lebih banyak mengalah tidak memikul seluruh beban emosi sendirian."
          : "Keterusterangan kalian terasa menyegarkan, tetapi ucapan yang benar pun bisa terasa tajam pada hari yang berat. Sedikit empati sebelum memberi solusi dapat mengubah seluruh percakapan.";
    }
    case "N": {
      const state = pairState(a, b);
      return state === "both"
        ? "Kalian sama-sama peka terhadap perubahan suasana dan dapat saling memperbesar rasa tidak pasti. Mengungkapkan kekhawatiran lebih awal mencegah keheningan kecil berubah menjadi cerita yang lebih besar."
        : state === "one"
          ? "Saat salah satu pihak sedang goyah, pihak lain dapat memberi ketenangan yang dibutuhkan. Dukungan bekerja paling baik ketika ketenangan tidak mengabaikan pengalaman orang yang lebih sensitif."
          : "Kalian berdua relatif cepat pulih dari gejolak emosi dan kembali mencari solusi. Tetap ingat bahwa bergerak maju dengan cepat belum tentu berarti sudah saling mendengarkan sepenuhnya.";
    }
    case "O":
      return a === b
        ? "Kalian tertarik pada dunia yang serupa, sehingga gagasan dan percakapan terasa mudah dibagikan. Kesamaan ini menjadi kekuatan selama kalian tetap saling mengajak mencoba hal baru."
        : "Sudut pandang yang berbeda dapat memperkenalkan pengalaman yang tidak akan dipilih sendirian. Rasa ingin tahu mengubah perbedaan menjadi perluasan dunia, bukan perdebatan tentang siapa yang benar.";
    case "C":
      return a === b
        ? "Ritme dan cara kalian merencanakan cukup mirip sehingga koordinasi sehari-hari terasa ringan. Sesekali periksa asumsi yang tidak terucap agar kesamaan tetap menjadi kekuatan."
        : "Salah satu lebih terencana, sementara yang lain bergerak mengikuti momentum. Menyepakati tenggat dan hal yang tidak bisa ditawar sejak awal membuat struktur dan fleksibilitas saling mendukung.";
    case "E":
      if (a !== b) {
        return "Ritme sosial kalian saling melengkapi: satu orang membuka suasana, sementara yang lain memperdalam percakapan. Menghormati kebutuhan pemulihan yang berbeda membuat perpaduan ini benar-benar bermanfaat.";
      }
      return a
        ? "Kalian sama-sama mendapat energi dari aktivitas dan dapat menciptakan hubungan yang spontan serta seru. Sisakan ruang tenang untuk rencana dan perasaan yang membutuhkan lebih dari sekadar momentum."
        : "Kalian sama-sama menghargai ketenangan dan nyaman tanpa harus mengisi setiap jeda. Nyatakan ajakan dan kasih sayang dengan cukup jelas agar sikap pendiam tidak terlihat seperti jarak.";
  }
}

function axisCopy(
  key: AxisKey,
  x: Axes,
  y: Axes,
  locale: AppResultLocale,
): string {
  if (locale === "ko") return axisCopyKo(key, x, y);
  if (locale === "en") return axisCopyEn(key, x, y);
  if (locale === "id") return axisCopyId(key, x, y);
  // 日本語は、自己診断・友達診断の結果ページと同じ説明書調 (です・ますで短く言い切る)。
  const a = x[key];
  const b = y[key];
  switch (key) {
    case "A": {
      const s = pairState(a, b);
      return s === "both"
        ? "ふたりとも思いやりが深く、相手の気持ちを先に考えられるタイプです。たとえば相手の元気がない日は、根掘り葉掘り聞かずに「無理しないでね」と一言添えられます。多少ぶつかっても、どちらかが自然に折れて、やさしくほどけます。根っこに「大事にしたい」があるので、大きくこじれません。"
        : s === "one"
          ? "片方のやさしさが、この関係の潤滑油になっています。たとえば約束の時間に少し遅れても、片方が「気にしないで」と笑って受け止めます。受け止める側に甘えすぎず、ときどき自分から「ありがとう」と伝えてください。それだけで、対等で心地いいバランスになります。"
          : "お互い率直にものを言えるぶん、遠慮のない一言が刺さることがあります。たとえば疲れている日に「それ違くない?」と正論を返されると、内容は正しくてもチクッときます。忙しい日ほど、言葉を選んでください。ひと言の労いがあるだけで、空気は大きく変わります。";
    }
    case "N": {
      const s = pairState(a, b);
      return s === "both"
        ? "ふたりとも繊細で、相手の機嫌や場の空気によく気づくタイプです。たとえば返信が半日こないだけで、ふたりそろって「なにか怒らせたかな」と不安になります。やさしさの裏返しで、不安が伝染しやすい組み合わせです。モヤモヤは一人で抱え込まず、その日のうちに「ちょっと心配だっただけ」と言葉にすると安定します。"
        : s === "one"
          ? "片方の気持ちが揺れた日も、もう片方がどっしり受け止める関係です。たとえばテスト前でピリついていても、片方が「大丈夫、なんとかなるって」と場の空気を落ち着かせます。感情の波を片方が引き受けるので、大崩れしにくく、安心感があります。"
          : "ふたりとも情緒が安定していて、多少の荒波では動じないコンビです。たとえば楽しみにしていた予定が急に流れても、引きずらず「じゃあ次いつにする?」とすぐ切り替えます。感情のぶつけ合いになりにくいので、もめても「で、どうする?」とすぐ前向きな話し合いに戻れます。";
    }
    case "O":
      return a === b
        ? "見ている世界の方向がそっくりで、話しても遊んでも話題が尽きません。たとえば同じ動画や音楽に同時に「これ好き」となって、深夜までLINEが止まらなくなります。「それな」が続くので、一緒にいていちばんラクな相手になります。"
        : "価値観は違いますが、そのぶんお互いが、自分ひとりでは出会わない景色を見せてくれます。たとえば片方が誘うイベントやお店は、もう片方にとって初めての世界です。刺激をくれる相手として、世界を広げ合える関係です。";
    case "C":
      return a === b
        ? "計画やペースの感覚が近く、一緒に動いても擦れにくいふたりです。たとえば旅行でも、準備の細かさや当日の動き方の温度感がぴったり合います。段取りのテンポが同じなので、遊びも課題も気持ちよく進みます。"
        : "片方は計画派、片方は勢い派です。たとえば片方がしおりを作りこむ横で、もう片方は「当日のノリでよくない?」と言います。最初に締め切りと集合だけ決めておけば、この違いはむしろ噛み合って、楽しくて速いコンビになります。";
    case "E":
      if (a !== b)
        return "場を回す側と、じっくり深める側の凸凹コンビです。たとえば飲み会では、片方が全体を盛り上げ、もう片方は隣で一人ひとりの話をしっかり聞いています。正反対だからこそ役割が自然に分かれ、グループでもふたりでも心地よく過ごせます。";
      return a
        ? "ふたりとも外向きでエネルギッシュです。たとえば「今から集まらない?」という急な誘いにも、ふたりともすぐ乗ります。テンションの上がるポイントが同じなので、にぎやかで飽きのこない関係になります。"
        : "ふたりとも静かな時間を大切にするタイプです。たとえば同じ部屋でそれぞれスマホを見ているだけでも、沈黙が気まずくならず、むしろ心地よく感じます。無理に盛り上げなくていいので、一緒にいて落ち着く関係です。";
  }
}

// ---- グラフに出す% (表示専用) ------------------------------------------------
// 軸の点数 s は、タイプの高低 (2値) の組み合わせで決まるので、15・20・35・55・60・100 の
// 6通りしかなく、グラフがキリの良い数字ばかりになる。そこで「ふたりのバランス」のグラフに出す
// 数字だけ、組み合わせと軸ごとに決まる幅 (±8) でずらす。
//   - 表示専用。相性度・ランク・いいところ/注意の選び方・シーン別の文は、ずらす前の s で決める。
//   - 同じふたりなら、順番を入れ替えても、何度見ても同じ数字。
//   - 判定の言葉 (ぴったり/かみ合う/まあまあ/補い合い) の帯はまたがない。5の倍数は出さない。
//   - 心理学的な根拠のある数字ではない (見た目の調整)。
const DISPLAY_SPREAD = 8;
// 判定の言葉の帯 (AishoPage の matchLabel と同じ境目)。
const DISPLAY_BANDS: [number, number][] = [
  [85, 99],
  [65, 84],
  [45, 64],
  [6, 44],
];

function hash32(text: string): number {
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function displayPercents(
  aId: ThirtyTwoTypeId,
  bId: ThirtyTwoTypeId,
  s: Record<AxisKey, number>,
): Record<AxisKey, number> {
  const pair = [aId, bId].sort().join("|");
  const out = {} as Record<AxisKey, number>;
  for (const key of AXIS_ORDER) {
    const base = Math.round(s[key] * 100);
    const [lo, hi] = DISPLAY_BANDS.find(([min]) => base >= min) ?? DISPLAY_BANDS[3];
    const h = hash32(`${pair}|${key}`);
    const offset = (h % (DISPLAY_SPREAD * 2 + 1)) - DISPLAY_SPREAD;
    // 100 は上に動かせないので、下にだけずらす。
    let v = base >= 100 ? 100 - 1 - (h % (DISPLAY_SPREAD + 3)) : base + offset;
    v = Math.max(lo, Math.min(hi, v));
    if (v % 5 === 0) v += v + 1 <= hi ? 1 : -1;
    out[key] = v;
  }
  return out;
}

// サマリー (%帯)
function summaryFor(percent: number, locale: AppResultLocale): string {
  if (percent >= 90)
    return locale === "ko" ? "운명처럼 잘 맞는 사이" : locale === "en" ? "An exceptional natural match" : locale === "id" ? "Kecocokan alami yang istimewa" : "運命級の相性";
  if (percent >= 75)
    return locale === "ko" ? "상당히 잘 맞는 사이" : locale === "en" ? "A strongly compatible pair" : locale === "id" ? "Pasangan yang sangat cocok" : "かなりの好相性";
  if (percent >= 60)
    return locale === "ko"
      ? "균형이 좋은 두 사람"
      : locale === "en" ? "A well-balanced connection" : locale === "id" ? "Hubungan yang seimbang" : "バランスのいいふたり";
  if (percent >= 45)
    return locale === "ko"
      ? "맞춰 갈수록 빛나는 두 사람"
      : locale === "en" ? "A connection that grows through adjustment" : locale === "id" ? "Hubungan yang tumbuh melalui penyesuaian" : "歩み寄りで輝くふたり";
  return locale === "ko"
    ? "어려움만큼 배움도 큰 사이"
    : locale === "en" ? "More challenging, with real room to learn" : locale === "id" ? "Menantang, tetapi memberi banyak ruang untuk belajar" : "試練も学びも大きいふたり";
}

// 相性ランク S/A/B/C (表示% 40〜95 を4段階に)。
//   S ≥85 / A ≥70 / B ≥55 / C それ未満。結果ページはこのランクの画像を主役表示する。
export type CompatRank = "S" | "A" | "B" | "C";
function rankFor(percent: number): CompatRank {
  if (percent >= 85) return "S";
  if (percent >= 70) return "A";
  if (percent >= 55) return "B";
  return "C";
}

export interface CompatResult {
  raw: number; // 素点 (26〜100)
  percent: number; // 表示% (40〜95)
  stars: number; // 1〜5
  rank: CompatRank; // 相性ランク S/A/B/C
  s: Record<AxisKey, number>;
  display: Record<AxisKey, number>; // グラフに出す% (表示専用。displayPercents 参照)
  summary: string;
  goods: string[]; // 良いところ (s降順トップ2軸)
  caution: string; // 気をつけるところ (s昇順最下位1軸・トップ2と重複したら次点)
}

// s の合成順 (タイ時の決定順・O(1)で対称)
const AXIS_ORDER: AxisKey[] = ["A", "N", "O", "C", "E"];

export function compat(
  aId: ThirtyTwoTypeId,
  bId: ThirtyTwoTypeId,
  locale: AppResultLocale = "ja",
): CompatResult {
  const x = parseAxes(thirtyTwoType(aId).code);
  const y = parseAxes(thirtyTwoType(bId).code);
  const s = axisScores(x, y);

  const raw = 30 * s.A + 20 * s.N + 20 * s.O + 15 * s.C + 15 * s.E; // 26〜100
  let percent = Math.round(40 + ((raw - 26) / 74) * 55);
  percent = Math.max(40, Math.min(95, percent)); // 丸め保険
  const stars =
    percent >= 90 ? 5 : percent >= 75 ? 4 : percent >= 60 ? 3 : percent >= 45 ? 2 : 1;

  // 良いところ = s降順トップ2軸のコピー
  const desc = [...AXIS_ORDER].sort((p, q) => s[q] - s[p]);
  const top2 = desc.slice(0, 2);
  const goods = top2.map((k) => axisCopy(k, x, y, locale));

  // 気をつけるところ = s昇順で最下位、ただしトップ2と重複したら次点
  const asc = [...AXIS_ORDER].sort((p, q) => s[p] - s[q]);
  const cautionKey = asc.find((k) => !top2.includes(k)) ?? asc[0];
  const caution = axisCopy(cautionKey, x, y, locale);

  return {
    raw,
    percent,
    stars,
    rank: rankFor(percent),
    s,
    display: displayPercents(aId, bId, s),
    summary: summaryFor(percent, locale),
    goods,
    caution,
  };
}
