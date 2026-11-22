// 社内向けページ。共通レイアウトの body は白地なので、下部ナビ用の余白まで含めて
// 黒地にそろえる (画面の下に白い帯が出ないように)。
export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{"body{background:#000}"}</style>
      {children}
    </>
  );
}
