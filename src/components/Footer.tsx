import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-pink-50 border-t border-pink-100 mt-20">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-foreground">
            <span className="font-bold">ワタシのトリセツ</span>
            <span className="text-muted ml-2 text-sm">🐧</span>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 justify-center text-sm">
            <Link href="/about" className="text-muted hover:text-pink-500">
              サービスについて
            </Link>
            <Link href="/terms" className="text-muted hover:text-pink-500">
              利用規約
            </Link>
            <Link href="/privacy" className="text-muted hover:text-pink-500">
              プライバシーポリシー
            </Link>
          </nav>

          <p className="text-xs text-muted">
            お問い合わせ:{" "}
            <a
              href="mailto:support@watashi-torisetsu.com"
              className="hover:text-pink-500"
            >
              support@watashi-torisetsu.com
            </a>
          </p>

          <p className="text-xs text-muted/70 mt-4">
            © 2026 ワタシのトリセツ運営事務局
          </p>
        </div>
      </div>
    </footer>
  );
}
