// 確認専用: 全32タイプのキャラ結果ビジュアル (画像 + 背景色 + name) を一覧表示する開発/QAページ。
// - NEXT_PUBLIC_THIRTYTWO_ENABLED の状態に関わらず必ず32体出す (フラグを見ない)。
// - DB/トークン/診断フロー不要。character-32.ts のメタデータと public/characters/v3 の画像のみ参照。
// - 背景色は /me ヒーローと同じ「画像の無地背景に一致する色」。現在は各グループ内で統一されているため
//   グループ→色で解決する (未知=#E7DCFB / 空=#FDEFB4 / 海=#BEF2F9 / 陸=#D8F2C0)。
//   ※ /me の HERO_BG_BY_TYPE と整合 (グループ内一律のため一致)。将来グループ内で色を変える場合は要追従。
import Image from "next/image";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";
import {
  thirtyTwoCharacter,
  THIRTY_TWO_ASSET_VERSION,
  type ThirtyTwoGroup,
} from "@/lib/thirty-two-content/character-32";

const GROUP_BG: Record<ThirtyTwoGroup, string> = {
  unknown: "#E7DCFB", // 未知 (紫)
  sky: "#FDEFB4", // 空 (黄)
  sea: "#BEF2F9", // 海 (青)
  land: "#D8F2C0", // 陸 (緑)
};

const GROUP_LABEL: Record<ThirtyTwoGroup, string> = {
  unknown: "未知グループ",
  sky: "空グループ",
  sea: "海グループ",
  land: "陸グループ",
};

const GROUP_ORDER: ThirtyTwoGroup[] = ["unknown", "sky", "sea", "land"];

export default function PreviewAllPage() {
  const ids = allThirtyTwoTypeIds();
  return (
    <main className="min-h-screen bg-white px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="text-[#3A2D6B] font-black text-2xl mb-1">
          全32タイプ プレビュー（確認用）
        </h1>
        <p className="text-[#3A2D6B]/60 text-sm mb-6">
          画像 = public/characters/v{THIRTY_TWO_ASSET_VERSION}/&lt;slug&gt;.png ／
          背景 = 各タイプのヒーロー背景色。診断フロー不要・フラグ非依存の確認専用ページ。
        </p>

        {GROUP_ORDER.map((g) => {
          const list = ids.filter((id) => thirtyTwoCharacter[id].group === g);
          return (
            <section key={g} className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <span
                  aria-hidden
                  className="inline-block w-5 h-5 rounded-full border border-black/10"
                  style={{ background: GROUP_BG[g] }}
                />
                <h2 className="text-[#3A2D6B] font-black text-lg">
                  {GROUP_LABEL[g]}（{list.length}体・{GROUP_BG[g]}）
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {list.map((id) => {
                  const c = thirtyTwoCharacter[id];
                  const src = `/characters/v${THIRTY_TWO_ASSET_VERSION}/${c.slug}.png`;
                  return (
                    <a
                      key={id}
                      href={`/preview/${id}`}
                      className="block rounded-xl overflow-hidden border border-black/10 hover:ring-2 hover:ring-[#3A2D6B]/30 transition"
                    >
                      <div
                        className="aspect-square"
                        style={{ background: GROUP_BG[g] }}
                      >
                        <Image
                          src={src}
                          alt={c.name}
                          width={512}
                          height={512}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="p-2 leading-tight">
                        <div className="text-[#3A2D6B] font-bold text-sm truncate">
                          {c.name}
                        </div>
                        <div className="text-[#3A2D6B]/60 text-[11px] truncate">
                          {c.animal} ／ {c.slug}.png
                        </div>
                        <div className="text-[#3A2D6B]/40 text-[10px] truncate">
                          {id}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
