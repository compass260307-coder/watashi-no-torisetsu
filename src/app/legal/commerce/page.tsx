// プレミアム化 v2 Week 3 T3-2: 特定商取引法に基づく表記 (stub)
//
// Week 5 (T5-2) で本実装に置換予定。現状は購入導線から参照される最小プレースホルダ。
// 計画書 docs/PREMIUM_PLAN.md § 31 を参照。

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | ワタシのトリセツ",
  description:
    "ワタシのトリセツ プレミアム版に関する特定商取引法に基づく表記。",
};

export default function CommercePage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-2xl mx-auto w-full pb-16">
        <header className="mb-8">
          <p className="text-[10px] font-bold tracking-[0.3em] text-primary/70 mb-2">
            LEGAL
          </p>
          <h1 className="font-serif text-2xl font-bold text-foreground leading-snug">
            特定商取引法に基づく表記
          </h1>
        </header>

        <section className="rounded-2xl border-2 border-card-border bg-card-bg p-6 mb-6">
          <p className="text-sm text-foreground leading-relaxed mb-3">
            このページは現在準備中です。
          </p>
          <p className="text-xs text-muted leading-relaxed">
            正式版は β 試遊期間 (Week 5) までに公開予定です。
            それまでに購入のご相談・ご要望がある場合は、公式 LINE トーク
            からお問い合わせください。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-base font-bold text-foreground mb-3">
            概要 (準備中)
          </h2>
          <dl className="text-sm text-foreground leading-relaxed space-y-3">
            <div>
              <dt className="text-xs text-muted">販売事業者</dt>
              <dd>準備中</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">運営責任者</dt>
              <dd>準備中</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">所在地</dt>
              <dd>請求があった場合に遅滞なく開示します</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">連絡先</dt>
              <dd>公式 LINE トーク</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">販売価格</dt>
              <dd>AI 統合トリセツ ¥500 (税込、1 回分)</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">お支払方法</dt>
              <dd>
                クレジットカード / PayPay / コンビニ決済 / Apple Pay /
                Google Pay (Stripe 経由)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">商品の提供方法</dt>
              <dd>
                決済完了後、AI 統合トリセツを生成し Web 画面 + PDF で提供
                (通常 30-90 秒以内に生成完了、最大 3 分)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">返品・キャンセル</dt>
              <dd>
                AI 生成完了後は商品の性質上、返金対象外です。
                生成失敗時のみ、生成日から 7 日以内の申請で返金可能
                (詳細は Week 5 公開の利用規約をご確認ください)。
              </dd>
            </div>
          </dl>
        </section>

        <Link
          href="/integrated/new"
          className="text-xs text-muted underline text-center hover:text-foreground transition-colors"
        >
          ← 統合トリセツ作成画面に戻る
        </Link>
      </main>
    </div>
  );
}
