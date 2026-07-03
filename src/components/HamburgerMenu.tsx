"use client";

// Phase 1.5-α Day 12-A: グローバルハンバーガーメニュー (3 項目)
// Phase 1.5-α Day 12-Polish-A: z-index 修正 + 画面ほぼ全体を覆う Koi 風ドロワーに拡大
// Phase 1.5-α Day 12-Polish-A.1: React Portal で document.body 直下にレンダリング
// Phase 1.5-α Day 12-Polish-A.2: メニュー項目を画面の縦中央に配置 (下半分の空白解消)
// Phase 1.5-α Day 12-Polish-A.3: ドロワー型を諦め、カード高さを内容に合わせる
//   - inset-x-2 top-3 bottom-3 (画面全体ドロワー) → inset-x-2 top-3 (高さ自動)
//   - Polish-A.2 で入れた flex-1 / justify-center は撤去 (中身に合った高さなので不要)
//   - 結果: 上から自然に開く小〜中サイズのメニュー、下の空白が消える
//   - 内部 padding (p-8) / safe-area / z-[100] / React Portal は維持
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
// 含む項目 (ヘッダー TopHeader のナビ構成と揃える + アプリ内専用 2 項目):
//   1. トップ              → /
//   2. ワタシのトリセツ    → myTrisetsuUrl prop (未指定なら /result 経由で自分の /me に解決)
//   3. 性格診断テスト      → /diagnosis
//   4. 他己診断テスト      → /friend-evaluation (旧表記: 相互理解度)
//   5. 性格タイプ          → /zukan/all
//   6. サービスについて    → /about
//   7. ログイン            → /login
//
// Day 12-Polish: PC でのオーバーレイ幅を max-w-[480px] に制限 + 中央寄せ、
//   ☰ トグルをブランドの chunky ボタン化 (sunYellow ソリッド + 太枠 + オフセット影 + 太線 SVG)、
//   項目ラベル/リンク先を更新 (ワタシのトリセツ→/me、相互理解度→/friend-evaluation)。
//
// 触らない:
//   - sunYellow CTA(MenuLink) スタイル
//   - 開閉動作 (☰ で開く / ✕ / 背景クリックで閉じる)
//   - Portal レンダリング (document.body 直下) と SSR mounted ガード

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface HamburgerMenuProps {
  // Server で解決した「自分のトリセツ」URL (= /me/[token])。
  // 未指定ならクライアントで localStorage の owner_token から直接 /me/[token] を解決する
  // (/result の分析ローディングを経由しない。token が無ければ /diagnosis)。
  myTrisetsuUrl?: string;
}

