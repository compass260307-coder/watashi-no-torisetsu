// ③ 価値訴求 (作り直し): 無料で確実に出る「相互理解度」を主役にした結果見本。
// 旧「真のトリセツ(7章・有料¥500)」訴求は完全撤去。
// 対比2カードの画像は見本 (未ログインLP) として 32キャラ v3 を流用:
//   ワタシから見たワタシ = dolphin_N / 友達から見たワタシ = dog_N (自己と他者で別キャラを視覚化)。
import Image from "next/image";

export function MutualUnderstandingShowcase() {
  return (
    <section className="my-12">
      {/* タグ */}
      <div className="flex justify-center mb-4">
        <div className="bg-[#FFE993] text-[#3A2D6B] px-5 py-2 rounded-full text-base font-black border-2 border-[#3A2D6B] -rotate-2 shadow-[2px_2px_0_#3A2D6B]">
          友達からの評価で
        </div>
      </div>

      {/* 見出し */}
      <h2 className="text-center text-[#3A2D6B] font-black text-xl leading-snug mb-4">
        友達はアナタのこと
        <br />
        どれだけ理解してる?
      </h2>

      {/* 目玉: 相互理解度% (vividPink 枠) */}
      <div className="bg-white border-[3px] border-[#FE3C72] rounded-[20px] px-4 py-5 text-center shadow-[0_4px_16px_rgba(254,60,114,0.12)] mb-4">
        <p className="text-[#FE3C72] font-black text-sm">相互理解度</p>
        <p className="text-[#3A2D6B] font-black leading-none text-6xl my-1">
          73<span className="text-3xl">%</span>
        </p>
        <div className="h-2.5 bg-[#F0ECF8] rounded-full overflow-hidden my-2">
          <div
            className="h-full rounded-full"
            style={{
              width: "73%",
              background: "linear-gradient(90deg,#FE3C72,#FFE993)",
            }}
          />
        </div>
        <p className="text-[#3A2D6B]/80 text-xs font-bold">
          かなり息ぴったり。お互いをよく分かり合えてる。
        </p>
      </div>

      {/* 自己 vs 他者の対比 2カード */}
      <div className="flex gap-3">
        <CompareCard
          src="/characters/v3/dolphin_N.png"
          caption={
            <>
              ワタシから見た
              <br />
              ワタシ
            </>
          }
        />
        <CompareCard
          src="/characters/v3/dog_N.png"
          caption={
            <>
              友達から見た
              <br />
              ワタシ
            </>
          }
        />
      </div>

      {/* 締め */}
      <p className="text-center text-[#3A2D6B] text-sm leading-relaxed mt-4">
        ワタシが思うワタシと、友達から見たワタシ。
        <br />
        <b className="text-[#3A2D6B] font-black">
          そのギャップにこそ、ホントのアナタがいる。
        </b>
      </p>
    </section>
  );
}

function CompareCard({
  src,
  caption,
}: {
  src: string;
  caption: React.ReactNode;
}) {
  return (
    <div className="flex-1 bg-white rounded-2xl p-3.5 text-center shadow-md border-2 border-[#0094D8]/15">
      <div className="aspect-square rounded-xl bg-[#F4F1FB] overflow-hidden mb-2">
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          width={200}
          height={200}
          className="w-full h-full object-cover"
        />
      </div>
      <p className="text-[#3A2D6B] font-bold text-xs leading-tight">{caption}</p>
    </div>
  );
}
