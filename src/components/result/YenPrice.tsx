export function YenPrice({ amount }: { amount: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {amount.toLocaleString("ja-JP")}
      <span className="ml-0.5 text-[0.5em] tracking-normal">円</span>
    </span>
  );
}