export function HamburgerMenu({ myTrisetsuUrl }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 「ワタシのトリセツ」の実遷移先。Server で token が解決済み (myTrisetsuUrl) なら即それを使う。
  // 無ければクライアントで localStorage の owner_token から直接 /me/[token] を組み立て、
  // /result の分析インタースティシャルを経由せず即座に結果を表示する。
  const [myUrl, setMyUrl] = useState<string | undefined>(myTrisetsuUrl);
  // 「この端末のデータを消す」: 確認パネル表示中か / クリア実行中か。
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Portal の描画先 (document.body) はクライアント側でのみ存在するため、
  // hydration mismatch を避けるため初回マウント完了後にだけ Portal を描画する。
  // 併せて、token が prop で来ていない画面では localStorage から自分の /me を解決する。
  useEffect(() => {
    setMounted(true);
    if (!myTrisetsuUrl) {
      const token = localStorage.getItem("torisetsu_owner_token");
      setMyUrl(token ? `/me/${token}` : "/diagnosis");
    }
  }, [myTrisetsuUrl]);

  const handleClose = () => {
    setOpen(false);
    // 次に開いたときは通常表示に戻す (確認パネルを開きっぱなしにしない)。
    setConfirmingClear(false);
  };

  // この端末の紐付けをクリアして脱出する。
  //   - サーバ: POST /api/session/clear が session_token を NULL 化 + wn_session cookie 削除
  //   - クライアント: localStorage の紐付けキーを削除
  //   - cookie クリア後の未診断状態でトップ LP を確実に出すためハード遷移
  // 診断結果 (DB の users 行) は消さない。email / LINE で復元可能。
  const handleClearDevice = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await fetch("/api/session/clear", { method: "POST" });
    } catch {
      // ネットワークエラーでもローカルだけは消して脱出を成立させる。
    }
    try {
      localStorage.removeItem("torisetsu_owner_token");
      localStorage.removeItem("torisetsu_invite_code");
      localStorage.removeItem("torisetsu_result");
    } catch {
      // localStorage 不可環境は無視。
    }
    window.location.href = "/";
  };

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="メニュー"
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-modal-fade-in flex justify-center items-start px-2"
      onClick={handleClose}
    >
      {/* PC でも全幅に広がらず、アプリのページコンテナと同じ max-w-[480px] に収め中央寄せ。
          モバイルは px-2 + w-full で従来どおりほぼ全幅。 */}
      <div
        className="w-full max-w-[480px] mt-3 max-h-[calc(100vh-24px)] bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-2xl p-8 animate-modal-slide-up overflow-y-auto"
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

        {/* メニュー本体 (Polish-A.3: カード高さは内容ベース、中央寄せは撤去) */}
        <nav className="flex flex-col gap-5">
          {/* 診断済みユーザーが押しても /(自動リダイレクト)で /me に跳ね返らないよう
              ?stay=1 を付与してトップ LP を表示できるようにする。 */}
          <MenuLink href="/?stay=1" label="トップ" onClose={handleClose} />
          <MenuLink
            href={myUrl || "/diagnosis"}
            label="ワタシのトリセツ"
            onClose={handleClose}
          />
          <MenuLink
            href="/diagnosis"
            label="性格診断テスト"
            onClose={handleClose}
          />
          <MenuLink
            href="/friend-evaluation"
            label="他己診断テスト"
            onClose={handleClose}
          />
          <MenuLink href="/zukan/all" label="性格タイプ" onClose={handleClose} />
          <MenuLink href="/about" label="サービスについて" onClose={handleClose} />
          <MenuLink href="/login" label="ログイン" onClose={handleClose} />
        </nav>

        {/* ===== この端末のデータを消す (共用端末からの脱出 / 自動リダイレクトの逃げ道) =====
            破壊的操作なので他項目より控えめ。区切り線で分離し、押すと確認パネルを 1 枚挟む。
            実態は「DB 削除」ではなく「この端末の紐付けクリア」なので文言もそれに合わせる。 */}
        <div className="mt-8 pt-5 border-t border-[#3A2D6B]/10">
          {!confirmingClear ? (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="w-full flex items-center justify-center gap-1.5 text-[#3A2D6B]/55 font-bold text-sm py-2 hover:text-[#FE3C72] transition-colors"
            >
              <ResetIcon />
              この端末のデータを消す
            </button>
          ) : (
            <div className="rounded-2xl bg-[#F7F5FF] border border-[#3A2D6B]/15 p-4">
              <p className="text-[#3A2D6B]/80 text-xs font-black leading-relaxed mb-1">
                この端末を他の人と共有していますか？
              </p>
              <p className="text-[#3A2D6B]/60 text-xs leading-relaxed mb-4">
                この端末からあなたの診断データの紐付けを消します。診断結果そのものは残っていて、メール / LINE 連携で復元できます。よろしいですか？
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearDevice}
                  disabled={clearing}
                  className="flex-1 bg-[#FFD6E0] text-[#3A2D6B] font-black text-sm px-4 py-2.5 rounded-full border-2 border-[#3A2D6B] shadow-[0_3px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all disabled:opacity-60 disabled:pointer-events-none"
                >
                  {clearing ? "消しています…" : "消す"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  disabled={clearing}
                  className="flex-1 bg-white text-[#3A2D6B]/70 font-bold text-sm px-4 py-2.5 rounded-full border-2 border-[#3A2D6B]/20 hover:border-[#3A2D6B]/40 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ブランドの chunky ボタン (画像を保存 / シェア) と同じ "ぷっくり" 立体ポップ:
          sunYellow ソリッド + 太め deepPurple ボーダー + オフセットドロップシャドウ。
          ☰ は太い deepPurple の SVG 3 本線で確実に見える太さに。少し大きめ(56px)でタップ領域も確保。 */}
      <button
        type="button"
        aria-label="メニューを開く"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="w-14 h-14 rounded-full bg-[#FFE993] border-[3px] border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all flex items-center justify-center"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <g stroke="#3A2D6B" strokeWidth="2.6" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </g>
        </svg>
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

// リセット (ぐるっと矢印) を表す控えめなアイコン。currentColor でラベル色に追従。
function ResetIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 12a9 9 0 1 0 2.6-6.3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 4v4h4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
