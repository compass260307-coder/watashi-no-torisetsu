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
  essence: string; // 例: 太陽の社交家
  oneLiner: string; // 一文紹介 (フラグ on 時のヒーロー/ShareCard 説明文)
  slug: string; // 画像ファイル名 (拡張子なし) 例: parakeet_N → /characters/v3/parakeet_N.png
  group: ThirtyTwoGroup;
}

/** グループ色 (生息地) */
export const THIRTY_TWO_GROUP_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#A8D88A", // 空・緑
  land: "#F5A9C0", // 陸・ピンク
  sea: "#8EC5E8", // 海・青
  unknown: "#C3A0E0", // 未知・紫
};

export const thirtyTwoCharacter: Record<ThirtyTwoTypeId, ThirtyTwoCharacter> = {
  // ===== 空グループ (緑) base16: quiet-owl / seeker-wolf / dreamer-rabbit / fantasy-cat =====
  "quiet-owl__N": { name: "きらめきインコ", essence: "太陽の社交家", oneLiner: "明るい好奇心で人の輪を彩る、みんなの気持ちに敏感な社交家。", slug: "parakeet_N", group: "sky" },
  "quiet-owl__R": { name: "どうどうワシ", essence: "不動の王者", oneLiner: "何があっても揺るがない、堂々と前を照らす不動のリーダー。", slug: "eagle_R", group: "sky" },
  "seeker-wolf__N": { name: "すいすいツバメ", essence: "身軽な先駆者", oneLiner: "身軽に新しい世界へ飛び込む、感受性ゆたかな先駆者。", slug: "swallow_N", group: "sky" },
  "seeker-wolf__R": { name: "クールタカ", essence: "孤高の狩人", oneLiner: "一人静かに狙いを定める、冷静で揺るがない孤高の狩人。", slug: "hawk_R", group: "sky" },
  "dreamer-rabbit__N": { name: "なかよしペンギン", essence: "甘えん坊の人気者", oneLiner: "人懐っこくて甘え上手、みんなに愛される心やさしい人気者。", slug: "penguin_N", group: "sky" },
  "dreamer-rabbit__R": { name: "ゆうがハクチョウ", essence: "優雅な大物", oneLiner: "落ち着いた佇まいで場を包む、動じない優雅な大物。", slug: "swan_R", group: "sky" },
  "fantasy-cat__N": { name: "きまぐれカラス", essence: "自由な観察者", oneLiner: "自由気ままに世界を眺める、独自の感性を持つ観察者。", slug: "crow_N", group: "sky" },
  "fantasy-cat__R": { name: "おおらかペリカン", essence: "動じない楽天家", oneLiner: "細かいことは気にしない、ゆったり構えた動じない楽天家。", slug: "pelican_R", group: "sky" },

  // ===== 陸グループ (ピンク) base16: caretaker-dog / brisk-tiger / smiley-panda / playful-raccoon =====
  "caretaker-dog__N": { name: "せわやきイヌ", essence: "あたたかい世話役", oneLiner: "みんなの変化に誰より早く気づく、あたたかい世話役。", slug: "dog_N", group: "land" },
  "caretaker-dog__R": { name: "たよれるウマ", essence: "頼れる相棒", oneLiner: "どんな時も背中を預けられる、頼れる相棒。", slug: "horse_R", group: "land" },
  "brisk-tiger__N": { name: "がんばりトラ", essence: "努力家の実務家", oneLiner: "目標へひたむきに走る、努力を惜しまない実務家。", slug: "tiger_N", group: "land" },
  "brisk-tiger__R": { name: "どっしりクマ", essence: "揺るがない大黒柱", oneLiner: "プレッシャーの中でも崩れない、揺るがない大黒柱。", slug: "bear_R", group: "land" },
  "smiley-panda__N": { name: "にこにこパンダ", essence: "愛されムード", oneLiner: "いるだけで場が和む、みんなに愛されるムードメーカー。", slug: "panda_N", group: "land" },
  "smiley-panda__R": { name: "おっとりゾウ", essence: "包容力の主", oneLiner: "ゆったり大きく構える、何でも受け止める包容力の主。", slug: "elephant_R", group: "land" },
  "playful-raccoon__N": { name: "やんちゃアライグマ", essence: "自由な遊び人", oneLiner: "その場のノリで楽しさを生む、しばられない自由な遊び人。", slug: "raccoon_N", group: "land" },
  "playful-raccoon__R": { name: "ごうかいサイ", essence: "豪快な突進者", oneLiner: "迷わずまっすぐ突き進む、豪快で動じない突破役。", slug: "rhino_R", group: "land" },

  // ===== 海グループ (青) base16: sparkle-dolphin / ambition-lion / idea-monkey / whim-fox =====
  "sparkle-dolphin__N": { name: "きらめきイルカ", essence: "好奇心の探究者", oneLiner: "好奇心いっぱいに世界を泳ぐ、感受性ゆたかな探究者。", slug: "dolphin_N", group: "sea" },
  "sparkle-dolphin__R": { name: "れいせいシャチ", essence: "冷静な知将", oneLiner: "冷静に状況を読み解く、揺るがない知将。", slug: "orca_R", group: "sea" },
  "ambition-lion__N": { name: "やさしいタツノオトシゴ", essence: "寄り添う癒し手", oneLiner: "そっと寄り添い心を癒す、繊細でやさしい癒し手。", slug: "seahorse_N", group: "sea" },
  "ambition-lion__R": { name: "ゆうゆうウミガメ", essence: "悠久の賢者", oneLiner: "時間をかけて深く見通す、悠久の落ち着きを持つ賢者。", slug: "seaturtle_R", group: "sea" },
  "idea-monkey__N": { name: "ゆめみるクラゲ", essence: "儚い夢想家", oneLiner: "ひとりの世界で空想をふくらませる、儚くやさしい夢想家。", slug: "jellyfish_N", group: "sea" },
  "idea-monkey__R": { name: "のんびりマンボウ", essence: "おおらかな大物", oneLiner: "何事もゆったり受け流す、おおらかで動じない大物。", slug: "sunfish_R", group: "sea" },
  "whim-fox__N": { name: "きままクマノミ", essence: "自由な気分屋", oneLiner: "自分の心地よさを大切にする、自由な気分屋。", slug: "clownfish_N", group: "sea" },
  "whim-fox__R": { name: "マイペースサメ", essence: "動じない一匹狼", oneLiner: "誰にも流されず自分の道をゆく、動じない一匹狼。", slug: "shark_R", group: "sea" },

  // ===== 未知グループ (紫) base16: earnest-elephant / steady-turtle / gentle-koala / solo-hedgehog =====
  "earnest-elephant__N": { name: "じゅんすいユニコーン", essence: "純粋な理想家", oneLiner: "まっすぐな理想を胸に抱く、純粋でやさしい夢追い人。", slug: "unicorn_N", group: "unknown" },
  "earnest-elephant__R": { name: "ゆるぎないドラゴン", essence: "不動の守護者", oneLiner: "何があっても揺らがない、静かな威厳を持つ守護者。", slug: "dragon_R", group: "unknown" },
  "steady-turtle__N": { name: "あこがれペガサス", essence: "高みを目指す夢追い", oneLiner: "高い理想へ静かに羽ばたく、感受性ゆたかな夢追い。", slug: "pegasus_N", group: "unknown" },
  "steady-turtle__R": { name: "ふくつのフェニックス", essence: "不屈の再生者", oneLiner: "何度でも立ち上がる、折れない不屈の再生者。", slug: "phoenix_R", group: "unknown" },
  "gentle-koala__N": { name: "おもいやりエンジェル", essence: "慈愛の使い", oneLiner: "誰かの幸せをそっと願う、慈愛にあふれた癒し手。", slug: "angel_N", group: "unknown" },
  "gentle-koala__R": { name: "ふどうゴーレム", essence: "不動の番人", oneLiner: "どっしり構えて動じない、静かに守り抜く不動の番人。", slug: "golem_R", group: "unknown" },
  "solo-hedgehog__N": { name: "てれやオバケ", essence: "はにかみ屋", oneLiner: "自分の世界をそっと守る、はにかみ屋の独立心。", slug: "ghost_N", group: "unknown" },
  "solo-hedgehog__R": { name: "のんきガイコツ", essence: "飄々の自由人", oneLiner: "何にも縛られず飄々と生きる、マイペースな自由人。", slug: "skeleton_R", group: "unknown" },
};

/** 画像アセットのバージョン (32キャラは v3 ディレクトリ)。 */
export const THIRTY_TWO_ASSET_VERSION = 3;
