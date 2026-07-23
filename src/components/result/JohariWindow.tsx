// /tako ④「2人がつくるジョハリの窓」(2026-07-23 追加 / 同日リデザイン×2)。
//   自己診断と友達の perceived_scores から Big Five 5軸を4つの窓に振り分ける。
//   各窓は必ず4件 (2026-07-23 指示):
//     開放 = ギャップが小さい順に4軸 (見え方が一致してる持ち味)
//     盲点 = 強い盲点 (友達が15pt以上高く見てる) 優先、不足分は友達の回答が
//            くっきりしてた軸のソフト文で補充 (友達の回答だけを根拠にする)
//     秘密 = 強い秘密 (自分が15pt以上高い) 優先、不足分は自己回答が
//            はっきりしてた軸のソフト文で補充 (自己回答だけを根拠にする)
//     未知 = 表に出てる度 (自己+友達の平均) が低い4軸を「伸びしろ」として出す
//   同じ軸が複数の窓に出るが、各窓の文面は根拠 (一致/友達の目/自分の内側/未来) が
//   異なるので矛盾しない。レイアウトは常時 2×2 の田の字 (2026-07-23 指示で復活)。
//   各窓にタイトル + 本文を載せる (2026-07-24 指示)。盲点の窓は課金ゲート
//   (locked 時はぼかし + 件数 + 解錠CTA、解放時は窓内に本文表示)。
//   ネガ表現は出さない (愛されるクセ変換ルール準拠)。

