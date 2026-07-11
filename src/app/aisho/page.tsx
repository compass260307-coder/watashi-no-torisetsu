// 相性診断ページ /aisho
//
// 32タイプから2つ選んで相性を見る、診断不要の回遊コンテンツ。
// 完全静的 (Supabase/セッション/owner_token 不要)。?a=&b= のクエリ駆動でシェア可。
// ロジックは lib/aisho-compat.ts (テーブル直引き・数値化なし)。
// 配色はネイビー #2A3A5C 直書き・非アクティブ #9BA3B4・グループ色は THIRTY_TWO_GROUP_COLOR。
// アイコンは依存ライブラリ不使用・インラインSVG (BottomNav.tsx 流儀)。

"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  allThirtyTwoTypeIds,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoGroup,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { type ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { compat, type AxisKey, type CompatRank } from "@/lib/aisho-compat";
// ★PR4: ④シーン別の本文はサーバゲート (/api/aisho/scenes) 経由でのみ取得する。
//   sceneLines() をクライアント import すると④本文が全部バンドルに載り漏れるため、
//   value import は撤去し、型 (SceneKey) だけ type-only import する (バンドル無害)。
import type { SceneKey } from "@/lib/aisho-scene-copy";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import characterImages from "@/generated/character-images.json";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";

// 結果ページ (/me) と同じブランドネイビーに統一 (旧 #2A3A5C)。
const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";

// 結果ヒーロー帯はランクに関わらず単一のピンクで統一する。
// トーンは /types の性格タイプ背景と同じ淡いパステル (明度86%・彩度61%相当)。
// 淡いので文字は白ではなくネイビー (HERO_TEXT) を乗せる。奥行き用に近い2値グラデ。
const HERO_BAND: [string, string] = ["#FAD3E3", "#F8C9DC"];
const HERO_TEXT = NAVY;

// キャラ画像: /me と同じく背景除去済みの透過版 (characters/cut) を優先し、
// 無いタイプのみ v3 原画へフォールバック (ヒーロー帯に自然に乗せるため)。
function heroImagePath(id: ThirtyTwoTypeId): string {
  const v3 = thirtyTwoImagePath(id);
  const file = v3.split("/").pop() ?? "";
  return characterImages.cut.includes(file) ? `/characters/cut/${file}` : v3;
}

// 相性ランク画像 (S/A/B/C)。public/aisho/ranks/<rank>.png があれば使い、
// 無ければ null (呼び出し側で文字バッジにフォールバック)。
const RANK_IMAGES = new Set(characterImages.ranks as string[]);
function rankImagePath(rank: CompatRank): string | null {
  return RANK_IMAGES.has(rank) ? `/aisho/ranks/${rank}.webp` : null;
}

// カードのサムネ: 顔ズーム版 (characters/face・16P の顔アバター風) があれば優先。
// 無いタイプは v3 原画のまま。face 版は丸抜き、v3 は角丸で表示する。
function faceImagePath(id: ThirtyTwoTypeId): { src: string; isFace: boolean } {
  const v3 = thirtyTwoImagePath(id);
  const file = v3.split("/").pop() ?? "";
  // 空配列だと JSON から never[] に推論されるため string[] に明示キャスト
  return (characterImages.face as string[]).includes(file)
    ? { src: `/characters/face/${file}`, isFace: true }
    : { src: v3, isFace: false };
}

// グループ = base16 の E×O (実データ確認済み)。二軸ラベルは E(外向/内向)×O(感性/現実)。
//   空 E−O＋=内向×感性 / 陸 E＋O−=外向×現実 / 海 E＋O＋=外向×感性 / 未知 E−O−=内向×現実
// 表示順は /types の帯と同じ 海→陸→空→未知。
const GROUP_META: {
  key: ThirtyTwoGroup;
  label: string;
}[] = [
  { key: "sea", label: "海" },
  { key: "land", label: "陸" },
  { key: "sky", label: "空" },
  { key: "unknown", label: "未知" },
];

// /types の帯と同じペール色 (v3 キャラ画像の背景色そのもの) と濃色見出し・斜めカット。
const BAND_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#FDEFB4",
  sea: "#BEF2F9",
  land: "#D8F2C0",
  unknown: "#E7DCFB",
};
// グループ名の文字色 = 各グループ色の濃いバージョン (/types の DARK_COLOR と同じ値。
// 白だとペール帯とのコントラストが足りず読みにくい)。
const DARK_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#8F6B14",
  sea: "#1D6E86",
  land: "#3F7A2E",
  unknown: "#6C4EB8",
};


