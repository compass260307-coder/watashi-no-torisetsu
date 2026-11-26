// 最上位のエラー画面 (app/global-error.tsx) の中身。
//
// 土台 (root layout) ごと落ちたときに出るので、サイトの CSS (Tailwind) もフォントも使えない。
// そのため、見た目はすべて style で直接書く。色・絵・並びは通常のエラー画面 (ErrorScreens) にそろえる。

import {
  ACCENT,
  AlertBadge,
  NAVY,
  SUPPORT_MAILTO_GENERAL,
  WindowArt,
} from "@/components/recovery-ui";

const FONT =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif';

export function GlobalErrorBody({
  chunkError,
  onRetry,
}: {
  chunkError: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#FFFFFF",
        color: NAVY,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "max(40px, 9vh) 16px 0",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 84,
            background:
              "radial-gradient(90% 70% at 50% 0%, #FDFCFF 0%, rgba(253,252,255,0) 70%), linear-gradient(180deg, #F6F4FD 0%, #EBE8F8 100%)",
            borderBottomLeftRadius: "50% 28px",
            borderBottomRightRadius: "50% 28px",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 540,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <WindowArt>
            <AlertBadge />
          </WindowArt>
          <p style={{ margin: "12px 0 0" }}>
            <span
              style={{
                display: "inline-block",
                background: "#FFFFFF",
                borderRadius: 9999,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "0.06em",
                color: "#A8741A",
                boxShadow: "0 1px 2px rgba(46,46,92,0.08)",
              }}
            >
              エラー
            </span>
          </p>
          <h1
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(22px, 6.6vw, 28px)",
              fontWeight: 900,
              lineHeight: 1.35,
              letterSpacing: "0.02em",
            }}
          >
            うまく表示できませんでした
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(14.5px, 4.2vw, 16px)",
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            {chunkError ? "ページを読み込み直してください" : "もう一度お試しください"}
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "clamp(12px, 3.4vw, 13.5px)",
              lineHeight: 1.7,
              color: "#5C5C7A",
            }}
          >
            {chunkError
              ? "読み込み直すと、入力中の内容が消える場合があります"
              : "一時的な問題の可能性があります"}
          </p>
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "#FFFFFF",
              border: "1px solid #E6E4F1",
              borderRadius: 20,
              boxShadow:
                "0 1px 1px rgba(46,46,92,0.03), 0 6px 14px -6px rgba(46,46,92,0.10), 0 22px 40px -22px rgba(46,46,92,0.22)",
            }}
          >
            <button
              type="button"
              onClick={onRetry}
              style={{
                display: "block",
                width: "100%",
                padding: "14px 24px",
                border: "none",
                borderRadius: 9999,
                background: ACCENT,
                boxShadow: "0 4px 0 #4343C9",
                color: "#FFFFFF",
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {chunkError ? "ページを読み込み直す" : "もう一度試す"}
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 土台が落ちているので、ふつうのリンクにする */}
            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: 16,
                fontSize: 12.5,
                fontWeight: 700,
                color: "rgba(46,46,92,0.6)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              トップに戻る
            </a>
          </div>
        </div>
      </div>
      <p
        style={{
          maxWidth: 540,
          margin: "0 auto",
          padding: "24px 16px 56px",
          textAlign: "center",
          fontSize: 12,
          lineHeight: 1.8,
          color: "#5C5C7A",
        }}
      >
        保存済みの診断結果が、このエラーで消えることはありません。
        <br />
        何度も同じ画面が出るときは、
        <a
          href={SUPPORT_MAILTO_GENERAL}
          style={{ color: NAVY, fontWeight: 700, textUnderlineOffset: 2 }}
        >
          サポートへご連絡ください
        </a>
        。
      </p>
    </div>
  );
}