import {
  buildDimensionGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import type { BigFiveDimension } from "@/lib/types";
import { JohariHelpTip } from "./JohariHelpTip";
import { PaywallScrollButton } from "./PaywallScrollButton";

// 強い盲点/秘密のギャップしきい値 (パーセントポイント)。
const GAP = 15;
// 各窓のコンテンツ数。
const PER_WINDOW = 4;

// タイトル語 (高側/低側とも「愛されるクセ」トーン)。
const WORDS: Record<BigFiveDimension, { high: string; low: string }> = {
  O: { high: "好奇心旺盛", low: "じっくり派" },
  C: { high: "きっちり屋", low: "マイペース" },
  E: { high: "ムードメーカー", low: "聞き上手" },
  A: { high: "思いやり派", low: "自分軸しっかり" },
  N: { high: "繊細な感受性", low: "動じないハート" },
};

// 盲点の窓のタイトル語 (友達の目線で言い換え。開放/秘密とかぶらない語彙にする)。
const BLIND_TITLE: Record<BigFiveDimension, { high: string; low: string }> = {
  O: { high: "隠れきれてない好奇心", low: "通なこだわり" },
  C: { high: "思った以上のしっかり者", low: "いい脱力感" },
  E: { high: "無自覚ムードメーカー", low: "安心の聞き役" },
  A: { high: "気づかれてるやさしさ", low: "ブレない人" },
  N: { high: "バレてる繊細さ", low: "頼れる落ち着き" },
};

// 秘密の窓のタイトル語 (自分だけが知ってる言い方に言い換え)。
const SECRET_TITLE: Record<BigFiveDimension, { high: string; low: string }> = {
  O: { high: "脳内冒険家", low: "静かなこだわり" },
  C: { high: "隠れ努力家", low: "ゆるさの本音" },
  E: { high: "隠しはしゃぎ魂", low: "ひとり時間の達人" },
  A: { high: "隠れ気づかい屋", low: "譲れない一線" },
  N: { high: "内緒のアンテナ", low: "ひそかな図太さ" },
};

// 開放の窓: 見え方が一致してる軸の本文 ({v} = viewer)。
const OPEN_BODY: Record<BigFiveDimension, { high: string; low: string }> = {
  O: {
    high: "新しいもの好きは、ふたり公認。「これ面白いよ」と最初に見つけてくるのはいつもアナタで、{v}もそれを楽しみにしてる。話題の引き出しとして、静かに頼られてるよ。",
    low: "流行に飛びつくより、自分の定番を深く楽しむタイプ。その「ブレなさ」は{v}にもちゃんと同じように見えてて、安心感のもとになってるよ。",
  },
  C: {
    high: "「言ったことをちゃんとやる人」という認識が、自分と{v}で完全に一致してる。約束や締切を守る姿は当たり前すぎて自覚しにくいけど、それが信頼の土台になってるよ。",
    low: "きっちりより、マイペース。それはふたり公認の持ち味だよ。アナタの力の抜け具合があるから、一緒にいる時間の空気がゆるんで、{v}も肩の力を抜けてるんだ。",
  },
  E: {
    high: "場を明るくする力は、自他ともに認める持ち味。アナタがいる日といない日で集まりの空気が変わること、{v}はちゃんと知ってるよ。",
    low: "がやがや騒ぐより、じっくり聞く側。その落ち着いた空気感は{v}にも同じように見えてる。「この人の前では話しやすい」って思われてるのは、この持ち味のおかげだよ。",
  },
  A: {
    high: "まわりへのやさしさは、自分から見ても{v}から見てもハッキリ見えてる。無理して出してるものじゃないからこそ、隠しようがないくらい伝わってるんだ。",
    low: "人に流されない自分軸があるところ、{v}にもそのまま伝わってる。意見がぶつかっても「この人はこう考える人」って理解されてるから、変に気をつかわれない関係になれてるよ。",
  },
  N: {
    high: "細かいことに気づいて、深く感じ取る力。それはふたり共通の認識だよ。同じ景色を見ても人より多くを受け取ってる分、疲れやすいのも{v}は分かってくれてるはず。",
    low: "ちょっとやそっとじゃ動じないどっしり感は、自分から見ても{v}から見てもブレてない。まわりが慌ててるときほど、アナタの落ち着きが効いてるよ。",
  },
};

// 盲点の窓 (強): 友達の方が15pt以上高く見てる軸の本文。
const BLIND_BODY: Record<BigFiveDimension, string> = {
  O: "自分では「普通のこと」のつもりでも、{v}の目にはアナタの好奇心がキラキラ映ってるみたい。新しい話題や面白いものを見つけてくる姿が、一緒にいる時間を飽きさせないんだ。本人だけが気づいてない魅力だよ。",
  C: "「この人、ほんとにちゃんとしてる」って、{v}の中でのアナタは自分の想像以上。自分では当たり前にやってることが、外からは努力と誠実さに見えてる。そのギャップの分だけ、株が上がってるよ。",
  E: "自分では控えめにしてるつもり。でも{v}には、アナタは場を明るくする人に見えてるよ。何気ないひと言や笑い方が、思ってる以上に空気を変えてる。無自覚なのがまたいいんだ。",
  A: "無意識にやってるさりげない気づかい、{v}にはぜんぶ届いてるよ。本人が「そんなことしたっけ」と忘れるくらい自然にやってるからこそ、受け取った側の記憶にはしっかり残ってる。",
  N: "表に出してないつもりの繊細さ、{v}はちゃんと感じ取ってるみたい。隠せてないのはちょっと悔しいけど、それだけ細かい表情まで見てくれてる証拠。気づかれてるなら、たまには甘えても大丈夫だよ。",
};

// 盲点の窓 (ソフト): 友達の回答がくっきりしてた軸の補充文。友達の回答だけを
// 根拠にする (自己スコアに触れない) ので、開放/秘密と重複しても矛盾しない。
const SOFT_BLIND_BODY: Record<BigFiveDimension, { high: string; low: string }> =
  {
    O: {
      high: "{v}の回答では、アナタの好奇心がかなりハッキリ出てた。「次は何を見つけてくるんだろう」って、ちょっと楽しみにされてるみたい。その期待、悪くないでしょ。",
      low: "{v}の回答からは、アナタの「じっくり味わう派」なところがくっきり見えてた。流行に流されない選び方が、{v}の中ではアナタらしさになってるよ。",
    },
    C: {
      high: "{v}の回答では、アナタの「ちゃんとしてる度」がかなり高めに出てた。細かいところまで見られてないようで、見られてる。信頼されてる証拠だよ。",
      low: "{v}の回答からは、アナタのマイペースさがのびのび伝わってた。窮屈じゃない空気をつくれる人として映ってるみたい。それ、なかなか出せない味だよ。",
    },
    E: {
      high: "{v}の回答では、アナタの明るさがかなり前に出てた。本人が思う「素の自分」より、外に届いてるエネルギーは大きいのかも。",
      low: "{v}の回答からは、アナタの聞き役っぷりがくっきり見えてた。騒がしくないのに存在感がある。そういう人、実は少ないんだよ。",
    },
    A: {
      high: "{v}の回答では、アナタのやさしさがかなり強めに出てた。隠してるつもりでも、行動の端々からこぼれてるみたい。",
      low: "{v}の回答からは、アナタの「自分を持ってる感」がハッキリ出てた。合わせすぎない距離感が、逆に信頼につながってるよ。",
    },
    N: {
      high: "{v}の回答では、アナタの繊細なアンテナがしっかり拾われてた。細かい変化に気づく人だって、ちゃんと知られてるよ。",
      low: "{v}の回答からは、アナタのどっしり感がくっきり出てた。「この人は慌てない」って安心されてるみたい。頼られる才能だよ。",
    },
  };

// 秘密の窓 (強): 自分の方が15pt以上高く感じてる軸の本文。
const SECRET_BODY: Record<BigFiveDimension, string> = {
  O: "頭の中でぐるぐる広がってる好奇心や妄想、まだ{v}には見せてないみたい。アナタの脳内には、外から見えてる何倍もの世界が広がってる。ふとした瞬間にそれを話したら、{v}はきっと驚くよ。",
  C: "ほんとは裏でこつこつ頑張ってるきちんとさ、{v}にはまだ半分も伝わってないかも。涼しい顔でこなしてるように見えてる分、努力が見えにくいんだ。たまには「実はこれ、結構がんばった」って言っていい。",
  E: "ほんとはもっとはしゃぎたい自分がいるのに、{v}の前ではまだ小出しにしてるみたい。全開のテンションを見せる日が来たら、{v}との距離は一気に縮まるはず。その切り札は、好きなタイミングで切ればいいよ。",
  A: "「気をつかってる」自覚は、{v}が思ってるよりずっと大きい。それって、表からは努力に見えないくらい自然に気づかいができてる証拠なんだ。ただ、抱え込みすぎたときは素直に言っていいからね。",
  N: "心の中の揺れや不安、{v}にはうまく見せてないみたい。それだけ感情を乗りこなせてる証拠だよ。ただ、ぜんぶ一人で処理しなくてもいい。{v}は打ち明けられて嫌な相手じゃないはずだよ。",
};

// 秘密の窓 (ソフト): 自己回答がはっきりしてた軸の補充文。自己回答だけを根拠にする。
const SOFT_SECRET_BODY: Record<
  BigFiveDimension,
  { high: string; low: string }
> = {
  O: {
    high: "自分の回答では、好奇心はかなり強め。頭の中の「気になるリスト」、{v}にはまだ全部は見せてないんじゃない？",
    low: "「流行より自分の定番」というこだわりを、自分でははっきり自覚してる。その選び方の理由を{v}に語ったことは、まだ少ないかも。",
  },
  C: {
    high: "「ちゃんとやってる」という自覚が、自分の中にしっかりある。その舞台裏の努力、{v}はまだ全部は知らないはず。",
    low: "「ゆるくやりたい」という本音、自分の中でははっきりしてる。{v}の前でどこまで出すかは、アナタが決めていいんだよ。",
  },
  E: {
    high: "ほんとはお祭り好きな自分がいること、ちゃんと自覚してるはず。{v}の前で全開にする日は、いつでも選べるよ。",
    low: "「ひとりの時間が要る」という感覚、自分の中でははっきりしてる。それを{v}に説明する言葉を持っておくと、もっと楽になるよ。",
  },
  A: {
    high: "「合わせてあげてる」場面、自分ではけっこう自覚がある。その頑張り、たまには{v}に言ってもいいんだよ。",
    low: "「ここは譲れない」という軸を、自分ではっきり持ってる。それを見せる場面を選んでるの、実はかなり大人だよ。",
  },
  N: {
    high: "心の中のアンテナが忙しいこと、自分がいちばん知ってる。その感度は、{v}にはまだ半分も見えてないよ。",
    low: "「意外と平気」な自分の図太さ、ひそかに自覚してるはず。焦らず出していけばいい持ち味だよ。",
  },
};

// 未知の窓: まだどちらにも見えてない「伸びしろ」。表に出てる度が低い軸から出す。
const UNKNOWN_ITEMS: Record<BigFiveDimension, { title: string; body: string }> =
  {
    O: {
      title: "新世界にどハマりする自分",
      body: "まだ出会ってないジャンルに、ある日突然どハマりする可能性。ふたりとも知らない熱中モードのアナタが、この窓の奥で出番を待ってるよ。",
    },
    C: {
      title: "本気の仕切り屋モード",
      body: "イベントの幹事や旅行の計画、任されたら意外とハマるかも。段取りで頼られるアナタは、まだどっちの目にも映ってない。",
    },
    E: {
      title: "フルスロットルの自分",
      body: "心を全部ゆるした場所での、思いきりはしゃぐ姿。それはまだ、ふたりとも見たことがない景色かもしれないよ。",
    },
    A: {
      title: "甘え上手な自分",
      body: "いつも気づかう側のアナタが、思いきり頼って甘える姿。それを見せる日が来たら、{v}との関係はもう一段深くなるよ。",
    },
    N: {
      title: "感情を言葉にする自分",
      body: "感じたことをそのまま言葉にして手渡す自分。まだ出してないだけで、その表現力はこの窓の奥で育ってるよ。",
    },
  };

type Item = {
  key: BigFiveDimension;
  title: string;
  body: string;
};

// ロック時の盲点の窓に敷くデコイ (ぼかし前提の汎用文。実データは使わない)。
// 開放の窓と同じ組版・分量にして、田の字の左右の高さを揃える。
const BLIND_DECOY: Item[] = [
  {
    key: "O",
    title: "気づかれてるやさしさ",
    body: "さりげないフォローに、まわりはちゃんと気づいてる。本人が忘れるくらい自然にやってるからこそ、受け取った側の記憶にはしっかり残ってるんだ。",
  },
  {
    key: "C",
    title: "思った以上のしっかり者",
    body: "自分では当たり前にやってることが、外からは努力と誠実さに見えてる。そのギャップの分だけ、株が上がってるよ。",
  },
  {
    key: "E",
    title: "無自覚ムードメーカー",
    body: "何気ないひと言や笑い方が、思ってる以上に空気を変えてる。本人だけが気づいてない魅力だよ。",
  },
  {
    key: "A",
    title: "バレてる繊細さ",
    body: "表に出してないつもりの一面も、ちゃんと感じ取られてるみたい。それだけ細かい表情まで見てくれてる証拠だよ。",
  },
];

function windowsFrom(self: BigFiveScores, friend: BigFiveScores, viewer: string) {
  const fill = (t: string) => t.replace(/\{v\}/g, viewer);
  const gaps = buildDimensionGaps(self, friend);

  // 開放: 見え方の差が小さい順に4軸。
  const open: Item[] = [...gaps]
    .sort(
      (a, b) =>
        Math.abs(a.otherPercent - a.selfPercent) -
        Math.abs(b.otherPercent - b.selfPercent),
    )
    .slice(0, PER_WINDOW)
    .map((g) => {
      const hi = (g.selfPercent + g.otherPercent) / 2 >= 50;
      const w = WORDS[g.key];
      return {
        key: g.key,
        title: hi ? w.high : w.low,
        body: fill(hi ? OPEN_BODY[g.key].high : OPEN_BODY[g.key].low),
      };
    });

  // 盲点: 強い盲点をギャップ大きい順 → 不足分は友達の回答がくっきりしてた軸のソフト文。
  const blind: Item[] = gaps
    .filter((g) => g.otherPercent - g.selfPercent >= GAP)
    .sort(
      (a, b) =>
        b.otherPercent - b.selfPercent - (a.otherPercent - a.selfPercent),
    )
    .slice(0, PER_WINDOW)
    .map((g) => ({
      key: g.key,
      title: BLIND_TITLE[g.key].high,
      body: fill(BLIND_BODY[g.key]),
    }));
  for (const g of gaps
    .filter((g) => !blind.some((b) => b.key === g.key))
    .sort(
      (a, b) => Math.abs(b.otherPercent - 50) - Math.abs(a.otherPercent - 50),
    )) {
    if (blind.length >= PER_WINDOW) break;
    const hi = g.otherPercent >= 50;
    const w = BLIND_TITLE[g.key];
    blind.push({
      key: g.key,
      title: hi ? w.high : w.low,
      body: fill(hi ? SOFT_BLIND_BODY[g.key].high : SOFT_BLIND_BODY[g.key].low),
    });
  }

  // 秘密: 強い秘密をギャップ大きい順 → 不足分は自己回答がはっきりしてた軸のソフト文。
  const secret: Item[] = gaps
    .filter((g) => g.selfPercent - g.otherPercent >= GAP)
    .sort(
      (a, b) =>
        b.selfPercent - b.otherPercent - (a.selfPercent - a.otherPercent),
    )
    .slice(0, PER_WINDOW)
    .map((g) => ({
      key: g.key,
      title: SECRET_TITLE[g.key].high,
      body: fill(SECRET_BODY[g.key]),
    }));
  for (const g of gaps
    .filter((g) => !secret.some((s) => s.key === g.key))
    .sort(
      (a, b) => Math.abs(b.selfPercent - 50) - Math.abs(a.selfPercent - 50),
    )) {
    if (secret.length >= PER_WINDOW) break;
    const hi = g.selfPercent >= 50;
    const w = SECRET_TITLE[g.key];
    secret.push({
      key: g.key,
      title: hi ? w.high : w.low,
      body: fill(
        hi ? SOFT_SECRET_BODY[g.key].high : SOFT_SECRET_BODY[g.key].low,
      ),
    });
  }

  // 未知: 表に出てる度 (自己+友達の平均) が低い4軸を伸びしろとして。
  const unknown: Item[] = [...gaps]
    .sort(
      (a, b) => a.selfPercent + a.otherPercent - (b.selfPercent + b.otherPercent),
    )
    .slice(0, PER_WINDOW)
    .map((g) => ({
      key: g.key,
      title: UNKNOWN_ITEMS[g.key].title,
      body: fill(UNKNOWN_ITEMS[g.key].body),
    }));

  return { open, blind, secret, unknown };
}

// 窓カード。tone でアクセント色を切り替える (盲点だけ強調)。アイコンは 2026-07-24 指示で廃止。
function WindowCard({
  tone,
  name,
  help,
  children,
}: {
  tone: "green" | "indigo" | "navy" | "gray";
  name: string;
  /** 窓名の隣の ? で見せる説明文。 */
  help: string;
  children: React.ReactNode;
}) {
  const frame =
    tone === "indigo"
      ? "border-2 border-[#5B5BEF] bg-[#F4F4FE]"
      : tone === "gray"
        ? "border border-dashed border-[#D5D8EA] bg-[#FAFAFD]"
        : "border border-[#E3E6F5] bg-white";
  const nameColor =
    tone === "green"
      ? "text-[#2F7D57]"
      : tone === "indigo"
        ? "text-[#5B5BEF]"
        : tone === "gray"
          ? "text-[#8A8AA3]"
          : "text-[#2E2E5C]";
  return (
    <div className={`flex h-full flex-col rounded-2xl p-3.5 md:p-7 ${frame}`}>
      <p
        className={`mb-3 flex items-center gap-1.5 text-[17px] font-black leading-tight md:gap-2 md:text-[24px] ${nameColor}`}
      >
        {name}
        <JohariHelpTip text={help} />
      </p>
      {/* 正方形の余った縦空間の中で中身をセンターに置く */}
      <div className="flex flex-1 flex-col justify-center pb-2 md:pb-6">
        {children}
      </div>
    </div>
  );
}

// 窓ごとのチェックアイコン色 (「関係を深めるヒント」の丸枠チェックと同じ組版)。
const CHECK_COLOR: Record<string, string> = {
  green: "border-[#4CAF7D] text-[#4CAF7D]",
  indigo: "border-[#5B5BEF] text-[#5B5BEF]",
  navy: "border-[#2E2E5C] text-[#2E2E5C]",
  gray: "border-[#B4B7C9] text-[#B4B7C9]",
};

// 田の字の窓内リスト (タイトル + 本文。2026-07-24 指示で本文も載せて余白を埋める)。
function TitleList({
  items,
  muted,
  tone = "green",
}: {
  items: Item[];
  muted?: boolean;
  tone?: "green" | "indigo" | "navy" | "gray";
}) {
  return (
    <ul className="flex flex-col gap-3 md:gap-5">
      {items.map((it) => (
        <li key={it.key}>
          <p
            className={`mb-0.5 flex items-center gap-1.5 text-[12px] font-black leading-snug md:gap-2.5 md:text-[16px] ${
              muted ? "text-[#7A7A96]" : "text-[#2E2E5C]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 md:h-5 md:w-5 ${CHECK_COLOR[tone]}`}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            {it.title}
          </p>
          <p
            className={`body-gothic pl-[22px] text-[11px] leading-[1.65] md:pl-[30px] md:text-[14px] md:leading-[1.7] ${
              muted ? "text-[#8A8AA3]" : "text-[#1A1A1A]"
            }`}
          >
            {it.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function JohariWindow({
  selfScores,
  friendScores,
  viewer,
  locked,
}: {
  selfScores: BigFiveScores;
  friendScores: BigFiveScores;
  /** 「誰から見たか」の表示名 (例 "ゆいさん")。 */
  viewer: string;
  /** tako 未解放 (盲点の窓をぼかす)。 */
  locked: boolean;
}) {
  const { open, blind, secret, unknown } = windowsFrom(
    selfScores,
    friendScores,
    viewer,
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {/* 開放の窓 */}
        <WindowCard
          tone="green"
          name="開放の窓"
          help="自分もその友達も「そうだよね」と認めてる、公認のあなた。ふたりの回答が一致した持ち味だよ。"
        >
          <TitleList items={open} tone="green" />
        </WindowCard>

        {/* 盲点の窓 (課金ゲート) */}
        <WindowCard
          tone="indigo"
          name="盲点の窓"
          help="自分では気づいてないけど、友達には見えてるあなた。友達の回答にだけ強く出た持ち味だよ。"
        >
          {locked ? (
            <div className="relative flex-1">
              {/* デコイ本文 (うっすら読めるぼかし。実本文はサーバで出さない) */}
              <div
                aria-hidden="true"
                className="pointer-events-none select-none blur-[4px]"
              >
                <TitleList items={BLIND_DECOY} tone="indigo" />
              </div>
              {/* ぼかしの中央に解錠ミニカード (/me のロックカードと同トーン)。
                  CTA は最下部の購入カード #tako-promo へスクロール。 */}
              <div className="absolute inset-0 flex items-center justify-center px-2 md:px-6">
                <div className="relative w-full max-w-[280px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] bg-white/95 px-3 pb-4 pt-6 text-center shadow-[0_12px_36px_rgba(46,46,92,0.18)] backdrop-blur-sm md:px-5 md:pb-5 md:pt-7">
                  <span className="absolute -top-3.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white md:-top-4 md:h-8 md:w-8">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                  <p className="mb-1 text-[13px] font-black text-[#2E2E5C] md:text-[15px]">
                    今すぐロックを解除
                  </p>
                  <p className="mb-3 text-[10px] font-bold leading-[1.7] text-[#8A8AA3] md:text-[12px]">
                    {viewer}だけが知ってるアナタが読めるよ。
                  </p>
                  <PaywallScrollButton
                    source="tako_johari_card"
                    targetId="tako-promo"
                    className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-4 py-2.5 text-[11px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4] md:py-3 md:text-[13px]"
                  >
                    今すぐアクセス
                  </PaywallScrollButton>
                </div>
              </div>
            </div>
          ) : (
            <TitleList items={blind} tone="indigo" />
          )}
        </WindowCard>

        {/* 秘密の窓 */}
        <WindowCard
          tone="navy"
          name="秘密の窓"
          help="自分は知ってるけど、友達にはまだ見せてないあなた。自分の回答にだけ強く出た持ち味だよ。"
        >
          <TitleList items={secret} tone="navy" />
        </WindowCard>

        {/* 未知の窓 */}
        <WindowCard
          tone="gray"
          name="未知の窓"
          help="自分も友達もまだ知らない、これから開いていくあなた。診断にはまだ映らない伸びしろだよ。"
        >
          <TitleList items={unknown} muted tone="gray" />
        </WindowCard>
      </div>
    </div>
  );
}
