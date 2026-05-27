import Link from "next/link";

/**
 * Phase 1.5-α Day 6: Footer を Brand v2 (darkNavy + cream) に調整。
 * リンク先 URL / 文言 / お問い合わせ先 / コピーライトのコンテンツは維持、
 * 見た目 (カラー / フォント / 余白 / ホバー) のみ Phase 1.5 化。
 * 旧 Phase 1 の🐧絵文字は T3-5 ブランド方針 (絵文字一切不使用) に従い削除。
 */
export default function Footer() {
  return (
    <footer className="bg-[#2A2856] text-[#FFF9F0] px-6 py-10">
      <div className="max-w-[480px] mx-auto">
        {/* ブランド */}
        <p className="text-base font-black tracking-wide mb-6">
          ワタシのトリセツ
        </p>

        {/* リンクセクション */}
        <nav className="flex flex-col gap-3 mb-6">
          <Link
            href="/about"
            className="font-bold hover:text-[#FFE993] transition-colors w-fit"
          >
            サービスについて
          </Link>
          <Link
            href="/terms"
            className="font-bold hover:text-[#FFE993] transition-colors w-fit"
          >
            利用規約
          </Link>
          <Link
            href="/privacy"
            className="font-bold hover:text-[#FFE993] transition-colors w-fit"
          >
            プライバシーポリシー
          </Link>
        </nav>

        {/* 区切り線 */}
        <div
          aria-hidden="true"
          className="border-t border-[#FFF9F0]/20 my-6"
        />

        {/* お問い合わせ (コンテンツ維持) */}
        <p className="text-xs text-[#FFF9F0]/80 leading-relaxed mb-4">
          お問い合わせ:{" "}
          <a
            href="mailto:support@watashi-torisetsu.com"
            className="font-bold hover:text-[#FFE993] transition-colors underline underline-offset-2"
          >
            support@watashi-torisetsu.com
          </a>
        </p>

        {/* コピーライト */}
        <p className="text-xs text-[#FFF9F0]/60">
          © {new Date().getFullYear()} ワタシのトリセツ運営事務局
        </p>
      </div>
    </footer>
  );
}
