"use client";

// Phase 3-β D-12: ヘルプ・FAQ タブ (静的コンテンツ、API 不要)
//
// アコーディオン UI で Q&A 展開、お問い合わせ先 + プライバシー/利用規約リンク。

import { useState } from "react";
import Link from "next/link";

type FAQ = { q: string; a: string };

const FAQS: FAQ[] = [
  {
    q: "診断はどれくらい正確？",
    a: "Big Five 理論に基づき、心理学の標準的な評価ツールから設計しています。ただし参考であり、絶対的な判定ではありません。気分や体調で変動するので、再診断もどうぞ。",
  },
  {
    q: "友達評価は何人まで?",
    a: "制限なしです。集めれば集めるほど統合トリセツの精度が向上します。",
  },
  {
    q: "AI 統合トリセツは何回まで?",
    a: "現在は無制限です。Claude AI が文章を生成します。素材の組み合わせを変えるたびに新しいトリセツが履歴に追加されます。",
  },
  {
    q: "データはどう扱われる?",
    a: "プライバシーポリシーに準拠して取り扱います。第三者への提供はありません。詳しくはプライバシーポリシーをご確認ください。",
  },
  {
    q: "退会したい",
    a: "「🗑️ 削除」タブから完全削除できます。LINE bot をブロックするだけでは DB データが残るため、必ず削除タブから実行してください。",
  },
  {
    q: "結果に納得できない",
    a: "自己診断は時々の状態に左右されます。リッチメニュー「🔄 再診断」から何度でも更新可能です。過去の診断とトリセツ図鑑は残ります。",
  },
  {
    q: "友達評価をリセットしたい",
    a: "現在は個別削除に対応していません。完全に消す場合は退会 (削除タブ) で全データ削除となります。",
  },
];

export function HelpFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl bg-label-bg p-5 mb-2">
        <p className="text-sm font-bold mb-2">🎴 ワタシのトリセツ とは</p>
        <p className="text-xs text-muted leading-relaxed">
          Big Five 理論ベースの 32 タイプ性格診断 +
          <br />
          友達評価で他者から見た自分を発見 +
          <br />
          AI 統合で「真のトリセツ」を生成するサービスです。
        </p>
      </section>

      <p className="text-[10px] font-bold tracking-wider text-muted">
        ▼ よくある質問
      </p>

      {FAQS.map((faq, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-card-border bg-card-bg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-bold text-foreground">
                Q. {faq.q}
              </span>
              <span className="text-xs text-muted shrink-0">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-0">
                <p className="text-xs text-muted leading-relaxed">
                  A. {faq.a}
                </p>
              </div>
            )}
          </div>
        );
      })}

      <section className="rounded-2xl border border-card-border bg-card-bg p-4 mt-4">
        <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
          ▼ お問い合わせ
        </p>
        <p className="text-xs text-muted leading-relaxed">
          公式 LINE のメニュー「⚙️ 設定」→ 本ページ
          <br />
          (お問い合わせ機能は準備中、当面はトークでメッセージを送っていただければ確認します)
        </p>
      </section>

      <section className="flex flex-col gap-2 mt-3 text-center">
        <Link
          href="/privacy"
          className="text-xs text-muted underline hover:text-foreground"
        >
          プライバシーポリシー
        </Link>
        <Link
          href="/terms"
          className="text-xs text-muted underline hover:text-foreground"
        >
          利用規約
        </Link>
      </section>
    </div>
  );
}
