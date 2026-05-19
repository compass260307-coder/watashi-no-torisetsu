// プレミアム化 v2 Week 1 T1-8: PDF プロトタイプ用最小コンポーネント
// 表紙 + 1 章のみ。Noto Serif JP + Noto Sans JP で日本語が壊れず生成できるかの検証用。
//
// 本格実装 (7 章 + 目次 + 奥付) は T2-1 で扱う。

import { join } from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ---------- フォント登録 ----------
// 絶対ファイルパスで TTF を直接読込。
// Vercel Functions では next.config.ts の outputFileTracingIncludes で
// public/fonts/*.ttf を Function バンドルに同梱している。
// (URL fetch 経由だと SSO 保護下の Preview で 404、Production でも往復が無駄。)
const FONTS_DIR = join(process.cwd(), "public", "fonts");

Font.register({
  family: "NotoSerifJP",
  src: join(FONTS_DIR, "NotoSerifJP.ttf"),
});
Font.register({
  family: "NotoSansJP",
  src: join(FONTS_DIR, "NotoSansJP.ttf"),
});

// ハイフネーション無効化 (英文単語分割が日本語に誤適用されると
// 「報告-されています」のように単語が改行されるため)
Font.registerHyphenationCallback((word) => [word]);

// ---------- スタイル ----------
const COLOR_INK = "#1A2238"; // ディープネイビー
const COLOR_GOLD = "#B8860B"; // アンティークゴールド
const COLOR_MUTED = "#6b6675";
const COLOR_PAPER = "#FAF7F0"; // 生成り

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR_PAPER,
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 70,
    paddingRight: 70,
    fontFamily: "NotoSansJP",
    color: COLOR_INK,
  },
  // 表紙
  coverWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverLabel: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    letterSpacing: 3,
    color: COLOR_GOLD,
    marginBottom: 32,
  },
  coverTitle: {
    fontFamily: "NotoSerifJP",
    fontSize: 28,
    lineHeight: 1.4,
    textAlign: "center",
    color: COLOR_INK,
    marginBottom: 20,
  },
  coverSubtitle: {
    fontFamily: "NotoSerifJP",
    fontSize: 12,
    lineHeight: 1.6,
    textAlign: "center",
    color: COLOR_MUTED,
    marginBottom: 48,
    maxWidth: 360,
  },
  coverDivider: {
    width: 50,
    height: 1,
    backgroundColor: COLOR_GOLD,
    marginBottom: 32,
  },
  coverMeta: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: COLOR_MUTED,
    textAlign: "center",
  },
  // 章ページ
  chapterNumber: {
    fontFamily: "NotoSerifJP",
    fontSize: 10,
    letterSpacing: 5,
    color: COLOR_GOLD,
    marginBottom: 10,
  },
  chapterTitle: {
    fontFamily: "NotoSerifJP",
    fontSize: 22,
    color: COLOR_INK,
    marginBottom: 8,
  },
  chapterSubtitle: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: COLOR_MUTED,
    marginBottom: 28,
  },
  chapterBody: {
    fontFamily: "NotoSansJP",
    fontSize: 10.5,
    lineHeight: 1.9,
    color: COLOR_INK,
    // textAlign: 'justify' は日英混在で文字間の空白が不自然になるため 'left' に
    textAlign: "left",
  },
  paragraph: {
    marginBottom: 12,
  },
});

// ---------- 型 ----------
export type PdfChapter = {
  title: string;
  subtitle?: string; // message 章は subtitle 無し
  body: string;
};

export type MinimalPdfData = {
  ownerName: string;
  title: string;
  subtitle: string;
  generatedAt: string; // ISO
  // 7 章 (順序固定): essence → multifacetedness → hidden_self →
  //   strengths_weaknesses → relationships → life_guidance → message
  chapters: PdfChapter[];
};

// ---------- コンポーネント ----------
function CoverPage({ data }: { data: MinimalPdfData }) {
  const dateLabel = (() => {
    try {
      const d = new Date(data.generatedAt);
      return d.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return data.generatedAt;
    }
  })();
  return (
    <View style={styles.coverWrapper}>
      <Text style={styles.coverLabel}>WATASHI NO TORISETSU</Text>
      <Text style={styles.coverTitle}>{data.title}</Text>
      <Text style={styles.coverSubtitle}>{data.subtitle}</Text>
      <View style={styles.coverDivider} />
      <Text style={styles.coverMeta}>{data.ownerName}さんへ</Text>
      <Text style={styles.coverMeta}>{dateLabel}</Text>
    </View>
  );
}

const CHAPTER_NUMBER_JA = ["一", "二", "三", "四", "五", "六", "七"] as const;

function ChapterPage({
  number,
  chapter,
}: {
  number: string;
  chapter: PdfChapter;
}) {
  const paragraphs = chapter.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return (
    <View>
      <Text style={styles.chapterNumber}>第 {number} 章</Text>
      <Text style={styles.chapterTitle}>{chapter.title}</Text>
      {chapter.subtitle && (
        <Text style={styles.chapterSubtitle}>〜 {chapter.subtitle} 〜</Text>
      )}
      <View style={styles.chapterBody}>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function IntegratedTrisetsuPDF({ data }: { data: MinimalPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <CoverPage data={data} />
      </Page>
      {data.chapters.map((ch, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <ChapterPage
            number={CHAPTER_NUMBER_JA[i] ?? String(i + 1)}
            chapter={ch}
          />
        </Page>
      ))}
    </Document>
  );
}
