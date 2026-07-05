// Phase 1.5-α: ヒーロー直下シェアブロックの「他己診断テストを促す文言」(確定版)。
// (表記統一: 旧「相互理解度」→「他己診断テスト」)
//
// - 2 行を <br> で固定 (auto-wrap しない)。
//   1: リンクをシェアして友達に答えてもらうと、
//   2: 友達から見たアナタ＝他己診断テストの結果がわかるよ
// - M PLUS Rounded / deepPurple #2E2E5C / 中央寄せ / line-height 1.75。
// - 強調: 「リンク」「他己診断テスト」を weight 800 + vividPink #5B5BEF。
// - 花の装飾なし。縁(text-shadow)なしで確定 (極薄白フチにする場合は下記コメント参照)。
// - スマホで 1 行目が折り返さないよう font-size を clamp() で小さめに (各画面幅で 1 行ずつ収める)。

interface SharePromoProps {
  className?: string;
}

export function SharePromo({ className = "" }: SharePromoProps) {
  return (
    <div className={`text-center ${className}`.trim()}>
      <p
        className="text-[#2E2E5C] font-bold"
        style={{ fontSize: "clamp(12px, 3.8vw, 16px)", lineHeight: 1.75 }}
        // 縁ありにする場合は以下を style に追加 (にじみ・黄ドロップは無し):
        // textShadow: "-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff",
      >
        <span className="font-extrabold text-[#5B5BEF]">リンク</span>
        をシェアして友達に答えてもらうと、
        <br />
        友達から見たアナタ＝
        <span className="font-extrabold text-[#5B5BEF]">他己診断テスト</span>
        の結果がわかるよ
      </p>
    </div>
  );
}
