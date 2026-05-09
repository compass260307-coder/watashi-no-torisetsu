import type { TorisetsuType, TorisetsuTypeId } from "./types";

export const torisetsuTypes: Record<TorisetsuTypeId, TorisetsuType> = {
  "festival-sun": {
    id: "festival-sun",
    name: "お祭りムードメーカー",
    emoji: "🎪",
    imageUrl: "/types/festival-sun.png",
    color: "#FF4081",
    subtitle: "どこにいても場を明るくする太陽系",
    basicSpec: "エネルギー値：常にMAX ／ 社交性：∞ ／ 好奇心：測定不能",
    happyWords: "「おもしろい！」「一緒にやろう！」「さすが！」",
    weakEnvironment: "ひとりで黙々と作業する時間が長いとエネルギー切れ",
    handlingTips:
      "リアクションを返してあげるのが一番。既読スルーだけは避けて。",
    energyBoost:
      "新しい人と出会う場、サプライズ企画、みんなでワイワイする時間",
    hiddenAbility: "場の空気を一瞬で変えるムードチェンジ力",
    unknownCharm: "楽しそうに見えて、実はめちゃくちゃ周りを見てる",
    lovedQuirk:
      "テンション上がりすぎて暴走するところ。でもそれが場を盛り上げる。",
    detailDescription:
      "人と関わるとエネルギーが湧くタイプ。新しい場でも数分で空気を読み、自然と中心人物になれる。明るく、優しく、新しいものに開かれている。",
    traits: ["社交性高い", "場を盛り上げる", "新しい挑戦が好き", "感受性豊か"],
  },
  "everyones-home": {
    id: "everyones-home",
    name: "みんなの実家",
    emoji: "🏠",
    imageUrl: "/types/everyones-home.png",
    color: "#2EC4B6",
    subtitle: "安心感と安定感の塊。いるだけでホッとする",
    basicSpec: "安心感：MAX ／ 包容力：∞ ／ 安定感：揺るがない",
    happyWords:
      "「ありがとう」「〇〇がいてくれてよかった」「頼りにしてる」",
    weakEnvironment: "急な変更が連続する状況、ルールが曖昧な環境",
    handlingTips:
      "感謝を言葉にして伝えること。「当たり前」にしないこと。",
    energyBoost:
      "いつもの仲間との安定した時間、誰かの役に立てた実感",
    hiddenAbility: "グループの対立を知らない間に調停してるスキル",
    unknownCharm: "一緒にいるだけで安心する、言葉にできない存在感",
    lovedQuirk:
      "心配性すぎて「大丈夫？」が口グセ。でもそれが嬉しい。",
    detailDescription:
      "誰にとっても心の拠り所になる安定感の持ち主。包容力があり、グループの空気を整える役割を自然に担う。一緒にいるだけでホッとできる存在。",
    traits: ["安心感", "包容力", "聞き上手", "気配り上手"],
  },
  "wild-charisma": {
    id: "wild-charisma",
    name: "暴走カリスマ",
    emoji: "🌪️",
    imageUrl: "/types/wild-charisma.png",
    color: "#FFB800",
    subtitle: "自分の道を突き進む。周りは気づいたら巻き込まれてる",
    basicSpec:
      "カリスマ性：測定不能 ／ 行動力：暴走気味 ／ 独自性：唯一無二",
    happyWords:
      "「さすがだね」「やっぱお前すごいわ」「ついてくわ」",
    weakEnvironment:
      "自由がない環境、前例主義、「普通こうでしょ」という空気",
    handlingTips:
      "否定から入らないこと。まず「おもしろいね」と受け止める。",
    energyBoost:
      "自分のアイデアが形になる瞬間、新しい挑戦、常識を壊すとき",
    hiddenAbility: "無茶ぶりを実現してしまう謎の突破力",
    unknownCharm: "自由に見えて、実は仲間想い",
    lovedQuirk:
      "思いつきで行動して周りを振り回すけど、なぜか許される。",
    detailDescription:
      "常識にとらわれない発想と、それを実行に移す行動力で周囲を巻き込んでいくタイプ。一見自由人だが、実は仲間想い。型を破るカリスマ性で道を作る。",
    traits: ["行動派", "唯一無二", "突破力", "巻き込み上手"],
  },
  "iron-mental": {
    id: "iron-mental",
    name: "鉄のメンタル番長",
    emoji: "🛡️",
    imageUrl: "/types/iron-mental.png",
    color: "#6C5CE7",
    subtitle: "ブレない、動じない、でも実は情に厚い",
    basicSpec: "メンタル強度：鉄壁 ／ 決断力：瞬速 ／ 信念：揺るがない",
    happyWords:
      "「頼りにしてる」「判断が早い」「あなたが言うなら間違いない」",
    weakEnvironment:
      "なかなか決まらない場面、周りに合わせすぎる空気",
    handlingTips:
      "結論から話すのがベスト。率直に伝えるほうが信頼される。",
    energyBoost:
      "目標に向かって突き進む時間、信頼できる仲間との本音トーク",
    hiddenAbility: "ピンチの時に一番冷静でいられる判断力",
    unknownCharm:
      "強そうに見えて、信頼した相手にはめちゃくちゃ甘い",
    lovedQuirk:
      "率直すぎる発言で場が一瞬止まるところ。でもみんな内心「正論…」って思ってる。",
    detailDescription:
      "プレッシャーや困難な状況でも冷静に判断できる強さの持ち主。決断が早く、信念がブレない。信頼した相手にはとことん尽くす情の厚さも持つ。",
    traits: ["決断力", "メンタル強い", "信念が強い", "情に厚い"],
  },
  "delicate-creator": {
    id: "delicate-creator",
    name: "繊細クリエイター",
    emoji: "🎨",
    imageUrl: "/types/delicate-creator.png",
    color: "#00D4AA",
    subtitle: "感性が鋭すぎて、見えてる世界が違う",
    basicSpec:
      "感受性：超敏感 ／ 創造力：無限大 ／ 観察力：顕微鏡レベル",
    happyWords:
      "「感性すごい」「その発想なかった」「〇〇の世界観好き」",
    weakEnvironment:
      "ガヤガヤした空間、雑な扱い、自分のペースを乱される状況",
    handlingTips:
      "急かさないこと。この人のペースを尊重すると最高の力を発揮する。",
    energyBoost:
      "ひとりの創作時間、美しいものに触れる瞬間、深い話ができる相手",
    hiddenAbility: "言葉にできない空気感を察知するセンサー",
    unknownCharm: "控えめに見えて、実は一番芯が強い",
    lovedQuirk:
      "考えすぎて動き出しが遅いところ。でもその分、出てくるものの質が高い。",
    detailDescription:
      "細かな空気感や微妙な変化を感じ取れる繊細な感性の持ち主。創造力豊かで、独自の世界観を持っている。控えめに見えて、実は芯が強い。",
    traits: ["感受性豊か", "創造力", "観察力", "独自の世界観"],
  },
  "healing-guardian": {
    id: "healing-guardian",
    name: "癒しの守護神",
    emoji: "🌿",
    imageUrl: "/types/healing-guardian.png",
    color: "#00B894",
    subtitle: "静かに支える。気づいたらみんなの心の拠り所",
    basicSpec: "癒し力：最強 ／ 忍耐力：無限 ／ 信頼度：不動",
    happyWords:
      "「〇〇がいると安心する」「ずっと友達でいてね」「いつもありがとう」",
    weakEnvironment:
      "自己主張を求められる場、スピード重視の環境、対立が多い空間",
    handlingTips:
      "この人が我慢してないか、たまに聞いてあげること。自分からは言わないから。",
    energyBoost:
      "信頼できる少人数での時間、誰かが笑顔になる瞬間、穏やかな日常",
    hiddenAbility: "誰も見てないところでフォローしてる影のMVP力",
    unknownCharm: "おっとりに見えて、実は意志がめちゃくちゃ強い",
    lovedQuirk:
      "NOと言えなくて抱え込みがち。でも頼られると嬉しいのも本当。",
    detailDescription:
      "穏やかで聞き上手、誰かの心を癒す力を持つタイプ。表に出ないところで仲間を支え、信頼を集めている。おっとりに見えて、意志はしっかり持っている。",
    traits: ["癒し系", "聞き上手", "忍耐強い", "影のMVP"],
  },
  "deep-dive-explorer": {
    id: "deep-dive-explorer",
    name: "沼ハマり探究者",
    emoji: "🔍",
    imageUrl: "/types/deep-dive-explorer.png",
    color: "#C44569",
    subtitle: "好きなことへの集中力が異次元。沼の深さは底なし",
    basicSpec:
      "集中力：異次元 ／ 探究心：底なし ／ こだわり：職人レベル",
    happyWords:
      "「詳しいね！」「教えて！」「〇〇の話もっと聞きたい」",
    weakEnvironment: "興味のない話を長時間聞く場面、広く浅い付き合い",
    handlingTips:
      "好きなことを語ってる時は、とにかく聞くこと。目が輝き出したらチャンス。",
    energyBoost:
      "新しい知識に出会う瞬間、同じ沼の仲間を見つけた時、没頭できる環境",
    hiddenAbility: "ニッチな知識で予想外の場面で活躍する特殊スキル",
    unknownCharm:
      "興味ないことへの塩対応と、好きなことへの熱量のギャップ",
    lovedQuirk:
      "沼トークが止まらなくなるところ。でも楽しそうだからつい聞いちゃう。",
    detailDescription:
      "興味を持ったことを深く掘り下げる職人気質。広く浅くより、好きなことに没頭する時間を大切にする。同じ沼の仲間に出会うと一気に距離が縮まる。",
    traits: ["集中力", "探究心", "こだわり強い", "ニッチな知識"],
  },
  "cool-maverick": {
    id: "cool-maverick",
    name: "冷静マイペース",
    emoji: "🧊",
    imageUrl: "/types/cool-maverick.png",
    color: "#1E90FF",
    subtitle: "周りに流されない独自路線。クールに見えて実は…",
    basicSpec:
      "冷静さ：氷点下 ／ 自立度：MAX ／ 分析力：コンピュータ級",
    happyWords:
      "「わかってるね」「ブレないよね」「〇〇の意見が聞きたい」",
    weakEnvironment: "ペースを乱される状況、中身のない付き合い",
    handlingTips:
      "適度な距離感がベスト。信頼を示しつつ、ペースを尊重してあげて。",
    energyBoost:
      "ひとりの時間、論理的な議論、自分のペースで物事を進められる環境",
    hiddenAbility: "冷静な視点で的確な助言ができるアドバイザー力",
    unknownCharm:
      "クールに見えて、実は心の中ではめちゃくちゃ考えてくれてる",
    lovedQuirk:
      "興味あることとないことで態度が全然違うところ。でもその正直さが信頼される。",
    detailDescription:
      "周囲に流されず自分のペースを保てる自立タイプ。論理的で分析力があり、的確な助言ができる。クールに見えて、実は心の中で深く考えてくれている。",
    traits: ["冷静沈着", "マイペース", "分析力", "独立心"],
  },
};
