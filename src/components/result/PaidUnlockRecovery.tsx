// 購入後の反映待ちの画面 (日本語)。PaidUnlockWatcher が全画面で出す。
//
// 状態は2つ:
// - waiting: 反映を確かめている間。いまどこまで進んだかを3行の表で見せる。
// - timedOut: 約60秒たっても反映されなかったとき。伝える順は、
//   支払いは済んでいる → 買ったものは無事 → もう一度確認する → もう一度買わなくてよい → 問い合わせ先。
//
// 見た目は「購入を確認できなかった画面」(PurchaseUnverifiedRecovery) と同じ型
// (淡い帯 + 帯と白地にまたがる表)。共通の部品は recovery-ui。

import type { ReactNode } from "react";
import {
  ACCENT,
  AMBER,
  BAND_CURVE,
  CARD_SHADOW,
  ChevronIcon,
  FONT_STACK,
  IconTile,
  MailIcon,
  NAVY,
  PALT,
  ReceiptArt,
  ShieldIcon,
  SUPPORT_MAILTO,
} from "@/components/recovery-ui";
import type { AccessProduct } from "@/lib/access-products";

const GREEN = "#3FA96A";

// 絵の右下の印: 確かめている間は回る輪、時間切れは時計。
function SpinnerBadge() {
  return (
    <>
      <circle cx="86" cy="68" r="20" fill="#FFFFFF" stroke="#E3DFF8" strokeWidth="5" />
      <path
        d="M86 48a20 20 0 0 1 20 20"
        stroke={ACCENT}
        strokeWidth="5"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 86 68"
          to="360 86 68"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>
    </>
  );
}

