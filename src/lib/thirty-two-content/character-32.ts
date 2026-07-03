// 32キャラのビジュアル/命名マスター (解釈B: 名前・画像・色も32化) — 隔離レイヤー
//
// ユーザー確定の対応表どおり。base16 の元の動物/性格は無視し、生息地グループ優先で
// 名前・動物画像・essence・oneLiner・グループ色を上書きする。
//   - グループ = base16 の E×O (空=G3 / 陸=G2 / 海=G1 / 未知=G4)
//   - 画像は public/characters/v3/<slug>.png (slug は <英名>_<N|R>)
//   - フラグ on のときだけ表示パスがこれを参照する。off は従来16 (sixteenTypes / v2)。
//
// 本番16データ (sixteen-types.ts / public/characters/v2) は無改変。

import type { ThirtyTwoTypeId } from "../thirty-two-types";

export type ThirtyTwoGroup = "sky" | "land" | "sea" | "unknown";

export interface ThirtyTwoCharacter {
  name: string; // 例: きらめきインコ
  animal: string; // 素の動物名 (例: ユニコーン)。職業表示「{job}{animal}」/「？{animal}」/ 統合解説で使用。
  essence: string; // 例: 太陽の社交家
  oneLiner: string; // 一文紹介 (フラグ on 時のヒーロー/ShareCard 説明文)
  catchphrase: string; // キャラ名言 (ヒーロー・コード直下。グレース基調・セリフ体で1行表示)
  zukanDesc: string; // 図鑑専用の一言説明文 (/zukan-internal カード。性格を端的に説明する事典風)
  slug: string; // 画像ファイル名 (拡張子なし) 例: parakeet_N → /characters/v3/parakeet_N.png
  group: ThirtyTwoGroup;
}

/** グループ色 (生息地) */
// グループ色 (淡色・明度高め)。背景の極薄ウォッシュにも、zukan のタイプ色アクセントにも使う。
export const THIRTY_TWO_GROUP_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#F3DF7A", // 空・黄
  land: "#A8D88A", // 陸・緑
  sea: "#8EC5E8", // 海・青
  unknown: "#C3A0E0", // 未知・紫
};