const ALL_IDS = allThirtyTwoTypeIds();
const VALID = new Set<string>(ALL_IDS);

function isValid(id: string | null): id is ThirtyTwoTypeId {
  return id !== null && VALID.has(id);
}

function sectionId(key: ThirtyTwoGroup): string {
  return `aisho-group-${key}`;
}

// ---- インラインSVG (依存ライブラリ不使用) --------------------------------

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke={NAVY}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// ---- ヘッダーのループ動画 (kling 生成のアイドルループ) ---------------------
// autoplay + muted + loop。prefers-reduced-motion: reduce では再生しない。

function HeroLoopVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="w-full rounded-3xl object-cover"
    >
      <source src="/aisho/hero-loop.mp4" type="video/mp4" />
    </video>
  );
}

// ---- スロット (上部の選択枠) ---------------------------------------------

function Slot({
  id,
  label,
  onClear,
}: {
  id: ThirtyTwoTypeId | null;
  label: string;
  onClear: () => void;
}) {
  // 空/選択済みで高さが変わると選択のたびにレイアウトが揺れるため、両状態とも固定高。
  // 一覧カードと同じ文法: 白カードの上端から顔ズーム版キャラの頭をはみ出させ、
  // 体の切れ目はカード下端に揃えて隠す。名前はカードの下に出す (SP の幅でも破綻しない)。
  const CARD_H = "h-[96px] md:h-[150px]";
  if (!id) {
    return (
      <div className="flex-1">
        <div
          className={`${CARD_H} rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 px-2 text-center`}
          style={{ borderColor: INACTIVE, color: INACTIVE }}
        >
          <span className="text-2xl md:text-3xl leading-none">＋</span>
          <span className="text-xs md:text-sm font-bold">タップで選ぶ</span>
        </div>
        <p
          className="mt-1.5 text-center text-[11px] md:text-xs font-bold"
          style={{ color: INACTIVE }}
        >
          {label}
        </p>
      </div>
    );
  }
  const thumb = faceImagePath(id);
  return (
    <div className="flex-1">
      <div
        className={`relative ${CARD_H} rounded-2xl border-2 bg-white`}
        style={{ borderColor: NAVY }}
      >
        <button
          type="button"
          onClick={onClear}
          aria-label={`${thirtyTwoEssence(id)}を外す`}
          className="absolute top-1.5 right-1.5 z-10 rounded-full p-1 text-white"
          style={{ background: NAVY }}
        >
          <CloseIcon />
        </button>
        {thumb.isFace ? (
          <Image
            src={thumb.src}
            alt={thirtyTwoEssence(id)}
            width={300}
            height={300}
            className="absolute bottom-0 left-1/2 w-[120px] md:w-[190px] max-w-none -translate-x-1/2"
          />
        ) : (
          <Image
            src={thumb.src}
            alt={thirtyTwoEssence(id)}
            width={240}
            height={240}
            className="h-full w-full rounded-[14px] object-cover"
          />
        )}
      </div>
      <p
        className="mt-1.5 md:mt-2.5 text-center font-black text-sm md:text-lg leading-tight"
        style={{ color: NAVY }}
      >
        {thirtyTwoEssence(id)}
      </p>
    </div>
  );
}

// ---- シーンアイコン (インラインSVG・currentColor) -------------------------

function SceneIcon({ scene }: { scene: SceneKey }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (scene) {
    case "love": // heart
      return (
        <svg {...common}>
          <path d="M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" />
        </svg>
      );
    case "friend": // users
      return (
        <svg {...common}>
          <path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3" />
          <path d="M22 19v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
        </svg>
      );
    case "work": // briefcase
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
        </svg>
      );
    case "clash": // alert-circle
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
  }
}

// ---- 結果セクション見出し (/me の丸数字見出しと同じ文法) -------------------

// 見出しは /me (自己診断結果) と同じ 16P 風: 枠線の丸数字 + 大きめ太字タイトル。
function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] text-lg font-black"
        style={{ borderColor: NAVY, color: NAVY }}
      >
        {n}
      </span>
      <h2
        className="text-[30px] font-black leading-tight md:text-[36px]"
        style={{ color: NAVY }}
      >
        {title}
      </h2>
    </div>
  );
}

// ---- 詳細ブロック (バランス / いいところ / 注意 / シーン別) ----------------
// ★将来の購入ゲート単位。%＋★＋サマリー(無料側)とは独立させ、後から
//   購入フラグでこのコンポーネントごとラップできるようにしてある (今回はゲートなし・常時表示)。

