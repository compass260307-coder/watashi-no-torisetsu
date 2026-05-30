"use client";

// Phase 1.5-α Day 12-A: グローバルハンバーガーメニュー (3 項目)
// Phase 1.5-α Day 12-Polish-A: z-index 修正 + 画面ほぼ全体を覆う Koi 風ドロワーに拡大
//
// 修正内容 (Polish-A):
//   - z-50 → z-[100] (overlay) / inner-card は親で覆われる
//     → マスコット画像 (z-30 など) や FloatingCTABar (z-40/50) より確実に上に来る
//   - 中身カード: min-w-[260px] → 画面ほぼ全体 (inset-x-2 top-3 bottom-3) を占有する Koi 風ドロワー
//   - 内部 padding 増 (p-6 → p-8) + 項目間 gap-3 → gap-5 でゆったり配置
//   - iOS safe-area: paddingBottom: env(safe-area-inset-bottom)
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

import { useState } from "react";
import Link from "next/link";

interface HamburgerMenuProps {
  // Server で解決した「自分のトリセツ」URL。未指定なら /diagnosis (未診断ユーザー)。
  myTrisetsuUrl?: string;
}

export function HamburgerMenu({ myTrisetsuUrl }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const handleClose = () => setOpen(false);

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

      {open && (
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

            {/* メニュー本体 (ゆったり配置) */}
            <nav className="flex flex-col gap-5">
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
      )}
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