export const thirtyTwoCharacter: Record<ThirtyTwoTypeId, ThirtyTwoCharacter> = {
  // ===== 空グループ (緑) base16: quiet-owl / seeker-wolf / dreamer-rabbit / fantasy-cat =====
  "quiet-owl__N": { name: "きらめきインコ", animal: "インコ", essence: "詩人", oneLiner: "言わぬ声 すくいあげては 花にする", catchphrase: "心の機微を、そっと言葉に変えていく。", zukanDesc: "言葉にならない機微を捉え表現に変える。繊細で感受性が高い。", slug: "parakeet_N", group: "sky" },
  "quiet-owl__R": { name: "どうどうワシ", animal: "ワシ", essence: "賢者", oneLiner: "多くを語らずとも、その佇まいが灯りになる。", catchphrase: "揺るがない心が、誰かの灯りになる。", zukanDesc: "多くを語らず佇まいで示す。揺るがない芯を持つ。", slug: "eagle_R", group: "sky" },
  "seeker-wolf__N": { name: "すいすいツバメ", animal: "ツバメ", essence: "理論家", oneLiner: "知りたいという衝動が、一人でも遠くまで連れていく。", catchphrase: "知りたい気持ちが、私を遠くへ運ぶ。", zukanDesc: "知りたい衝動のまま突き進む。探究心が強く繊細。", slug: "swallow_N", group: "sky" },
  "seeker-wolf__R": { name: "クールタカ", animal: "タカ", essence: "ストラテジスト", oneLiner: "風さえ、味方につけてみせる。", catchphrase: "静けさの中で、最善の一手を選ぶ。", zukanDesc: "静かに最善の一手を選ぶ。冷静で計算高い。", slug: "hawk_R", group: "sky" },
  "dreamer-rabbit__N": { name: "なかよしペンギン", animal: "ペンギン", essence: "空想家", oneLiner: "頭の中の世界はいつも、やさしい色で満ちている。", catchphrase: "想いを描くほど、世界はやわらかくなる。", zukanDesc: "頭の中の世界を大切にする。やさしく繊細。", slug: "penguin_N", group: "sky" },
  "dreamer-rabbit__R": { name: "ゆうがハクチョウ", animal: "ハクチョウ", essence: "表現者", oneLiner: "人と比べない強さが、自分らしさを美しくする。", catchphrase: "落ち着いた佇まいが、その場を美しく整える。", zukanDesc: "人と比べず自分らしさを貫く。落ち着いた佇まいを持つ。", slug: "swan_R", group: "sky" },
  "fantasy-cat__N": { name: "きまぐれカラス", animal: "カラス", essence: "収集家", oneLiner: "みんなが素通りするものに、ひとり立ち止まれる。", catchphrase: "私の眼にだけ映る景色を、集めていく。", zukanDesc: "皆が素通りするものに立ち止まる。独自の視点を持つ。", slug: "crow_N", group: "sky" },
  "fantasy-cat__R": { name: "おおらかペリカン", animal: "ペリカン", essence: "職人", oneLiner: "急がず、媚びず、自分の「これだ」を突き詰める。", catchphrase: "急がないことが、いちばんの近道。", zukanDesc: "急がず自分の「これだ」を突き詰める。マイペースで動じない。", slug: "pelican_R", group: "sky" },

  // ===== 陸グループ (ピンク) base16: caretaker-dog / brisk-tiger / smiley-panda / playful-raccoon =====
  // ⚠ 陸グループは画像を ES系の新マスコットに差し替え (slug のみ更新)。MBTI→内部タイプ対応は
  //   Big Five 標準対応: ESFJ=caretaker-dog / ESTJ=brisk-tiger / ESFP=smiley-panda /
  //   ESTP=playful-raccoon。※ name/animal/essence/oneLiner と本文は旧動物のまま (別途更新)。
  "caretaker-dog__N": { name: "せわやきイヌ", animal: "イヌ", essence: "アテンダント", oneLiner: "みんなの小さな変化に、誰より早く気づいてしまう。", catchphrase: "あなたの小さな変化に、まっ先に気づく。", zukanDesc: "相手の小さな変化に気づき気を配る。繊細で献身的。", slug: "rabbit_N", group: "land" },
  "caretaker-dog__R": { name: "たよれるウマ", animal: "ウマ", essence: "幹事", oneLiner: "どんな時も背中を預けられる、揺るがず支え続ける頼れる相棒。", catchphrase: "そばにいるだけで、頼れる存在でいたい。", zukanDesc: "人を迎え、場をもてなす。面倒見がよく頼れる。", slug: "dog_R", group: "land" },
  "brisk-tiger__N": { name: "がんばりトラ", animal: "トラ", essence: "師範", oneLiner: "積み重ねた一歩は、決して裏切らない。", catchphrase: "地道こそ、いちばんの近道。", zukanDesc: "地道に積み重ね全体に目を配る。几帳面で世話焼き。", slug: "elephant_N", group: "land" },
  "brisk-tiger__R": { name: "どっしりクマ", animal: "クマ", essence: "支配人", oneLiner: "どんな重圧の前でも、その背中だけは揺るがない。", catchphrase: "重圧の中でこそ、静かに立っていたい。", zukanDesc: "規律を保ち組織を回す。重圧の前でも動じない。", slug: "bear_R", group: "land" },
  "smiley-panda__N": { name: "にこにこパンダ", animal: "パンダ", essence: "演出家", oneLiner: "その場にいるだけで、空気がふっとやわらかくなる。", catchphrase: "私がいる場所が、笑顔であふれるように。", zukanDesc: "その場の空気をやわらげ魅せる。人の反応に敏感。", slug: "fox_N", group: "land" },
  "smiley-panda__R": { name: "おっとりゾウ", animal: "ゾウ", essence: "楽天家", oneLiner: "明日はきっといい日になる、と本気で思える。", catchphrase: "明日は、きっといい日になる。", zukanDesc: "場を盛り上げ楽しませる。度胸があり人目を気にしない。", slug: "squirrel_R", group: "land" },
  "playful-raccoon__N": { name: "やんちゃアライグマ", animal: "アライグマ", essence: "開拓者", oneLiner: "楽しいことは、待つものじゃなく、自分でつくるもの。", catchphrase: "楽しさは、いつも自分の手でつくる。", zukanDesc: "楽しみを自ら作り出す。行動的だが繊細さも持つ。", slug: "cheetah_N", group: "land" },
  "playful-raccoon__R": { name: "ごうかいサイ", animal: "サイ", essence: "勝負師", oneLiner: "迷ったら、まっすぐ進む。それだけは決めている。", catchphrase: "迷ったら、まっすぐ進むと決めている。", zukanDesc: "迷わずまっすぐ進む。度胸があり恐れを知らない。", slug: "tiger_R", group: "land" },

  // ===== 海グループ (青) base16: sparkle-dolphin / ambition-lion / idea-monkey / whim-fox =====
  // ⚠ 海グループは画像を EN系の新マスコットに差し替え (slug のみ更新)。MBTI→内部タイプ対応は
  //   Big Five 標準対応 (E=E / O=N / A=F·T / C=J·P) による: ENFJ=sparkle-dolphin /
  //   ENTJ=ambition-lion / ENTP=whim-fox / ENFP=idea-monkey。
  //   ※ name/animal/essence/oneLiner と本文(self-result-32 等)は旧動物のままで、新画像と不一致。
  //     コンテンツ更新は別途必要 (レポート済み)。
  "sparkle-dolphin__N": { name: "きらめきイルカ", animal: "イルカ", essence: "寄添者", oneLiner: "人の心に寄り添い、新しい世界へ一緒に踏み出していける伴走者。", catchphrase: "心に寄り添いながら、世界を知っていく。", zukanDesc: "人の気持ちに寄り添い、支える。繊細で共感力が高い。", slug: "jellyfish_N", group: "sea" },
  "sparkle-dolphin__R": { name: "れいせいシャチ", animal: "シャチ", essence: "先導者", oneLiner: "みんなの想いを束ね、同じ夢へ向かって一緒に駆けていける主人公。", catchphrase: "その熱は、人の心に火をともす。", zukanDesc: "人をまとめ、同じ目標へ導く。決断が速く、動じない。", slug: "dolphin_R", group: "sea" },
  "ambition-lion__N": { name: "やさしいタツノオトシゴ", animal: "タツノオトシゴ", essence: "采配者", oneLiner: "全体を見渡し、最善の配置で人と場を動かす采配役。", catchphrase: "盤面を読みきって、最善の一手を。", zukanDesc: "全体を見渡し最適な配置を組む。責任感が強く細部まで詰める。", slug: "swordfish_N", group: "sea" },
  "ambition-lion__R": { name: "ゆうゆうウミガメ", animal: "ウミガメ", essence: "将軍", oneLiner: "大局を見通し、揺るがぬ判断で全体を統べていける指揮官。", catchphrase: "時をかけて、ものごとの本質を見通す。", zukanDesc: "大局を見て集団を統率する。揺るがない判断力を持つ。", slug: "orca_R", group: "sea" },
  "idea-monkey__N": { name: "ゆめみるクラゲ", animal: "クラゲ", essence: "ジャーナリスト", oneLiner: "心に響いたものを見つけ出し、自分の言葉で誰かに届けていける発信者。", catchphrase: "見つけたものを、そっと光に変えて。", zukanDesc: "心に響いたものを見つけ発信する。感受性が豊か。", slug: "clownfish_N", group: "sea" },
  "idea-monkey__R": { name: "のんびりマンボウ", animal: "マンボウ", essence: "フェススター", oneLiner: "その場を一瞬で明るく染め、みんなを巻き込んで楽しませる祭りの主役。", catchphrase: "ゆったり流すほど、毎日は軽くなる。", zukanDesc: "その場を明るくし人を巻き込む。好奇心のまま動く。", slug: "seal_R", group: "sea" },
  "whim-fox__N": { name: "きままクマノミ", animal: "クマノミ", essence: "弁才家", oneLiner: "自分の言葉で人を惹きつけ、心地よく語りで動かしていける話し手。", catchphrase: "心地よさを大切に、自分らしく語る。", zukanDesc: "言葉で人を惹きつけ動かす。発想が独創的で繊細。", slug: "octopus_N", group: "sea" },
  "whim-fox__R": { name: "マイペースサメ", animal: "サメ", essence: "革命家", oneLiner: "常識を疑い、自分の信じる未来を世界に突きつけていける革命家。", catchphrase: "流されない心が、新しい道をひらく。", zukanDesc: "常識を疑い、自分の信じる道を進む。他人に流されない。", slug: "shark_R", group: "sea" },

  // ===== 未知グループ (紫) base16: earnest-elephant / steady-turtle / gentle-koala / solo-hedgehog =====
  "earnest-elephant__N": { name: "じゅんすいユニコーン", animal: "ユニコーン", essence: "夢想家", oneLiner: "まっすぐな理想だけは、どうしても手放せない。", catchphrase: "まっすぐな理想が、世界を少しやさしくする。", zukanDesc: "まっすぐな理想を手放さない。純粋で繊細。", slug: "unicorn_N", group: "unknown" },
  "earnest-elephant__R": { name: "ゆるぎないドラゴン", animal: "ドラゴン", essence: "守護者", oneLiner: "何があっても、守ると決めたものは守りぬく。", catchphrase: "静かな強さで、大切なものを守りぬく。", zukanDesc: "守ると決めたものを守り抜く。静かな強さを持つ。", slug: "dragon_R", group: "unknown" },
  "steady-turtle__N": { name: "あこがれペガサス", animal: "ペガサス", essence: "飛翔家", oneLiner: "誰にも見せず、ただ高みへ羽ばたいていく。", catchphrase: "高い空へ、静かに羽ばたいていく。", zukanDesc: "誰にも見せず高みを目指す。理想が高く繊細。", slug: "pegasus_N", group: "unknown" },
  "steady-turtle__R": { name: "ふくつのフェニックス", animal: "フェニックス", essence: "不屈者", oneLiner: "倒れても、また立つ。それだけは、誰にも負けない。", catchphrase: "何度でも立ち上がる、それが私の強さ。", zukanDesc: "倒れても何度でも立ち上がる。粘り強く揺るがない。", slug: "phoenix_R", group: "unknown" },
  "gentle-koala__N": { name: "おもいやりエンジェル", animal: "エンジェル", essence: "審美者", oneLiner: "誰かの幸せを願うことが、いちばんの幸せ。", catchphrase: "誰かの幸せを、そっと願いつづける。", zukanDesc: "誰かの幸せを願い尽くす。やさしく感受性が高い。", slug: "angel_N", group: "unknown" },
  "gentle-koala__R": { name: "ふどうゴーレム", animal: "ゴーレム", essence: "数寄者", oneLiner: "好きなものを、ただ静かに、深く愛していたい。", catchphrase: "好きを極めるほど、世界は澄んでいく。", zukanDesc: "好きなものを静かに深く愛する。寡黙でマイペース。", slug: "golem_R", group: "unknown" },
  "solo-hedgehog__N": { name: "てれやオバケ", animal: "オバケ", essence: "探偵", oneLiner: "何も言わないけれど、ちゃんと、ぜんぶ見えている。", catchphrase: "何も言わないまま、ぜんぶ見えている。", zukanDesc: "多くを語らず全体を見ている。観察に長け繊細。", slug: "ghost_N", group: "unknown" },
  "solo-hedgehog__R": { name: "のんきガイコツ", animal: "ガイコツ", essence: "風雲児", oneLiner: "何にも縛られず、飄々と、自分の風で生きていく。", catchphrase: "何にも縛られず、飄々と生きていく。", zukanDesc: "何にも縛られず飄々と生きる。自由で動じない。", slug: "skeleton_R", group: "unknown" },
};

/** 画像アセットのバージョン (32キャラは v3 ディレクトリ)。 */
export const THIRTY_TWO_ASSET_VERSION = 3;