// 5軸メーター。/me の BigFiveDivergingBars と同じ視覚言語 (軸色レール + 白丸マーカー +
// 「軸名: %(軸色) 判定」)。ただし相性スコアは 0..1 の一方向 (高いほど噛み合う) なので
// 発散ではなく左→右のフィルにする。軸色は /me と対応させて統一感を出す。
const AXIS_META_VIEW: { key: AxisKey; label: string; color: string }[] = [
  { key: "A", label: "思いやり", color: "#33A474" },
  { key: "N", label: "情緒の安定", color: "#F25E62" },
  { key: "O", label: "価値観", color: "#E4AE3A" },
  { key: "C", label: "生活リズム", color: "#88619A" },
  { key: "E", label: "社交バランス", color: "#4298B4" },
];

// スコア(0..1)→ 判定ラベル。ネガティブに寄せず、低い側も「補い合い」と前向きに。
function matchLabel(v: number): string {
  const p = v * 100;
  if (p >= 85) return "ぴったり";
  if (p >= 65) return "かみ合う";
  if (p >= 45) return "まあまあ";
  return "補い合い";
}

// 相性度(%)→ 総評リードの言い回し。「〇〇と〇〇の相性は{これ}」と続く。
function percentLead(p: number): string {
  if (p >= 90) return "文句なしにいい";
  if (p >= 75) return "かなりいい";
  if (p >= 60) return "なかなかいい";
  if (p >= 45) return "歩み寄り次第でぐっと良くなる";
  return "一筋縄ではいかないぶん、学びが大きい";
}

// ★PR4: SCENE_AXES / sceneVerdict はサーバ (/api/aisho/scenes) へ移設。
//   ④本文 (verdict + text) はクライアントで生成せず、ゲート応答からのみ受け取る。

// 静的な4見出し (SceneKey ごと・内容非依存)。ロック中も「4場面ある」ことを
// 見出しで見せ、本文だけゲートする (見出しは無料・本文だけ課金)。
const SCENE_ORDER: { key: SceneKey; label: string }[] = [
  { key: "love", label: "恋愛では" },
  { key: "friend", label: "友情では" },
  { key: "work", label: "一緒に働くと" },
  { key: "clash", label: "すれ違うとき" },
];

// ④シーン別のサーバゲート応答。locked=true は本文なし (未課金/匿名)。
type ScenesResponse = {
  locked: boolean;
  scenes?: { key: SceneKey; label: string; text: string }[];
};

