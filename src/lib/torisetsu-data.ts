import type { TorisetsuType, TorisetsuTypeId } from "./types";

export const torisetsuTypes: Record<TorisetsuTypeId, TorisetsuType> = {
  "festival-sun": {
    id: "festival-sun",
    name: "お祭りムードメーカー",
    emoji: "🎪",
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
  },
  "everyones-home": {
    id: "everyones-home",
    name: "みんなの実家",
    emoji: "🏠",
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
  },
  "wild-charisma": {
    id: "wild-charisma",
    name: "暴走カリスマ",
    emoji: "🌪️",
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
  },
  "iron-mental": {
    id: "iron-mental",
    name: "鉄のメンタル番長",
    emoji: "🛡️",
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
  },
  "delicate-creator": {
    id: "delicate-creator",
    name: "繊細クリエイター",
    emoji: "🎨",
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
  },
  "healing-guardian": {
    id: "healing-guardian",
    name: "癒しの守護神",
    emoji: "🌿",
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
  },
  "deep-dive-explorer": {
    id: "deep-dive-explorer",
    name: "沼ハマり探究者",
    emoji: "🔍",
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
  },
  "cool-maverick": {
    id: "cool-maverick",
    name: "冷静マイペース",
    emoji: "🧊",
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
  },
};
