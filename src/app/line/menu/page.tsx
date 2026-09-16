// LINEリッチメニュー「メニュー」の着地点。トークへの一覧メッセージ送信は不要。
// 本人専用ページは既存のLIFF導線に任せ、トーク機能は入力済みの画面へ戻す。

import type { Metadata } from "next";
import Image from "next/image";

import styles from "./LineMenu.module.css";

export const metadata: Metadata = {
  title: "メニュー | Alice",
  robots: { index: false, follow: false },
};

const LINE_ACCOUNT_ID = "%40867domoo";
const LINE_TALK_URL = `https://line.me/R/oaMessage/${LINE_ACCOUNT_ID}`;

function talkCommandUrl(command: string): string {
  return `${LINE_TALK_URL}/?${encodeURIComponent(command)}`;
}

function personalPageUrl(dest: string, fallbackCommand: string): string {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  return liffId
    ? `https://liff.line.me/${liffId}?dest=${dest}`
    : talkCommandUrl(fallbackCommand);
}

type IconName =
  | "book"
  | "sun"
  | "cards"
  | "target"
  | "heart"
  | "friends"
  | "study"
  | "plus"
  | "help"
  | "mail";

type MenuItem = {
  label: string;
  description: string;
  href: string;
  icon: IconName;
  tone: "rose" | "lavender" | "mint" | "gold";
};

function MenuIcon({ name }: { name: IconName }) {
  const drawing = {
    book: <><path d="M12 6c-2.4-1.7-5-1.8-8-1.3v13c3-.5 5.6-.4 8 1.3 2.4-1.7 5-1.8 8-1.3v-13c-3-.5-5.6-.4-8 1.3Z" /><path d="M12 6v13" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
    cards: <><rect x="5" y="3" width="12" height="17" rx="2" /><path d="M17 7h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2" /><path d="m11 8 1 1.8L13 8l1.8 1-1.8 1 1 1.8-2-1-1.8 1 1-1.8-1.8-1Z" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    heart: <path d="M20.3 8.3c0 4.1-4.4 7.7-8.3 11-3.9-3.3-8.3-6.9-8.3-11a4.7 4.7 0 0 1 8.3-3 4.7 4.7 0 0 1 8.3 3Z" />,
    friends: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19v-2a6 6 0 0 1 12 0v2H3Zm14 0h4v-1.5a4.5 4.5 0 0 0-4.5-4.5" /></>,
    study: <><path d="M3 5.5c3-.8 6-.4 9 1.5 3-1.9 6-2.3 9-1.5V19c-3-.8-6-.4-9 1.5C9 18.6 6 18.2 3 19V5.5Z" /><path d="M12 7v13.5M6 10h3m-3 3h3m6-3h3m-3 3h3" /></>,
    plus: <><path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z" /><path d="M19 2v3m-1.5-1.5h3" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.9-1.7 1.3-1.7 2.7" /><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  }[name];

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {drawing}
    </svg>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  return (
    <a
      href={item.href}
      className={`${styles.card} ${styles[item.tone]}`}
    >
      <span className={styles.cardIcon}><MenuIcon name={item.icon} /></span>
      <span className={styles.cardTitle}>{item.label}</span>
      <span className={styles.cardDescription}>{item.description}</span>
      <span className={styles.cardArrow} aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none"><path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </a>
  );
}

export default function LineMenuPage() {
  const mainItems: MenuItem[] = [
    { label: "恋愛相談", description: "Aliceに恋のことを話す", href: talkCommandUrl("Aliceに恋愛相談"), icon: "heart", tone: "rose" },
    { label: "今日の恋模様", description: "今日の恋の流れを見る", href: talkCommandUrl("今日の恋模様"), icon: "sun", tone: "gold" },
    { label: "恋のタロット", description: "心惹かれる1枚を選ぶ", href: talkCommandUrl("恋のタロット"), icon: "cards", tone: "lavender" },
    { label: "相性占い", description: "ふたりの相性をAliceに聞く", href: talkCommandUrl("相性占い"), icon: "friends", tone: "mint" },
  ];
  const moreItems: MenuItem[] = [
    { label: "恋の足あと", description: "これまでの恋を振り返る", href: personalPageUrl("love-footprints", "恋の足あと"), icon: "book", tone: "rose" },
    { label: "診断結果", description: "自分のタイプを見返す", href: personalPageUrl("me", "診断結果"), icon: "study", tone: "lavender" },
    { label: "ミッション", description: "進捗とプレゼントを見る", href: personalPageUrl("missions", "ミッション"), icon: "target", tone: "mint" },
    { label: "Alice Plus", description: "プランの内容を見てみる", href: personalPageUrl("plus", "プラン"), icon: "plus", tone: "gold" },
  ];
  const supportItems: MenuItem[] = [
    { label: "使い方", description: "Aliceと楽しむ方法", href: talkCommandUrl("使い方"), icon: "help", tone: "lavender" },
    { label: "お問い合わせ", description: "相談先を確認する", href: talkCommandUrl("お問い合わせ"), icon: "mail", tone: "rose" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ALICE MENU</p>
            <h1>Aliceの<br />メニュー</h1>
            <p className={styles.heroDescription}>今日の気分に合わせて、<br />気になることからどうぞ。</p>
            <a href={LINE_TALK_URL} className={styles.talkButton}>Aliceと話す<span aria-hidden="true">→</span></a>
          </div>
          <Image
            src="/line/alice-menu-hero-front-v1.png"
            width={260}
            height={260}
            sizes="(max-width: 520px) 48vw, 210px"
            preload
            alt=""
            className={styles.heroArt}
          />
        </header>

        <div className={styles.panel}>
          <section aria-labelledby="main-title" className={styles.section}>
            <h2 id="main-title" className={styles.sectionTitle}>まずはこちらから</h2>
            <div className={styles.grid}>{mainItems.map((item) => <MenuCard key={item.label} item={item} />)}</div>
          </section>

          <section aria-labelledby="more-title" className={styles.section}>
            <h2 id="more-title" className={styles.sectionTitle}>もっと楽しむ</h2>
            <div className={styles.grid}>{moreItems.map((item) => <MenuCard key={item.label} item={item} />)}</div>
          </section>

          <section aria-labelledby="support-title" className={styles.section}>
            <h2 id="support-title" className={styles.sectionTitle}>困ったときは</h2>
            <div className={styles.grid}>{supportItems.map((item) => <MenuCard key={item.label} item={item} />)}</div>
          </section>

          <p className={styles.note}>占いなどはLINEのトーク画面が開きます。<br />入力された言葉を送信してください。</p>
        </div>
      </div>
    </main>
  );
}
