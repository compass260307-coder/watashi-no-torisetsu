"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { SmoothImage } from "@/components/ui/SmoothImage";

// 記事一覧のカテゴリー絞り込み + カードグリッド (16Personalities の記事ハブ風)。
// 絞り込みはクライアント側の state のみ (URL は変えない)。初期表示は「すべて」で
// 全記事が SSR された HTML に含まれるため、SEO とページの静的生成を損なわない。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

const ALL = "すべて";

export type ArticleCard = {
  slug: string;
  listTitle: string;
  description: string;
  category: string;
  published: string;
  image: string;
  imageAlt: string;
};

export function ArticleGrid({
  articles,
  categories,
}: {
  articles: ArticleCard[];
  /** 表示順のカテゴリー一覧 (記事が1本以上あるものだけ渡す) */
  categories: string[];
}) {
  const [selected, setSelected] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const options = [ALL, ...categories];
  const visible =
    selected === ALL
      ? articles
      : articles.filter((a) => a.category === selected);

  return (
    <div style={{ fontFamily: FONT_STACK }}>
      {/* カテゴリー: ドロップダウン */}
      <div className="mt-8 flex items-center gap-4">
        <p className="shrink-0 text-[14px] font-bold" style={{ color: NAVY }}>
          カテゴリー:
        </p>
        <div
          ref={rootRef}
          className="relative w-full max-w-[320px]"
          onBlur={(e) => {
            // ドロップダウン外へフォーカスが抜けたら閉じる
            if (!rootRef.current?.contains(e.relatedTarget as Node)) {
              setOpen(false);
            }
          }}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listboxId}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border-2 bg-white px-5 py-3 text-left text-[14px] font-bold transition-colors hover:border-[#5B5BEF]"
            style={{ borderColor: "#E3E6F5", color: NAVY }}
          >
            {selected}
            <span
              aria-hidden
              className={`text-[11px] transition-transform ${open ? "rotate-180" : ""}`}
              style={{ color: `${NAVY}80` }}
            >
              ▼
            </span>
          </button>
          {open && (
            <ul
              id={listboxId}
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border-2 bg-white py-1 shadow-[0_8px_24px_rgba(46,46,92,0.14)]"
              style={{ borderColor: "#E3E6F5" }}
            >
              {options.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(opt);
                      setOpen(false);
                    }}
                    className="w-full px-5 py-2.5 text-left text-[14px] font-bold transition-colors hover:bg-[#F4F4FE]"
                    style={{ color: opt === selected ? SORA : NAVY }}
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* カードグリッド */}
      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((a) => (
          <li key={a.slug} className="h-full">
            <Link
              href={`/articles/${a.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(46,46,92,0.10)] transition-shadow hover:shadow-[0_4px_20px_rgba(46,46,92,0.18)]"
            >
              {/* 上部イラスト (フェルト調シーン)。淡い背景で切り抜き感をなくす */}
              <div
                className="flex items-center justify-center px-6 pt-6"
                style={{ backgroundColor: "#F4F4FE" }}
              >
                <SmoothImage
                  src={a.image}
                  alt={a.imageAlt}
                  width={724}
                  height={543}
                  className="h-auto w-full max-w-[300px]"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p
                  className="text-[11px] font-bold tracking-wide"
                  style={{ color: SORA }}
                >
                  {a.category}
                </p>
                <h2
                  className="mt-1.5 text-[17px] font-bold leading-snug"
                  style={{ color: NAVY }}
                >
                  {a.listTitle}
                </h2>
                <p
                  className="mt-2 line-clamp-3 flex-1 text-[13px] leading-[1.9]"
                  style={{ color: `${NAVY}B3` }}
                >
                  {a.description}
                </p>
                <span className="mt-5 inline-block w-fit rounded-full border-2 border-[#5B5BEF] px-5 py-2 text-[13px] font-bold text-[#5B5BEF] transition-colors group-hover:bg-[#5B5BEF] group-hover:text-white">
                  記事を見る →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
