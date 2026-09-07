import Image from "next/image";
import { notFound } from "next/navigation";
import { TypeConstellation } from "@/components/uranai/TypeConstellation";
import { WheelSvg } from "@/components/uranai/NatalChartWheel";
import {
  buildChartView,
  layoutWheel,
  type Chart,
} from "@/lib/unmei/chart-view";

// 課金カード覗き見モーダル（運命の設計図）用の3シーンを撮影する
// ローカル専用ページ。/unmei?preview=ready の出生図・称号カード・鑑定文と同じ
// パーツ／コピーを使い、Alice の撮影ページと同じ 390×500 の画面に収める。
// 長い結果ページの途中を切り取らず、「何が見られるか」が一目で伝わる構図にする。

const PREVIEW_CHART: Chart = {
  planets: {
    sun: { sign: "Leo", degree: 15.2 },
    moon: { sign: "Pisces", degree: 3.4 },
    mercury: { sign: "Virgo", degree: 2.8 },
    venus: { sign: "Gemini", degree: 28.5 },
    mars: { sign: "Virgo", degree: 10.1 },
    jupiter: { sign: "Virgo", degree: 25.9 },
    saturn: { sign: "Cancer", degree: 18.3 },
  },
  asc: { sign: "Scorpio", degree: 12 },
  mc: { sign: "Leo", degree: 22 },
  houses_available: true,
};

const CHART_VIEW = buildChartView(PREVIEW_CHART, {
  timeUnknown: false,
  moonArc: null,
  locale: "ja",
});
const CHART_LAYOUT = CHART_VIEW ? layoutWheel(CHART_VIEW) : null;

const STARS = [
  [8, 11, 1.2, 0.38],
  [20, 24, 0.8, 0.25],
  [84, 16, 1, 0.32],
  [72, 34, 0.7, 0.25],
  [13, 49, 0.7, 0.28],
  [91, 58, 1.1, 0.34],
  [32, 68, 0.8, 0.24],
  [77, 79, 0.7, 0.26],
  [10, 88, 1, 0.3],
] as const;

function SceneBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,#414178_0%,#242447_46%,#17172E_82%)]" />
      {STARS.map(([left, top, size, opacity]) => (
        <span
          key={`${left}-${top}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            opacity,
          }}
        />
      ))}
    </div>
  );
}

function SceneHeader() {
  return (
    <header className="relative z-10 flex h-[64px] flex-none items-center gap-3 border-b border-white/10 bg-[#20203F]/95 px-4">
      <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[#F1ECFF] ring-1 ring-white/15">
        <Image
          src="/mascot/unmei-guide.webp"
          alt=""
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black text-white">運命の設計図</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F5D66B]" />
          あなた専用の鑑定
        </p>
      </div>
      <span className="rounded-full border border-[#F5D66B]/30 bg-[#F5D66B]/10 px-2.5 py-1 text-[9px] font-black tracking-[0.12em] text-[#F5D66B]">
        完成
      </span>
    </header>
  );
}

function SceneFrame({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative flex h-[500px] w-[390px] flex-none flex-col overflow-hidden bg-[#17172E] text-white"
    >
      <SceneBackdrop />
      <SceneHeader />
      {children}
    </section>
  );
}

function NatalChartScene() {
  return (
    <SceneFrame id="scene-1">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-4 pt-4">
        <div className="text-center">
          <p className="text-[9px] font-black tracking-[0.28em] text-[#F5D66B]">
            あなたが生まれた瞬間の空
          </p>
          <h1 className="mt-1 text-[18px] font-black">あなたの出生図</h1>
        </div>

        {CHART_VIEW && CHART_LAYOUT ? (
          <div className="mx-auto mt-1 w-[270px]">
            <WheelSvg
              view={CHART_VIEW}
              L={CHART_LAYOUT}
              essence="寄添者"
            />
          </div>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-[10px] font-bold leading-[1.55] text-white/65">
          <p><span className="text-[#F5D66B]">太陽</span>　獅子座 15.2°</p>
          <p><span className="text-[#F5D66B]">月</span>　魚座 3.4°</p>
          <p><span className="text-[#F5D66B]">金星</span>　双子座 28.5°</p>
          <p><span className="text-[#F5D66B]">上昇宮</span>　蠍座 12.0°</p>
        </div>
      </div>
    </SceneFrame>
  );
}

function IdentityScene() {
  return (
    <SceneFrame id="scene-2">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-5 pb-5 pt-4 text-center">
        <p className="text-[9px] font-black tracking-[0.28em] text-[#F5D66B]">
          あなたの星がくれた称号
        </p>

        <div className="mt-3 w-full rounded-[24px] border border-[#F5D66B]/25 bg-white/[0.05] px-4 pb-5 pt-3 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <TypeConstellation essence="寄添者" characterSlug="jellyfish" />
          <div className="-mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-[#F5D66B]/40" />
            <span className="text-[9px] text-[#F5D66B]">✦</span>
            <span className="h-px w-8 bg-[#F5D66B]/40" />
          </div>
          <p className="mt-2 text-[10px] font-bold tracking-[0.18em] text-white/50">あなたは</p>
          <h2 className="mt-1 bg-gradient-to-b from-[#F9EBB0] via-[#EDD174] to-[#C9A63E] bg-clip-text text-[32px] font-black tracking-[0.12em] text-transparent">
            寄添者
          </h2>
          <p className="mt-1 text-[10px] font-bold text-white/65">きらめきクラゲ ・ 海のタイプ</p>
        </div>

        <p className="mt-4 text-[15px] font-black leading-[1.7]">
          「心に寄り添いながら、世界を知っていく。」
        </p>
        <p className="mt-2 px-2 text-[10px] font-medium leading-[1.8] text-white/58">
          性格診断と星の配置が、別々の道から同じあなたらしさを照らします。
        </p>
      </div>
    </SceneFrame>
  );
}

function TurningPointScene() {
  return (
    <SceneFrame id="scene-3">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-[#F5D66B] text-[14px] font-black text-[#F5D66B]">
            3
          </span>
          <div>
            <p className="text-[9px] font-black tracking-[0.18em] text-[#F5D66B]">YOUR TURNING POINT</p>
            <h1 className="mt-0.5 text-[21px] font-black">これから訪れる転換点</h1>
          </div>
        </div>

        <p className="mt-5 text-[13px] font-bold leading-[1.9] text-white/80">
          あなたの挑戦は、大きく見せることではなく、選ぶことから始まります。
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-[10px] font-black tracking-[0.14em] text-[#F5D66B]">星と診断から見えたこと</p>
          <ul className="mt-3 grid gap-2.5 text-[11px] font-bold leading-[1.7] text-white/70">
            <li className="flex gap-2"><span className="text-[#F5D66B]">✦</span><span>もともとの星は、もっと自由に試したがっている</span></li>
            <li className="flex gap-2"><span className="text-[#F5D66B]">✦</span><span>あなたは、関係を壊さない選び方を積み重ねてきた</span></li>
          </ul>
        </div>

        <div className="relative mt-auto overflow-hidden rounded-2xl bg-gradient-to-r from-[#F5D66B]/20 to-white/[0.06] p-4 pr-16 ring-1 ring-[#F5D66B]/25">
          <p className="text-[10px] font-black tracking-[0.14em] text-[#F5D66B]">今週の小さな一歩</p>
          <p className="mt-1.5 text-[12px] font-bold leading-[1.7] text-white/85">
            頼まれたことへ即答せず、<br />「考えてから返す」と言う。
          </p>
          <div className="absolute bottom-2 right-2 h-14 w-14 overflow-hidden rounded-full bg-[#F1ECFF] ring-2 ring-white/20">
            <Image
              src="/mascot/unmei-guide.webp"
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

export default async function UnmeiPeekScenesPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const requestedScene = (await searchParams).scene;
  const scene = Array.isArray(requestedScene)
    ? requestedScene[0]
    : requestedScene;

  // 単体撮影モード。390×500 のビューポートに画面をぴったり置き、
  // 共通の下部ナビなどがスクショへ入り込まないよう最前面で覆う。
  const singleScene =
    scene === "1" ? (
      <NatalChartScene />
    ) : scene === "2" ? (
      <IdentityScene />
    ) : scene === "3" ? (
      <TurningPointScene />
    ) : null;

  if (singleScene) {
    return (
      <main className="fixed inset-0 z-[200] overflow-hidden bg-[#17172E]">
        <style>{`nextjs-portal { display: none !important; }`}</style>
        {singleScene}
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-start gap-10 bg-[#3A3A6E] p-10">
      <NatalChartScene />
      <IdentityScene />
      <TurningPointScene />
    </main>
  );
}
