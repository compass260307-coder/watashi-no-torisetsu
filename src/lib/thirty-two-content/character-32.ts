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
  "quiet-owl__N": { name: "きらめきインコ", animal: "インコ", essence: "詩人", oneLiner: "明るい好奇心で人の輪を彩る、みんなの気持ちに敏感な社交家。", catchphrase: "心の機微を、そっと言葉に変えていく。", slug: "parakeet_N", group: "sky" },
  "quiet-owl__R": { name: "どうどうワシ", animal: "ワシ", essence: "賢者", oneLiner: "何があっても揺るがない、堂々と前を照らす不動のリーダー。", catchphrase: "揺るがない心が、誰かの灯りになる。", slug: "eagle_R", group: "sky" },
  "seeker-wolf__N": { name: "すいすいツバメ", animal: "ツバメ", essence: "理論家", oneLiner: "身軽に新しい世界へ飛び込む、感受性ゆたかな先駆者。", catchphrase: "知りたい気持ちが、私を遠くへ運ぶ。", slug: "swallow_N", group: "sky" },
  "seeker-wolf__R": { name: "クールタカ", animal: "タカ", essence: "ストラテジスト", oneLiner: "一人静かに狙いを定める、冷静で揺るがない孤高の狩人。", catchphrase: "静けさの中で、最善の一手を選ぶ。", slug: "hawk_R", group: "sky" },
  "dreamer-rabbit__N": { name: "なかよしペンギン", animal: "ペンギン", essence: "空想家", oneLiner: "人懐っこくて甘え上手、みんなに愛される心やさしい人気者。", catchphrase: "想いを描くほど、世界はやわらかくなる。", slug: "penguin_N", group: "sky" },
  "dreamer-rabbit__R": { name: "ゆうがハクチョウ", animal: "ハクチョウ", essence: "表現者", oneLiner: "落ち着いた佇まいで場を包む、動じない優雅な大物。", catchphrase: "落ち着いた佇まいが、その場を美しく整える。", slug: "swan_R", group: "sky" },
  "fantasy-cat__N": { name: "きまぐれカラス", animal: "カラス", essence: "収集家", oneLiner: "自由気ままに世界を眺める、独自の感性を持つ観察者。", catchphrase: "私の眼にだけ映る景色を、集めていく。", slug: "crow_N", group: "sky" },
  "fantasy-cat__R": { name: "おおらかペリカン", animal: "ペリカン", essence: "職人", oneLiner: "細かいことは気にしない、ゆったり構えた動じない楽天家。", catchphrase: "急がないことが、いちばんの近道。", slug: "pelican_R", group: "sky" },

  // ===== 陸グループ (ピンク) base16: caretaker-dog / brisk-tiger / smiley-panda / playful-raccoon =====
  // ⚠ 陸グループは画像を ES系の新マスコットに差し替え (slug のみ更新)。MBTI→内部タイプ対応は
  //   Big Five 標準対応: ESFJ=caretaker-dog / ESTJ=brisk-tiger / ESFP=smiley-panda /
  //   ESTP=playful-raccoon。※ name/animal/essence/oneLiner と本文は旧動物のまま (別途更新)。
  "caretaker-dog__N": { name: "せわやきイヌ", animal: "イヌ", essence: "アテンダント", oneLiner: "みんなの変化に誰より早く気づく、あたたかい世話役。", catchphrase: "あなたの小さな変化に、まっ先に気づく。", slug: "rabbit_N", group: "land" },
  "caretaker-dog__R": { name: "たよれるウマ", animal: "ウマ", essence: "幹事", oneLiner: "どんな時も背中を預けられる、頼れる相棒。", catchphrase: "そばにいるだけで、頼れる存在でいたい。", slug: "dog_R", group: "land" },
  "brisk-tiger__N": { name: "がんばりトラ", animal: "トラ", essence: "師範", oneLiner: "目標へひたむきに走る、努力を惜しまない実務家。", catchphrase: "積み重ねた一歩が、確かな力になる。", slug: "elephant_N", group: "land" },
  "brisk-tiger__R": { name: "どっしりクマ", animal: "クマ", essence: "支配人", oneLiner: "プレッシャーの中でも崩れない、揺るがない大黒柱。", catchphrase: "重圧の中でこそ、静かに立っていたい。", slug: "bear_R", group: "land" },
  "smiley-panda__N": { name: "にこにこパンダ", animal: "パンダ", essence: "演出家", oneLiner: "いるだけで場が和む、みんなに愛されるムードメーカー。", catchphrase: "私がいる場所が、笑顔であふれるように。", slug: "fox_N", group: "land" },
  "smiley-panda__R": { name: "おっとりゾウ", animal: "ゾウ", essence: "楽天家", oneLiner: "ゆったり大きく構える、何でも受け止める包容力の主。", catchphrase: "明日は、きっといい日になる。", slug: "squirrel_R", group: "land" },
  "playful-raccoon__N": { name: "やんちゃアライグマ", animal: "アライグマ", essence: "開拓者", oneLiner: "その場のノリで楽しさを生む、しばられない自由な遊び人。", catchphrase: "楽しさは、いつも自分の手でつくる。", slug: "cheetah_N", group: "land" },
  "playful-raccoon__R": { name: "ごうかいサイ", animal: "サイ", essence: "勝負師", oneLiner: "迷わずまっすぐ突き進む、豪快で動じない突破役。", catchphrase: "迷ったら、まっすぐ進むと決めている。", slug: "tiger_R", group: "land" },

  // ===== 海グループ (青) base16: sparkle-dolphin / ambition-lion / idea-monkey / whim-fox =====
  // ⚠ 海グループは画像を EN系の新マスコットに差し替え (slug のみ更新)。MBTI→内部タイプ対応は
  //   Big Five 標準対応 (E=E / O=N / A=F·T / C=J·P) による: ENFJ=sparkle-dolphin /
  //   ENTJ=ambition-lion / ENTP=whim-fox / ENFP=idea-monkey。
  //   ※ name/animal/essence/oneLiner と本文(self-result-32 等)は旧動物のままで、新画像と不一致。
  //     コンテンツ更新は別途必要 (レポート済み)。
  "sparkle-dolphin__N": { name: "きらめきイルカ", animal: "イルカ", essence: "寄添者", oneLiner: "好奇心いっぱいに世界を泳ぐ、感受性ゆたかな探究者。", catchphrase: "心に寄り添いながら、世界を知っていく。", slug: "jellyfish_N", group: "sea" },
  "sparkle-dolphin__R": { name: "れいせいシャチ", animal: "シャチ", essence: "先駆者", oneLiner: "冷静に状況を読み解く、揺るがない知将。", catchphrase: "冷静さは、未来を切りひらく羅針盤。", slug: "dolphin_R", group: "sea" },
  "ambition-lion__N": { name: "やさしいタツノオトシゴ", animal: "タツノオトシゴ", essence: "采配者", oneLiner: "そっと寄り添い心を癒す、繊細でやさしい癒し手。", catchphrase: "盤面を読みきって、最善の一手を。", slug: "swordfish_N", group: "sea" },
  "ambition-lion__R": { name: "ゆうゆうウミガメ", animal: "ウミガメ", essence: "将軍", oneLiner: "時間をかけて深く見通す、悠久の落ち着きを持つ賢者。", catchphrase: "時をかけて、ものごとの本質を見通す。", slug: "orca_R", group: "sea" },
  "idea-monkey__N": { name: "ゆめみるクラゲ", animal: "クラゲ", essence: "ジャーナリスト", oneLiner: "ひとりの世界で空想をふくらませる、儚くやさしい夢想家。", catchphrase: "見つけたものを、そっと光に変えて。", slug: "clownfish_N", group: "sea" },
  "idea-monkey__R": { name: "のんびりマンボウ", animal: "マンボウ", essence: "フェススター", oneLiner: "何事もゆったり受け流す、おおらかで動じない大物。", catchphrase: "ゆったり流すほど、毎日は軽くなる。", slug: "seal_R", group: "sea" },
  "whim-fox__N": { name: "きままクマノミ", animal: "クマノミ", essence: "弁才家", oneLiner: "自分の心地よさを大切にする、自由な気分屋。", catchphrase: "心地よさを大切に、自分らしく語る。", slug: "octopus_N", group: "sea" },
  "whim-fox__R": { name: "マイペースサメ", animal: "サメ", essence: "革命家", oneLiner: "誰にも流されず自分の道をゆく、動じない一匹狼。", catchphrase: "流されない心が、新しい道をひらく。", slug: "shark_R", group: "sea" },

  // ===== 未知グループ (紫) base16: earnest-elephant / steady-turtle / gentle-koala / solo-hedgehog =====
  "earnest-elephant__N": { name: "じゅんすいユニコーン", animal: "ユニコーン", essence: "夢想家", oneLiner: "まっすぐな理想を胸に抱く、純粋でやさしい夢追い人。", catchphrase: "まっすぐな理想が、世界を少しやさしくする。", slug: "unicorn_N", group: "unknown" },
  "earnest-elephant__R": { name: "ゆるぎないドラゴン", animal: "ドラゴン", essence: "守護者", oneLiner: "何があっても揺らがない、静かな威厳を持つ守護者。", catchphrase: "静かな強さで、大切なものを守りぬく。", slug: "dragon_R", group: "unknown" },
  "steady-turtle__N": { name: "あこがれペガサス", animal: "ペガサス", essence: "飛翔家", oneLiner: "高い理想へ静かに羽ばたく、感受性ゆたかな夢追い。", catchphrase: "高い空へ、静かに羽ばたいていく。", slug: "pegasus_N", group: "unknown" },
  "steady-turtle__R": { name: "ふくつのフェニックス", animal: "フェニックス", essence: "不屈者", oneLiner: "何度でも立ち上がる、折れない不屈の再生者。", catchphrase: "何度でも立ち上がる、それが私の強さ。", slug: "phoenix_R", group: "unknown" },
  "gentle-koala__N": { name: "おもいやりエンジェル", animal: "エンジェル", essence: "審美者", oneLiner: "誰かの幸せをそっと願う、慈愛にあふれた癒し手。", catchphrase: "誰かの幸せを、そっと願いつづける。", slug: "angel_N", group: "unknown" },
  "gentle-koala__R": { name: "ふどうゴーレム", animal: "ゴーレム", essence: "数寄者", oneLiner: "どっしり構えて動じない、静かに守り抜く不動の番人。", catchphrase: "好きを極めるほど、世界は澄んでいく。", slug: "golem_R", group: "unknown" },
  "solo-hedgehog__N": { name: "てれやオバケ", animal: "オバケ", essence: "探偵", oneLiner: "自分の世界をそっと守る、はにかみ屋の独立心。", catchphrase: "何も言わないまま、ぜんぶ見えている。", slug: "ghost_N", group: "unknown" },
  "solo-hedgehog__R": { name: "のんきガイコツ", animal: "ガイコツ", essence: "風雲児", oneLiner: "何にも縛られず飄々と生きる、マイペースな自由人。", catchphrase: "何にも縛られず、飄々と生きていく。", slug: "skeleton_R", group: "unknown" },
};

/** 画像アセットのバージョン (32キャラは v3 ディレクトリ)。 */
export const THIRTY_TWO_ASSET_VERSION = 3;