function ClockBadge() {
  return (
    <>
      <circle cx="86" cy="68" r="20" fill="#FFF7E3" stroke={AMBER} strokeWidth="5" />
      <path
        d="M86 57v11.5l7 4.5"
        stroke={NAVY}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function productName(product: AccessProduct): string {
  if (product === "self_report") return "自己診断と自己分析PDF";
  if (product === "premium_bundle") return "すべての機能";
  return "完全版";
}

type ProgressState = "done" | "active" | "todo";

function ProgressMark({ state }: { state: ProgressState }) {
  if (state === "done") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: GREEN }}
      >
        <CheckMark />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        aria-hidden="true"
        className="h-7 w-7 shrink-0 animate-spin rounded-full border-[3px] border-[#E3DFF8]"
        style={{ borderTopColor: ACCENT }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-7 w-7 shrink-0 rounded-full border-[3px] border-[#E9E7F4]"
    />
  );
}

function Frame({
  art,
  label,
  labelColor,
  title,
  lead,
  sub,
  card,
  children,
}: {
  art: ReactNode;
  label: string;
  labelColor: string;
  title: string;
  lead: string;
  sub: string;
  card: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-white"
      style={{ fontFamily: FONT_STACK, color: NAVY }}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-full flex-col pb-10">
        {/* 帯は画面の上端から始める。中身は少し下げて、画面の真ん中あたりに見出しが来るようにする。 */}
        <section className="relative w-full px-4 pt-[max(48px,13vh)] md:px-8">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 bottom-[84px]"
            style={{
              background:
                "radial-gradient(90% 70% at 50% 0%, #FDFCFF 0%, rgba(253,252,255,0) 70%), linear-gradient(180deg, #F6F4FD 0%, #EBE8F8 100%)",
              borderBottomLeftRadius: BAND_CURVE,
              borderBottomRightRadius: BAND_CURVE,
            }}
          />
          <div className="relative mx-auto max-w-[540px]">
            {art}
            <p className="mt-3 flex justify-center">
              <span
                className="rounded-full bg-white px-3 py-[5px] text-[11px] font-bold leading-none tracking-[0.06em] shadow-[0_1px_2px_rgba(46,46,92,0.08)]"
                style={{ color: labelColor }}
              >
                {label}
              </span>
            </p>
            <h1
              className="mt-3.5 text-center text-[clamp(22px,6.6vw,28px)] font-black leading-[1.35] tracking-[0.02em]"
              style={{ fontFeatureSettings: PALT }}
            >
              {title}
            </h1>
            <p
              className="mt-3 text-center text-[clamp(14.5px,4.2vw,16px)] font-bold leading-[1.5] tracking-[0.01em]"
              style={{ fontFeatureSettings: PALT }}
            >
              {lead}
            </p>
            <p className="mt-1.5 text-center text-[clamp(12px,3.4vw,13.5px)] leading-[1.7] text-[#5C5C7A]">
              {sub}
            </p>
            <div
              className={`mt-5 rounded-[20px] border border-[#E6E4F1] bg-white ${CARD_SHADOW}`}
            >
              {card}
            </div>
          </div>
        </section>
        {children && (
          <section className="mx-auto w-full max-w-[572px] px-4 pt-6 md:px-8">
            {children}
          </section>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-[58px] right-0 top-0 h-px bg-[#EDECF5]"
    />
  );
}

export function PaidUnlockRecovery({
  state,
  product = "full_access",
  onRetry,
  onLater,
}: {
  state: "waiting" | "timedOut";
  product?: AccessProduct;
  /** 時間切れのあと、もう一度反映を確かめる。 */
  onRetry: () => void;
  /** 時間切れのあと、待つのをやめてページに戻る。 */
  onLater: () => void;
}) {
  const name = productName(product);

  if (state === "waiting") {
    const rows: { title: string; state: ProgressState }[] = [
      { title: "お支払いを受け付けました", state: "done" },
      { title: `${name}を使えるようにしています`, state: "active" },
      { title: "終わると、自動でページがひらきます", state: "todo" },
    ];
    return (
      <Frame
        art={
          <ReceiptArt>
            <SpinnerBadge />
          </ReceiptArt>
        }
        label="お支払いの確認"
        labelColor={ACCENT}
        title="お支払いを確認しています"
        lead="ページを閉じずに、このままお待ちください"
        sub="1分ほどかかることがあります"
        card={
          <ol>
            {rows.map((row, index) => (
              <li
                key={row.title}
                className="relative flex items-center gap-3 px-4 py-3"
              >
                {index > 0 && <Divider />}
                <ProgressMark state={row.state} />
                <span
                  className="text-[clamp(13px,4vw,15.5px)] font-bold leading-[1.4] tracking-[0.01em]"
                  style={{
                    fontFeatureSettings: PALT,
                    color: row.state === "todo" ? "#8A8AA3" : NAVY,
                  }}
                >
                  {row.title}
                </span>
              </li>
            ))}
          </ol>
        }
      />
    );
  }

  return (
    <Frame
      art={
        <ReceiptArt>
          <ClockBadge />
        </ReceiptArt>
      }
      label="お支払いは完了しています"
      labelColor="#2E8A5B"
      title="反映に時間がかかっています"
      lead="購入した内容は、なくなっていません"
      sub="少し時間をおいて、もう一度確認してください"
      card={
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onRetry}
            className="flex w-full items-center justify-center rounded-full px-6 py-3.5 text-[16px] font-black text-white transition-transform active:scale-[0.98]"
            style={{ background: ACCENT, boxShadow: "0 4px 0 #4343C9" }}
          >
            もう一度確認する
          </button>
          <button
            type="button"
            onClick={onLater}
            className="mx-auto mt-4 block text-[12.5px] font-bold underline underline-offset-2"
            style={{ color: `${NAVY}99` }}
          >
            あとで確認する（ページに戻る）
          </button>
        </div>
      }
    >
      <h2 className="flex items-center justify-center gap-3 text-[13px] font-bold tracking-[0.06em] text-[#4A4A68]">
        <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0]" />
        知っておいてほしいこと
        <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0]" />
      </h2>
      <ul className="mt-3 rounded-[20px] border border-[#E6E4F1] bg-white">
        <li className="flex items-center gap-3 px-3.5 py-3">
          <IconTile tone="amber">
            <ShieldIcon />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-[1.4]">
              もう一度購入する必要はありません
            </span>
            <span className="mt-0.5 block text-[12px] leading-[1.6] text-[#4F4F6E]">
              反映されるまで、購入ボタンが出ることがあります
            </span>
          </span>
        </li>
        <li className="relative">
          <span
            aria-hidden="true"
            className="absolute left-[70px] right-0 top-0 h-px bg-[#EDECF5]"
          />
          <a
            href={SUPPORT_MAILTO}
            className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[#FAFAFE]"
          >
            <IconTile>
              <MailIcon />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold leading-[1.4]">
                しばらくたっても使えない
              </span>
              <span className="mt-0.5 block text-[12px] leading-[1.6] text-[#4F4F6E]">
                購入時のメールアドレスを添えて、サポートへ
              </span>
            </span>
            <span className="shrink-0 text-[#B9B6D3]">
              <ChevronIcon />
            </span>
          </a>
        </li>
      </ul>
    </Frame>
  );
}
