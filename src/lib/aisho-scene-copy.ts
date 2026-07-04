// 相性解説・シーン別コピー (ルールベース・LLM不使用＝B-1思想)
//
// compat() の % / ★ / サマリーはそのまま。詳細ブロックを「4シーン23パターン」に拡張する。
// ランタイムはテーブル直引きのみ (静的維持)。軸状態は既存 parseAxes を再利用して導出。
//
// シーンと主役2軸:
//   love   恋愛では   … A × N
//   friend 友情では   … O × E
//   work   一緒に働くと … C × E
//   clash  すれ違うとき … N × O
//
// 軸状態:
//   A/N (3値): 両＋=both / 片＋=one / 両−=none  (2タイプの当該boolの合計 count∈{2,1,0})
//   O/C/E (2値): 一致=match / 不一致=diff

import { thirtyTwoType, type ThirtyTwoTypeId } from "./thirty-two-types";
import { parseAxes, type AxisKey } from "./aisho-compat";

export type SceneKey = "love" | "friend" | "work" | "clash";

export interface SceneLine {
  key: SceneKey;
  label: string;
  text: string;
}

type Tri = "both" | "one" | "none";
type Bi = "match" | "diff";

function tri(a: boolean, b: boolean): Tri {
  const c = (a ? 1 : 0) + (b ? 1 : 0);
  return c === 2 ? "both" : c === 1 ? "one" : "none";
}
function bi(a: boolean, b: boolean): Bi {
  return a === b ? "match" : "diff";
}

// love: キー = A状態_N状態
const LOVE: Record<string, string> = {
  both_none:
    "二人とも思いやりが深く、情緒も安定。安心して寄りかかれる、穏やかで温かい関係",
  both_one:
    "優しさは十分。片方が揺れても、もう片方が支えになれるバランスのいい二人",
  both_both:
    "優しさは申し分ない。ただ二人とも繊細だから、不安を一人で抱えずこまめに言葉にすると長続きする",
  one_none:
    "片方の優しさが関係を支える土台。情緒は安定しているので、甘えすぎない意識があれば穏やか",
  one_one:
    "片方の優しさと安定感が支え。もう片方の揺れをそっと受け止められるかが鍵",
  one_both:
    "優しさは片方頼み、二人とも繊細。不安が重なる前に、素直に頼り合う練習を",
  none_none:
    "お互い率直で情緒は安定。ドライだけど気楽、サバサバした距離感が心地いい関係",
  none_one:
    "遠慮のない二人。片方が揺れたとき、労いの一言があるだけで空気がやわらぐ",
  none_both:
    "率直さと繊細さが同居。きつい一言が刺さりやすいので、言葉選びを意識すると守れる関係",
};

// friend: キー = O状態_E状態
const FRIEND: Record<string, string> = {
  match_diff:
    "見ている世界が近く、場を回す側と深める側で自然に役割が分かれる。長く続く名コンビ",
  match_match:
    "興味の方向がそっくり。一緒にいると話も遊びも尽きない、気の合う友達",
  diff_diff:
    "価値観は違うけど、社交スタイルの凸凹がむしろ噛み合う。刺激をくれる相手",
  diff_match:
    "テンションは合うのに見ているものが違う。共通の趣味を一つ作ると一気に縮まる",
};

// work: キー = C状態_E状態
const WORK: Record<string, string> = {
  match_diff:
    "仕事のペース感覚が近く、回す人と詰める人で分担が決まる。安定して噛み合うチーム",
  match_match:
    "計画の感覚もテンションも近い。息を合わせて一気に進められる二人",
  diff_diff:
    "片方は計画派、片方は勢い派。役割さえ分ければ、弱点を補い合ういい凸凹",
  diff_match:
    "ノリは合うがペースがずれる。締め切りと段取りを先に決めておくと空回りしない",
};

// clash: キー = N状態_O状態
const CLASH: Record<string, string> = {
  none_match:
    "二人とも動じにくく価値観も近い。もめても根が同じだから、話せばすぐ元に戻れる",
  none_diff:
    "情緒は安定しているので、価値観が違っても冷静に擦り合わせられる。大崩れしにくい",
  one_match:
    "片方が揺れても価値観は共有。落ち着くのを待てば、ちゃんと分かり合える",
  one_diff:
    "片方の揺れと価値観の差が重なると長引きやすい。一度距離を置いて頭を冷やすと安全",
  both_match:
    "二人とも繊細だが根っこは同じ。感情が高ぶったら、一晩おいてから話すとこじれない",
  both_diff:
    "感情が揺れやすいうえ価値観も違うと、こじれると長引きがち。冷却時間を先に決めておくのが吉",
};

// 4シーン分のコピーを引く。主役2軸の状態キーで辞書直引き。
export function sceneLines(
  aId: ThirtyTwoTypeId,
  bId: ThirtyTwoTypeId,
): SceneLine[] {
  const x = parseAxes(thirtyTwoType(aId).code);
  const y = parseAxes(thirtyTwoType(bId).code);
  const st = (k: AxisKey) => tri(x[k], y[k]);
  const eq = (k: AxisKey) => bi(x[k], y[k]);

  return [
    { key: "love", label: "恋愛では", text: LOVE[`${st("A")}_${st("N")}`] },
    {
      key: "friend",
      label: "友情では",
      text: FRIEND[`${eq("O")}_${eq("E")}`],
    },
    { key: "work", label: "一緒に働くと", text: WORK[`${eq("C")}_${eq("E")}`] },
    { key: "clash", label: "すれ違うとき", text: CLASH[`${st("N")}_${eq("O")}`] },
  ];
}
