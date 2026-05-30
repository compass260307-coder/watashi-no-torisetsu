"use client";

// Phase 1.5-α Day 12-A: グローバルハンバーガーメニュー (3 項目)
//
// 背景: これまで LP / /me/[token] / /friend-evaluation のヘッダー右端の ☰ は
// 装飾のみだった (Day 10/11.x の Server Component 内の <button>☰</button>)。
// Day 12 で「友達による評価」ページ A (ハブ) を新設したため、3 項目のメニューを
// オーバーレイ形式で開けるようにする。
//
// 含む 3 項目:
//   1. トップ                  → /
//   2. アナタのトリセツ        → myTrisetsuUrl prop (Server で /me/{ownerToken} を構築、未指定なら /diagnosis)
//   3. 友達による評価          → /friend-evaluation (Day 12-A 新設のハブページ)
//
// 触らない:
//   - メニュー以外のヘッダー要素 (ロゴ、Image 配置)
//   - メニューが置かれる各ページ自体の Server / Client 区分
//   - ☰ / ✕ のグリフ (T3-5「絵文字一切不使用」だが ☰=U+2630, ✕=U+2715 は記号文字のため対象外、既存 me/[token] line 280 でも ☰ をそのまま使用)

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
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-end p-4 animate-modal-fade-in"
          onClick={handleClose}
        >
          <div
            className="mt-4 bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-2xl p-6 min-w-[260px] animate-modal-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-3">
              <button
                type="button"
                aria-label="メニューを閉じる"
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-[#E4E0F5] flex items-center justify-center text-[#3A2D6B] font-black text-base hover:bg-[#FFD6E0] transition-colors"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-3">
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
      className="block bg-[#FFE993] text-[#3A2D6B] font-black text-base px-6 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_3px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all text-center"
    >
      {label}
    </Link>
  );
}