function CompatDetail({ a, b }: { a: ThirtyTwoTypeId; b: ThirtyTwoTypeId }) {
  const r = useMemo(() => compat(a, b), [a, b]);
  // ④シーン別本文はサーバゲート経由でのみ取得 (未課金/匿名は locked=本文なし)。
  // ①〜③・ランクはこの fetch に依存せず即時表示 (バイラル核は無傷)。
  // ペアkeyで保持し、a/b 変更時は key 不一致で sceneData が自動的に null(=読込中)に戻る
  // (effect 内 setState を避けるため、リセットは派生値で表現する)。
  const pairKey = `${a}__${b}`;
  const [sceneState, setSceneState] = useState<{
    key: string;
    resp: ScenesResponse;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/aisho/scenes?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`)
      .then((res) =>
        res.ok
          ? (res.json() as Promise<ScenesResponse>)
          : ({ locked: true } as ScenesResponse),
      )
      .then((resp) => {
        if (!cancelled) setSceneState({ key: pairKey, resp });
      })
      .catch(() => {
        if (!cancelled) setSceneState({ key: pairKey, resp: { locked: true } });
      });
    return () => {
      cancelled = true;
    };
  }, [a, b, pairKey]);
  // 現在のペアに対応する応答だけ採用 (古いペアの応答・読込中は null)。
  const sceneData: ScenesResponse | null =
    sceneState?.key === pairKey ? sceneState.resp : null;
  const sceneUnlocked = sceneData?.locked === false;
  const sceneByKey = useMemo(() => {
    const m = new Map<SceneKey, string>();
    sceneData?.scenes?.forEach((s) => m.set(s.key, s.text));
    return m;
  }, [sceneData]);
  // /me と同じ本文タイポ (body-gothic・濃色・17px)。段落はこの class を使い回す。
  const PROSE =
    "body-gothic text-[#1A1A1A] font-normal text-[16px] md:text-[17px] leading-[1.7]";
  const nameA = thirtyTwoEssence(a);
  const nameB = thirtyTwoEssence(b);
  return (
    // 幅は自己診断結果 (/me) と同じ親 (max-w-[1080px]) いっぱいまで使う (旧 640 撤廃)。
    <div className="mx-auto mt-8 w-full space-y-9 md:space-y-11">
      {/* ⓪ 相性の総評 (長文リード)。★・サマリー・%バッジは廃し、compat の
          summary/percent/goods を地の文へ織り込んで「〇〇と〇〇の相性は〜」から
          始まる長めの文章にする。 */}
      <div>
        <p className={PROSE}>
          {`「${nameA}」と「${nameB}」の相性は${percentLead(r.percent)}。相性度は${r.percent}%、いわば${r.summary}と呼べるふたりだよ。数字だけじゃなく、ふたりの関係にはちゃんと長く続く理由があるみたい。`}
        </p>
        <p className={`${PROSE} mt-4`}>
          {"だからこそ、いっしょにいると自然体でいられて、無理に合わせようとしなくても心地いい時間が続きやすいはず。もちろん、ずっと仲よくいるためのちょっとしたコツもある。ここからは、思いやり・情緒・価値観・生活リズム・社交バランスの5つの視点で、ふたりの相性をもう少しくわしく見ていくよ。"}
        </p>
      </div>

      {/* ① ふたりのバランス (5軸メーター・/me の BigFiveDivergingBars と同じ見た目) */}
      <section>
        <SectionHeading n={1} title="ふたりのバランス" />
        <div className="space-y-6 rounded-2xl border border-[#E3E6F5] bg-white p-5 md:p-7">
          {AXIS_META_VIEW.map(({ key, label, color }) => {
            const v = r.s[key];
            const pct = Math.round(v * 100);
            const lab = matchLabel(v);
            return (
              <div key={key}>
                <span className="sr-only">{`${label}：${lab} ${pct}%`}</span>
                {/* 上段: 軸名: %(軸色) 判定 */}
                <div
                  aria-hidden="true"
                  className="mb-2 flex items-baseline gap-1.5"
                >
                  <span className="text-[15px] font-bold" style={{ color: NAVY }}>
                    {label}:
                  </span>
                  <span
                    className="text-[15px] font-black tabular-nums"
                    style={{ color }}
                  >
                    {pct}%
                  </span>
                  <span className="text-[15px] font-bold" style={{ color: NAVY }}>
                    {lab}
                  </span>
                </div>
                {/* 中段: 左→右の一方向フィル + 白丸マーカー */}
                <div aria-hidden="true" className="relative h-4 w-full">
                  <div
                    className="absolute inset-0 overflow-hidden rounded-full"
                    style={{ background: `${color}2E` }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <div
                    className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-500"
                    style={{ left: `${pct}%`, border: `4px solid ${color}` }}
                  />
                </div>
                {/* 下段: 両端ラベル (どちらも前向き表現) */}
                <div
                  aria-hidden="true"
                  className="mt-1.5 flex justify-between text-[12px] font-bold leading-tight"
                  style={{ color: `${NAVY}8C` }}
                >
                  <span>補い合う</span>
                  <span>ぴったり</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ② ふたりのいいところ (goods を /me 風の地の文で) */}
      <section>
        <SectionHeading n={2} title="ふたりのいいところ" />
        <p className={PROSE}>
          {`このふたりがいっしょにいて心地いいのには、ちゃんと理由があるよ。${r.goods[0]}`}
        </p>
        <p className={`${PROSE} mt-3`}>{r.goods[1]}</p>
      </section>

      {/* ③ ここだけ注意 (caution を前後の一言で挟んで文章量を足す) */}
      <section>
        <SectionHeading n={3} title="ここだけ注意" />
        <p className={PROSE}>
          {`どんなに相性がよくても、長く心地よくいるためのコツはある。むしろ仲がいいふたりほど、遠慮がなくなって小さなすれ違いを見落としがちなんだよね。${r.caution}`}
        </p>
        <p className={`${PROSE} mt-3`}>
          {"大事なのは、我慢して溜め込まないこと。違和感は小さいうちに「こう感じたんだよね」と軽く言葉にしておくと、大きくこじれる前に自然とほどけていく。逆に「言わなくても察してほしい」を続けると、どんなにいい相性でも少しずつずれていくから注意。ここさえ頭の片隅に置いておけば、ふたりの良さはもっと素直に出てくるはずだよ。"}
        </p>
      </section>

      {/* ④ シーン別トリセツ (恋愛/友情/働く/すれ違い)。★PR4: 課金ゲート。
          見出し(4場面)は常に表示し「4場面ぶんのトリセツがある」ことを予告。
          本文だけをサーバゲート → 未課金/匿名は本文をぼかしダミー(実本文なし)にし、
          最下部の課金カードへスライドする「ぜんぶ、ひらく →」を出す。
          ①〜③・相性度・ランクは触っていない (全員無料=バイラル核)。 */}
      <section>
        <SectionHeading n={4} title="シーン別トリセツ" />
        <p className={PROSE}>
          {"恋愛・友情・仕事・すれ違い。場面ごとに、ふたりのトリセツをまとめたよ。"}
        </p>
        <div className="mt-6 space-y-7">
          {SCENE_ORDER.map((s) => (
            <div key={s.key}>
              {/* 見出しは無料 (ぼかさない): 4場面の存在感を伝える */}
              <div
                className="mb-1.5 flex items-center gap-1.5 text-[18px] font-black"
                style={{ color: NAVY }}
              >
                <SceneIcon scene={s.key} />
                <span>{s.label}</span>
              </div>
              {sceneUnlocked ? (
                <p className={PROSE}>{sceneByKey.get(s.key)}</p>
              ) : (
                /* 本文だけぼかし (未課金/読込中)。実本文は載っていない。 */
                <div aria-hidden="true" className="select-none space-y-2.5 py-1">
                  {[97, 100, 82].map((w, i) => (
                    <div
                      key={i}
                      className="h-3.5 rounded-full bg-[#E7E7F0] blur-[3px]"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ロック確定時のみ CTA (読込中は出さない=課金済のちらつき防止)。
            押すと最下部の課金カードへスライド (PR3 の scrollToPaywall 流用)。
            匿名がカードCTAを押すと 401→トップ funnel (診断/ログイン→課金)。 */}
        {sceneData?.locked === true && (
          <div className="mt-7 rounded-3xl bg-[#F7F7FB] px-5 py-7 text-center">
            <p className="text-[15px] font-black leading-[1.6] text-[#2E2E5C]">
              4場面ぶんのシーン別トリセツは
              <br />
              全解放でひらきます。
            </p>
            <p className="mt-2 text-[13px] font-bold leading-[1.6] text-[#8A8AA3]">
              一度きりの ¥299 で、
              <br className="md:hidden" />
              恋愛も友情も仕事も、ぜんぶ。
            </p>
            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={scrollToPaywall}
                className="flex w-full max-w-[300px] items-center justify-center rounded-full bg-[#2E2E5C] px-6 py-3.5 text-base font-black text-white shadow-[0_4px_0_#1b1b3e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e]"
              >
                ぜんぶ、ひらく →
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---- 結果ブロック ---------------------------------------------------------
// /me ヒーローと同じ文法: グループ色の全幅帯 + 白抜きの大% + 斜めカットで白へ接続。

function ResultBlock({ a, b }: { a: ThirtyTwoTypeId; b: ThirtyTwoTypeId }) {
  const r = useMemo(() => compat(a, b), [a, b]);
  const [band0, band1] = HERO_BAND;
  // 淡いピンク帯なのでドットは白ではなく濃いローズを薄く乗せる。
  const dotColor = "rgba(214,120,158,0.35)";
  const rankImg = rankImagePath(r.rank);
  return (
    <section>
      {/* ===== ヒーロー帯 (全幅・単一ピンク・斜めカット) ===== */}
      <div
        className="relative mx-[calc(50%-50vw)] w-screen overflow-hidden"
        style={{
          background: `linear-gradient(105deg, ${band0} 0%, ${band1} 100%)`,
        }}
      >
        {/* 上部中央の放射状グロー + フェルトドット (/me と同じ装飾) */}
        {/* グローは控えめに (強すぎると帯上部が白飛びして白ラベルが読めなくなる) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[240px]"
          style={{
            background:
              "radial-gradient(ellipse at top center, rgba(255,255,255,0.28) 0%, transparent 60%)",
          }}
        />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 10, height: 10, top: "14%", left: "7%" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 7, height: 7, top: "40%", left: "12%" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 12, height: 12, top: "18%", right: "8%" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 7, height: 7, top: "52%", right: "13%" }} />

        {/* SP: 「二人の相性」ラベル → ランク画像の縦積み・中央寄せ。
            PC: 左に大きな「二人の相性」テキスト / 右にランク画像の横並び。
            ランク画像が未配置のあいだは大きな文字バッジにフォールバックする。 */}
        <div className="relative mx-auto flex max-w-[1080px] flex-col items-center px-4 pt-8 pb-6 text-center md:flex-row md:justify-between md:gap-8 md:px-8 md:pt-12 md:pb-8 md:text-left">
          <p className="text-[24px] font-black tracking-[0.22em] text-white md:text-[60px] md:leading-[1.2] md:tracking-[0.04em]">
            ふたりの相性
          </p>
          <div className="mt-4 md:mt-0 md:shrink-0">
            {/* 透過 PNG (装飾) は unoptimized で直接配信する。
                dev の画像 optimizer がこの手の PNG で固まりローディングが終わらないため。 */}
            {rankImg ? (
              <Image
                src={rankImg}
                alt={`相性ランク ${r.rank}`}
                width={512}
                height={512}
                unoptimized
                priority
                className="w-[80vw] max-w-[500px] md:w-[560px] md:max-w-[52vw] object-contain"
              />
            ) : (
              <span
                className="block text-[52vw] md:text-[280px] font-black leading-none"
                style={{ color: HERO_TEXT }}
              >
                {r.rank}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- 詳細 (将来ゲート単位・今回は常時表示) --- */}
      <CompatDetail a={a} b={b} />
    </section>
  );
}

// ---- グループ別グリッド ---------------------------------------------------

function TypeGrid({
  onPick,
  selected,
}: {
  onPick: (id: ThirtyTwoTypeId) => void;
  selected: Set<string>;
}) {
  const grouped = useMemo(
    () =>
      GROUP_META.map((g) => ({
        ...g,
        ids: ALL_IDS.filter((id) => thirtyTwoGroup(id) === g.key),
      })),
    [],
  );

  return (
    // 全幅色帯をそのまま積む (帯どうしの境界は水平)。
    <div className="mt-10 md:mt-14">
      {grouped.map((g, gi) => {
        const isLast = gi === grouped.length - 1;
        return (
          <section
            key={g.key}
            id={sectionId(g.key)}
            aria-label={`${g.label}グループ`}
            className="relative mx-[calc(50%-50vw)] w-screen"
            style={{ backgroundColor: BAND_COLOR[g.key] }}
          >
            {/* 列数は 2列 (SP) / 4列 (md 以上) のみ。1行8枚や3列は不自然なので使わず、
                画面幅にはカードの大きさ (可変カラム幅 + 大画面は max-w 拡大) で追従する */}
            {/* 最終帯はページ末尾 (下の白を無くし紫で終える) なので、
                固定ボトムナビに最終行が隠れないぶんの下余白を足す */}
            <div
              className={`mx-auto max-w-[1080px] px-4 md:px-8 2xl:max-w-[1400px] pt-9 md:pt-11 ${
                isLast ? "pb-20 md:pb-24" : "pb-12 md:pb-14"
              }`}
            >
              <h2
                className="font-black text-[28px] md:text-[36px] leading-none mb-4 md:mb-5"
                style={{ color: DARK_COLOR[g.key] }}
              >
                {g.label}グループ
              </h2>
              {/* 行間 (gap-y) は頭のはみ出し (約16px) が上のカードに触れない広さにする */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4 md:gap-x-4 md:gap-y-7">
                {g.ids.map((id) => {
                  const isSel = selected.has(id);
                  const thumb = faceImagePath(id);
                  if (thumb.isFace) {
                    /* 顔ズーム版 (透過): 台座は置かず、キャラの頭を白カードの
                       上端からはみ出させる (背面のグループ色帯に頭が重なる)。
                       体の四角い切れ目はカード下端に揃えて見えなくする。
                       画像の左端はカードの角丸 (r=16px) が終わる x=16px に置き、
                       下端フラッシュでも角がカード外にはみ出さないようにする。 */
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onPick(id)}
                        disabled={isSel}
                        aria-pressed={isSel}
                        className="relative flex h-[60px] md:h-[68px] items-center rounded-2xl bg-white pl-[96px] md:pl-[112px] pr-3 text-left transition-opacity shadow-[0_2px_10px_rgba(42,58,92,0.08)]"
                        style={{
                          border: isSel
                            ? `2px solid ${NAVY}`
                            : "2px solid transparent",
                          opacity: isSel ? 0.45 : 1,
                        }}
                      >
                        <Image
                          src={thumb.src}
                          alt={thirtyTwoEssence(id)}
                          width={168}
                          height={168}
                          className="absolute bottom-0 left-4 w-[72px] md:w-[84px] max-w-none"
                        />
                        {/* 役職名は画像を除いた残り幅の中央に置く */}
                        <span
                          className="flex-1 text-center font-black text-sm md:text-[15px] leading-tight"
                          style={{ color: NAVY }}
                        >
                          {thirtyTwoEssence(id)}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onPick(id)}
                      disabled={isSel}
                      aria-pressed={isSel}
                      className="rounded-2xl bg-white flex items-center gap-3 px-3 py-2 md:px-4 md:py-3 transition-opacity text-left shadow-[0_2px_10px_rgba(42,58,92,0.08)]"
                      style={{
                        border: isSel
                          ? `2px solid ${NAVY}`
                          : "2px solid transparent",
                        opacity: isSel ? 0.45 : 1,
                      }}
                    >
                      <Image
                        src={thumb.src}
                        alt={thirtyTwoEssence(id)}
                        width={96}
                        height={96}
                        className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover shrink-0"
                      />
                      <span
                        className="font-black text-sm md:text-[15px] leading-tight"
                        style={{ color: NAVY }}
                      >
                        {thirtyTwoEssence(id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---- 本体 -----------------------------------------------------------------

function AishoInner() {
  const searchParams = useSearchParams();
  // 初期値は ?a=&b= から (遅延初期化。effect内setStateを避ける)
  const [slotA, setSlotA] = useState<ThirtyTwoTypeId | null>(() => {
    const a = searchParams.get("a");
    return isValid(a) ? a : null;
  });
  const [slotB, setSlotB] = useState<ThirtyTwoTypeId | null>(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    return isValid(b) && b !== a ? b : null;
  });
  // 2枠そろっても即表示せず、「相性を見る」を押して初めて結果を出す（ワンクッション）。
  // 直リンク(?a=&b= 両方あり)は共有先で結果を見せたいので初期 revealed=true。
  const [revealed, setRevealed] = useState(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    return isValid(a) && isValid(b) && a !== b;
  });
  // 選択操作で2枠そろった直後の「診断中…」演出 (直リンクでは出さない)。
  const [analyzing, setAnalyzing] = useState(false);
  useEffect(() => {
    if (!analyzing) return;
    const t = setTimeout(() => {
      setAnalyzing(false);
      setRevealed(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [analyzing]);

  const bothFilled = slotA !== null && slotB !== null;
  const resultShown = bothFilled && revealed;
  const resultRef = useRef<HTMLDivElement>(null);

  // 選択変更で URL を書き換え (直リンク・シェア可)
  const syncUrl = useCallback((a: string | null, b: string | null) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, []);

  const selected = useMemo(() => {
    const s = new Set<string>();
    if (slotA) s.add(slotA);
    if (slotB) s.add(slotB);
    return s;
  }, [slotA, slotB]);

  const pick = useCallback(
    (id: ThirtyTwoTypeId) => {
      // 選ぶだけでは診断しない。2枠そろうと CTA「相性を見る」が押せるようになり、
      // 押した時に「診断中…」演出 → 結果表示。
      if (slotA === null) {
        setSlotA(id);
        syncUrl(id, slotB);
      } else if (slotB === null && id !== slotA) {
        setSlotB(id);
        syncUrl(slotA, id);
      }
    },
    [slotA, slotB, syncUrl],
  );

  const clearA = useCallback(() => {
    setSlotA(null);
    syncUrl(null, slotB);
    setRevealed(false);
    setAnalyzing(false);
  }, [slotB, syncUrl]);

  const clearB = useCallback(() => {
    setSlotB(null);
    syncUrl(slotA, null);
    setRevealed(false);
    setAnalyzing(false);
  }, [slotA, syncUrl]);

  // 結果が現れたらそこへスクロール（「相性を見る」tap・直リンク両対応）
  useEffect(() => {
    if (resultShown) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resultShown]);

  return (
    <>
    <TopHeader />
    <main className="min-h-screen overflow-x-clip bg-white">
      {/* コンテンツ幅は自己診断結果 (/me) と同じ max-w-[1080px] に揃える。
          結果表示中は /me 同様ヒーロー帯をヘッダー直下から始めるため上余白なし */}
      <div
        className={`max-w-[1080px] mx-auto px-4 md:px-8 ${
          resultShown || analyzing ? "" : "pt-6 md:pt-10"
        }`}
      >
        {analyzing && slotA && slotB ? (
          /* ===== 診断中演出 (約1.6秒): 2キャラ対面 + 鼓動するハート ===== */
          /* ヘッダー(約72px)を除いた高さいっぱいで縦中央に。SP はキャラ幅を
             抑えて2体+ハートが横に収まるようにする (見切れ防止)。 */
          <div className="flex min-h-[calc(100dvh-72px)] flex-col items-center justify-center">
            <div className="flex w-full items-center justify-center gap-3 md:gap-12">
              <Image
                src={heroImagePath(slotA)}
                alt={thirtyTwoEssence(slotA)}
                width={360}
                height={360}
                className="w-[34vw] max-w-[240px] object-contain"
              />
              <span
                className="animate-pulse shrink-0"
                style={{ color: NAVY }}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-9 w-9 md:h-[52px] md:w-[52px]"
                  fill="currentColor"
                >
                  <path d="M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" />
                </svg>
              </span>
              <Image
                src={heroImagePath(slotB)}
                alt={thirtyTwoEssence(slotB)}
                width={360}
                height={360}
                className="w-[34vw] max-w-[240px] object-contain"
              />
            </div>
            <p
              className="mt-10 text-[19px] md:text-[22px] font-black"
              style={{ color: NAVY }}
              role="status"
            >
              ふたりの相性を診断中…
            </p>
          </div>
        ) : resultShown ? (
          /* ===== 結果モード (一覧は畳む) ===== */
          <>
            {/* scroll-mt は sticky ヘッダー (72px) の高さぶん確保する。
                足りないとヒーロー上部のラベルがヘッダーの裏に隠れる */}
            <div ref={resultRef} className="scroll-mt-[72px]">
              <ResultBlock a={slotA} b={slotB} />
            </div>
            <div className="flex justify-center mt-10 pb-3">
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="inline-flex items-center justify-center gap-2 rounded-full px-16 py-3.5 font-black text-base text-white"
                style={{ background: NAVY }}
              >
                相性を再度診断
              </button>
            </div>
          </>
        ) : (
          /* ===== 選択モード ===== */
          <>
            {/* ヘッダー: 左=見出し / 右=ループ動画 (16P のセクション見出し文法)。
                SP は縦積み (見出し→動画→スロット)。 */}
            <header className="mb-7 md:mb-12 md:flex md:items-center md:gap-12">
              <div className="md:flex-1">
                <h1
                  className="font-black text-[29px] md:text-[36px] leading-[1.45] md:leading-[1.4]"
                  style={{ color: NAVY }}
                >
                  気になるあの子との
                  <br className="md:hidden" />
                  相性を、
                  <br className="hidden md:block" />
                  診断してみよう。
                </h1>
                <p
                  className="mt-2.5 text-[12.5px] md:text-sm font-bold"
                  style={{ color: INACTIVE }}
                >
                  2キャラを選ぶだけ・自分の診断がなくてもOK
                </p>
              </div>
              <div className="mt-5 md:mt-0 md:w-[46%] md:max-w-[620px] md:shrink-0">
                <HeroLoopVideo />
              </div>
            </header>

            {/* 上部スロット: 結果ヒーローと同じ「2キャラ対面 + ハート」の文法。
                PC では小さな点線ボックスが余白に浮いて見えたため、一回り大きくする */}
            <div className="mx-auto flex max-w-[560px] md:max-w-[860px] items-stretch gap-3 md:gap-8">
              <Slot id={slotA} label="1人目" onClear={clearA} />
              {/* ハートはカード (名前ラベルを除く) の縦中央に合わせる */}
              <span
                className="self-start mt-[38px] md:mt-[65px] shrink-0"
                style={{ color: NAVY }}
                aria-hidden="true"
              >
                <HeartIcon />
              </span>
              <Slot id={slotB} label="2人目" onClear={clearB} />
            </div>

            {/* CTA: 2キャラそろうまでは薄色 (disabled)、そろったら押せる */}
            <div className="flex justify-center mt-6 md:mt-8">
              <button
                type="button"
                onClick={() => setAnalyzing(true)}
                disabled={!bothFilled}
                className="rounded-full px-12 py-3 md:px-14 md:py-3.5 text-white font-black text-base md:text-lg shadow-sm transition-all disabled:cursor-not-allowed"
                style={{
                  background: NAVY,
                  opacity: bothFilled ? 1 : 0.35,
                }}
              >
                相性を診断する
              </button>
            </div>

            {/* グループ別グリッド */}
            <TypeGrid onPick={pick} selected={selected} />
          </>
        )}
      </div>
    </main>
    {/* PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。
        /aisho は匿名(セッション無し)なので、未ログインの購入クリックは
        FullAccessCta 既定で 401→トップへ funnel (アカウント作成→課金の橋渡し)。
        相性①〜④は従来どおり無料・ここではゲートしない。 */}
    <FullAccessPromoCard />
    {/* フッターは常時表示 (選択モード・結果表示とも)。
        幅は TopFooter 内部で自己診断結果 (/me) と同じ max-w-[1080px] に統一済み。 */}
    <TopFooter />
    </>
  );
}

export default function AishoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-sm font-bold" style={{ color: INACTIVE }}>
            読み込み中…
          </p>
        </main>
      }
    >
      <AishoInner />
    </Suspense>
  );
}
