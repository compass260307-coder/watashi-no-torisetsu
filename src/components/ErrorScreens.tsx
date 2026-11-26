"use client";

// 通常のエラー画面 (app/error.tsx) と 404 (日本語) の中身。
//
// 伝える順: 何が起きたか → 次に押すボタン → 保存済みの結果は無事か → だめなら問い合わせ先。
// 見た目は購入まわりの画面 (PurchaseUnverifiedRecovery / PaidUnlockRecovery) と同じ型
// (淡い帯 + 帯と白地にまたがる表)。共通の部品は recovery-ui。
//
// リンクは <a> のまま (Next.js の Link を使わない): アプリの画面遷移の仕組みが壊れたときでも、
// ふつうのページ移動なら動くため。

import { useSyncExternalStore, type ReactNode } from "react";
import {
  ACCENT,
  AlertBadge,
  BAND_CURVE,
  CARD_SHADOW,
  ChevronIcon,
  ClipboardIcon,
  FONT_STACK,
  IconTile,
  MailIcon,
  NAVY,
  PALT,
  PeopleIcon,
  PersonIcon,
  SearchBadge,
  ShieldIcon,
  SUPPORT_MAILTO_GENERAL,
  WindowArt,
} from "@/components/recovery-ui";

function Frame({
  art,
  label,
  title,
  lead,
  sub,
  card,
  children,
}: {
  art: ReactNode;
  label: string;
  title: string;
  lead: string;
  sub: string;
  card: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main
      className="flex min-h-dvh flex-col bg-white pb-14"
      style={{ fontFamily: FONT_STACK, color: NAVY }}
    >
      <section className="relative w-full px-4 pt-[max(40px,9vh)] md:px-8">
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
              style={{ color: "#A8741A" }}
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
            className={`mt-5 overflow-hidden rounded-[20px] border border-[#E6E4F1] bg-white ${CARD_SHADOW}`}
          >
            {card}
          </div>
        </div>
      </section>
      {children && (
        <section className="mx-auto w-full max-w-[572px] px-4 pt-7 md:px-8">
          {children}
        </section>
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center justify-center gap-3 text-[13px] font-bold tracking-[0.06em] text-[#4A4A68]">
      <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0]" />
      {children}
      <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0]" />
    </h2>
  );
}

function Row({
  icon,
  tone,
  title,
  body,
  href,
  first = false,
}: {
  icon: ReactNode;
  tone?: "accent" | "amber";
  title: string;
  body: string;
  href?: string;
  first?: boolean;
}) {
  const inner = (
    <>
      <IconTile tone={tone}>{icon}</IconTile>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold leading-[1.4]">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-[1.6] text-[#4F4F6E]">{body}</span>
      </span>
      {href && (
        <span className="shrink-0 text-[#B9B6D3]">
          <ChevronIcon />
        </span>
      )}
    </>
  );
  return (
    <li className="relative">
      {!first && (
        <span
          aria-hidden="true"
          className="absolute left-[70px] right-0 top-0 h-px bg-[#EDECF5]"
        />
      )}
      {href ? (
        <a
          href={href}
          className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[#FAFAFE]"
        >
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-3">{inner}</div>
      )}
    </li>
  );
}

// この端末に診断結果が残っているか。ログインページ・トップと同じ目印 (端末に保存した結果の鍵) で見分ける。
const OWNER_TOKEN_KEY = "torisetsu_owner_token";
const SAFE_TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

function readOwnerToken(): string | null {
  try {
    const token = localStorage.getItem(OWNER_TOKEN_KEY);
    return token && SAFE_TOKEN.test(token) ? token : null;
  } catch {
    return null; // 保存領域が使えない環境
  }
}

const subscribeNothing = () => () => {};

/**
 * 404 (日本語)。行き先は、この端末に診断結果があるかどうかで変える。
 * - ある人: 自分の結果 / 友達診断 (どちらもログイン不要でひらける)
 * - ない人: 診断をはじめる / 診断したことがある人はログイン
 * 「トップに戻る」は上の2つと行き先が重なるので、表の下の小さなリンクにする。
 */
export function NotFoundScreenJa() {
  // サーバーでは分からないので「ない人」向けを描き、ブラウザで読めたら差し替える。
  const ownerToken = useSyncExternalStore(subscribeNothing, readOwnerToken, () => null);
  const tokenPath = ownerToken ? encodeURIComponent(ownerToken) : null;

  return (
    <Frame
      art={
        <WindowArt>
          <SearchBadge />
        </WindowArt>
      }
      label="404"
      title="ページが見つかりませんでした"
      lead="URLが正しいか、もう一度ご確認ください"
      sub="ページが移動したか、なくなった可能性があります"
      card={
        tokenPath ? (
          <ul>
            <Row
              first
              icon={<PersonIcon />}
              title="自分の診断結果を見る"
              body="この端末に保存されている結果をひらきます"
              href={`/me/${tokenPath}`}
            />
            <Row
              icon={<PeopleIcon />}
              title="友達診断を見る"
              body="友達から見たあなたの結果と、招待リンク"
              href={`/tako/${tokenPath}`}
            />
          </ul>
        ) : (
          <ul>
            <Row
              first
              icon={<ClipboardIcon />}
              title="性格診断をはじめる"
              body="50問・無料で、32タイプから診断します"
              href="/diagnosis"
            />
            <Row
              icon={<PersonIcon />}
              title="診断したことがある方"
              body="登録したメールアドレスでログインします"
              href="/login"
            />
          </ul>
        )
      }
    >
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 画面遷移の仕組みが壊れていても動くよう、ふつうのリンクにする */}
      <a
        href="/"
        className="mx-auto block w-fit text-[12.5px] font-bold underline underline-offset-2"
        style={{ color: `${NAVY}99` }}
      >
        トップに戻る
      </a>
    </Frame>
  );
}

/**
 * 通常のエラー画面。
 * chunkError: デプロイで古い部品が消えたとき。同じ画面のままやり直しても直らないので、ページごと読み込み直す。
 */
export function AppErrorScreen({
  chunkError,
  onRetry,
}: {
  chunkError: boolean;
  onRetry: () => void;
}) {
  return (
    <Frame
      art={
        <WindowArt>
          <AlertBadge />
        </WindowArt>
      }
      label="エラー"
      title="うまく表示できませんでした"
      lead={chunkError ? "ページを読み込み直してください" : "もう一度お試しください"}
      sub={
        chunkError
          ? "読み込み直すと、入力中の内容が消える場合があります"
          : "一時的な問題の可能性があります"
      }
      card={
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onRetry}
            className="flex w-full items-center justify-center rounded-full px-6 py-3.5 text-[16px] font-black text-white transition-transform active:scale-[0.98]"
            style={{ background: ACCENT, boxShadow: "0 4px 0 #4343C9" }}
          >
            {chunkError ? "ページを読み込み直す" : "もう一度試す"}
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 画面遷移の仕組みが壊れていても動くよう、ふつうのリンクにする */}
          <a
            href="/"
            className="mx-auto mt-4 block w-fit text-[12.5px] font-bold underline underline-offset-2"
            style={{ color: `${NAVY}99` }}
          >
            トップに戻る
          </a>
        </div>
      }
    >
      <SectionTitle>知っておいてほしいこと</SectionTitle>
      <ul className="mt-3 overflow-hidden rounded-[20px] border border-[#E6E4F1] bg-white">
        <Row
          first
          tone="amber"
          icon={<ShieldIcon />}
          title="保存済みの診断結果は残っています"
          body="このエラーで、結果が消えることはありません"
        />
        <Row
          icon={<MailIcon />}
          title="何度も同じ画面が出る"
          body="見ていたページを添えて、サポートへ"
          href={SUPPORT_MAILTO_GENERAL}
        />
      </ul>
    </Frame>
  );
}
