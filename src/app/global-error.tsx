"use client";

// global-error.tsx は root layout の外側で発火する。
// ここでは next/font 等が使えないため最小限のインライン CSS のみ。
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
          fontFamily:
            '"Hiragino Maru Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
          background: "linear-gradient(180deg, #fff5f8 0%, #ffffff 100%)",
          color: "#1a1a1a",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 12 }}>
          システムエラーが発生しました🐧
        </h1>
        <p
          style={{ fontSize: "0.875rem", color: "#666", marginBottom: 24 }}
        >
          ご迷惑をおかけして申し訳ありません。
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: "linear-gradient(135deg, #fd267a 0%, #ff7854 100%)",
            color: "#fff",
            padding: "14px 28px",
            border: "none",
            borderRadius: 9999,
            fontWeight: 700,
            fontSize: "1rem",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(254, 60, 114, 0.25)",
          }}
        >
          もう一度試す
        </button>
      </body>
    </html>
  );
}
