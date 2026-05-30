"use client";

// Phase 1.5-α Day 12-A: グローバルハンバーガーメニュー (3 項目)
// Phase 1.5-α Day 12-Polish-A: z-index 修正 + 画面ほぼ全体を覆う Koi 風ドロワーに拡大
// Phase 1.5-α Day 12-Polish-A.1: React Portal で document.body 直下にレンダリング
// Phase 1.5-α Day 12-Polish-A.2: メニュー項目を画面の縦中央に配置 (下半分の空白解消)
//   - 親 div は既存 flex flex-col、子 nav に flex-1 + justify-center で縦中央に。
//   - ヘッダー (MENU タイトル + ✕) は nav の上に普通に並ぶ、nav が残り空間を埋める。
//   - 項目間 gap-5 は維持、ドロワー型 (inset-x-2 top-3 bottom-3) も維持。
//
// 背景 (Polish-A.1):
//   Polish-A で z-50 → z-[100] に上げたが、本番で LP のコンテンツ (バブル文字 /
//   マスコット / フローティング CTA) がメニュー overlay を貫通して見える事象が発生。
//   原因: LP の section や統合カード div が transform / backdrop-filter / position:
//   relative + z-index などにより 新しいスタッキングコンテキスト を作っており、
//   HamburgerMenu の overlay (親の中に居る) はその親コンテキスト内の z-[100] にしか
//   なれないため、外の兄弟要素 (別のスタッキングコンテキストを作っている要素) に
//   対して z-index 競争が成立しない。z-[9999] にしても同じ。
//
//   解決: createPortal で overlay を document.body 直下にレンダリングする。
//   body は root スタッキングコンテキストなので、どの z-index でも全てに勝つ。
//
// SSR 対応:
//   Next.js App Router の "use client" でも、初回レンダリング (SSR / 初回ハイドレーション)
//   時には document が存在しないため、useEffect で mounted state を立てて 2 回目以降に
//   Portal を描画する。これで hydration mismatch を避ける。
//
// 含む 3 項目 (Day 12-A 確定、本 PR で変更なし):
//   1. トップ                  → /
//   2. アナタのトリセツ        → myTrisetsuUrl prop
//   3. 友達による評価          → /friend-evaluation
//
// 触らない:
//   - メニュー項目の中身 / 順序 / リンク先
//   - sunYellow CTA スタイル
//   - 開閉動作 (☰ で開く / ✕ / 背景クリックで閉じる)
//   - ☰ / ✕ のグリフ (記号文字、T3-5 対象外)
//   - Polish-A の Koi 風ドロワーレイアウト (画面ほぼ全体、p-8、gap-5、safe-area)

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface HamburgerMenuProps {
  // Server で解決した「自分のトリセツ」URL。未指定なら /diagnosis (未診断ユーザー)。
  myTrisetsuUrl?: string;
}

export function HamburgerMenu({ myTrisetsuUrl }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal の描画先 (document.body) はクライアント側でのみ存在するため、
  // hydration mismatch を避けるため初回マウント完了後にだけ Portal を描画する。
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => setOpen(false);

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="メニュー"
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-modal-fade-in"
      onClick={handleClose}
    >
      <div
        className="absolute inset-x-2 top-3 bottom-3 bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-2xl p-8 flex flex-col animate-modal-slide-up overflow-y-auto"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー: タイトル + ✕ */}
        <div className="flex justify-between items-center mb-8">
          <p className="text-[#3A2D6B]/60 font-black text-xs tracking-[0.3em]">
            MENU
          </p>
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-[#E4E0F5] flex items-center justify-center text-[#3A2D6B] font-black text-base hover:bg-[#FFD6E0] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* メニュー本体 (Polish-A.2: flex-1 + justify-center で残りスペースを縦中央に) */}
        <nav className="flex-1 flex flex-col justify-center gap-5">
          <MenuLink href="/" label="トップ" onClose={handleClose} />
          <MenuLink
            href={myTrisetsuUrl || "/diagnosis"}
            label="アナタのトリセツ"
            onClose={handleClose}
          />
          <MenuLink
            href="/friend-evaluation"
            label="友達による評価"
            onClose={handleClose}
          />
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-label="メニューを開く"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="w-12 h-12 rounded-full bg-white border-2 border-[#3A2D6B] flex items-center justify-center text-[#3A2D6B] font-black text-xl"
      >
        ☰
      </button>

      {/* Portal で document.body 直下に描画 → 親のスタッキングコンテキストから独立 */}
      {open && mounted && createPortal(overlay, document.body)}
    </>
  );
}

function MenuLink({
  href,
  label,
  onClose,
}: {
  href: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="block bg-[#FFE993] text-[#3A2D6B] font-black text-lg px-6 py-5 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all text-center"
    >
      {label}
    </Link>
  );
}
