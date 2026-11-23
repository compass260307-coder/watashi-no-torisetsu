// 社内向けページ。下部ナビ用の余白まで含めて、数値画面の既定の配色 (白地) の地の色に
// そろえる (画面の下に別の色の帯が出ないように)。黒地に切り替えたときは、画面側が
// body の色を差し替える。
export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{"body{background:#f2f4f6}"}</style>
      {children}
    </>
  );
}
