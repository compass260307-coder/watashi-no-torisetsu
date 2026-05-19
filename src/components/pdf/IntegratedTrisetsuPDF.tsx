// プレミアム化 v2 Week 2 T2-1: 統合トリセツ PDF 本実装
// 表紙 → 目次 → 第一〜七章 → 奥付 → サービス情報 のフル構成。
//
// T1-8 の最小実装 (表紙 + 1 章) を拡張。日本語フォント + filesystem 読込 +
// hyphenation 無効化 + textAlign: 'left' は T1-8 で確立した方針を維持。

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

// ---------- カラー ----------
const COLOR_INK = "#1A2238"; // ディープネイビー
const COLOR_GOLD = "#B8860B"; // アンティークゴールド
const COLOR_MUTED = "#6b6675";
const COLOR_PAPER = "#FAF7F0"; // 生成り
const COLOR_DIVIDER = "#D9CFB8"; // 薄い金色

// ---------- スタイル ----------
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
  // ========== 表紙 ==========
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
    marginBottom: 40,
    maxWidth: 360,
  },
  coverDivider: {
    width: 50,
    height: 1,
    backgroundColor: COLOR_GOLD,
    marginBottom: 28,
  },
  coverMeta: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: COLOR_MUTED,
    textAlign: "center",
    lineHeight: 1.8,
  },
  coverTypeCode: {
    fontFamily: "NotoSerifJP",
    fontSize: 11,
    letterSpacing: 2,
    color: COLOR_GOLD,
    marginTop: 12,
    marginBottom: 4,
  },
  coverTypeName: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: COLOR_MUTED,
    textAlign: "center",
  },
  // ========== 目次 ==========
  tocLabel: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    letterSpacing: 4,
    color: COLOR_GOLD,
    marginBottom: 10,
  },
  tocHeading: {
    fontFamily: "NotoSerifJP",
    fontSize: 22,
    color: COLOR_INK,
    marginBottom: 4,
  },
  tocHeadingDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLOR_GOLD,
    marginBottom: 28,
  },
  tocRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 14,
  },
  tocChapterNumber: {
    fontFamily: "NotoSerifJP",
    fontSize: 11,
    color: COLOR_GOLD,
    letterSpacing: 3,
    width: 70,
  },
  tocChapterTitle: {
    fontFamily: "NotoSerifJP",
    fontSize: 13,
    color: COLOR_INK,
    marginBottom: 2,
  },
  tocChapterSubtitle: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: COLOR_MUTED,
    marginTop: 2,
  },
  tocBackmatterRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8,
    marginBottom: 14,
  },
  tocBackmatterLabel: {
    fontFamily: "NotoSerifJP",
    fontSize: 11,
    color: COLOR_MUTED,
    letterSpacing: 2,
    width: 70,
  },
  tocBackmatterTitle: {
    fontFamily: "NotoSerifJP",
    fontSize: 12,
    color: COLOR_INK,
  },
  // ========== 章ページ ==========
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
    textAlign: "left",
  },
  paragraph: {
    marginBottom: 12,
  },
  // ========== 奥付 ==========
  colophonLabel: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    letterSpacing: 4,
    color: COLOR_GOLD,
    marginBottom: 10,
  },
  colophonHeading: {
    fontFamily: "NotoSerifJP",
    fontSize: 22,
    color: COLOR_INK,
    marginBottom: 4,
  },
  colophonDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLOR_GOLD,
    marginBottom: 28,
  },
  colophonSectionTitle: {
    fontFamily: "NotoSerifJP",
    fontSize: 13,
    color: COLOR_INK,
    marginBottom: 14,
    marginTop: 8,
  },
  colophonSourceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 10,
  },
  colophonSourceMarker: {
    fontFamily: "NotoSerifJP",
    fontSize: 11,
    color: COLOR_GOLD,
    width: 18,
  },
  colophonSourceName: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: COLOR_INK,
    flex: 1,
  },
  colophonSourceCode: {
    fontFamily: "NotoSerifJP",
    fontSize: 9,
    color: COLOR_MUTED,
    letterSpacing: 1,
  },
  colophonMetaRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  colophonMetaLabel: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: COLOR_MUTED,
    width: 90,
  },
  colophonMetaValue: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: COLOR_INK,
    flex: 1,
  },
  colophonInnerDivider: {
    width: "100%",
    height: 0.5,
    backgroundColor: COLOR_DIVIDER,
    marginTop: 20,
    marginBottom: 20,
  },
  // ========== サービス情報 ==========
  serviceWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceLabel: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    letterSpacing: 3,
    color: COLOR_GOLD,
    marginBottom: 18,
  },
  serviceName: {
    fontFamily: "NotoSerifJP",
    fontSize: 18,
    color: COLOR_INK,
    marginBottom: 10,
  },
  serviceSubName: {
    fontFamily: "NotoSerifJP",
    fontSize: 12,
    color: COLOR_MUTED,
    marginBottom: 32,
  },
  serviceDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLOR_GOLD,
    marginBottom: 32,
  },
  serviceClosing: {
    fontFamily: "NotoSerifJP",
    fontSize: 12,
    color: COLOR_INK,
    textAlign: "center",
    lineHeight: 1.8,
    marginBottom: 32,
    maxWidth: 320,
  },
  serviceUrl: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: COLOR_MUTED,
    letterSpacing: 1,
  },
});

// ---------- 型 ----------
export type PdfChapter = {
  title: string;
  subtitle?: string; // message 章は subtitle 無し
  body: string;
};

export type PdfSource = {
  kind: "self" | "perception";
  name: string;
  fullCode: string;
  modifierLabel?: string;
};

export type MinimalPdfData = {
  ownerName: string;
  // 表紙メタ (T2-1 追加、任意で省略可)
  typeCode?: string; // 例: "EAO-c-N"
  typeName?: string; // 例: "好奇心旺盛な共感者・実家系"
  title: string;
  subtitle: string;
  generatedAt: string; // ISO
  // 7 章 (順序固定): essence → multifacetedness → hidden_self →
  //   strengths_weaknesses → relationships → life_guidance → message
  chapters: PdfChapter[];
  // 奥付メタ (T2-1 追加、任意)
  sources?: PdfSource[]; // 統合した素材一覧
  modelLabel?: string; // 例: "Claude Opus 4.7"
};

const CHAPTER_NUMBER_JA = ["一", "二", "三", "四", "五", "六", "七"] as const;
const SERVICE_NAME_JA = "ワタシのトリセツ";
const SERVICE_NAME_EN = "WATASHI NO TORISETSU";
const SERVICE_URL = "https://www.watashi-torisetsu.com";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })} ${d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return iso;
  }
}

// ---------- 表紙 ----------
function CoverPage({ data }: { data: MinimalPdfData }) {
  return (
    <View style={styles.coverWrapper}>
      <Text style={styles.coverLabel}>{SERVICE_NAME_EN}</Text>
      <Text style={styles.coverTitle}>{data.title}</Text>
      <Text style={styles.coverSubtitle}>{data.subtitle}</Text>
      <View style={styles.coverDivider} />
      <Text style={styles.coverMeta}>{data.ownerName}さんへ</Text>
      <Text style={styles.coverMeta}>{formatDate(data.generatedAt)}</Text>
      {(data.typeCode || data.typeName) && (
        <>
          {data.typeCode && (
            <Text style={styles.coverTypeCode}>{data.typeCode}</Text>
          )}
          {data.typeName && (
            <Text style={styles.coverTypeName}>{data.typeName}</Text>
          )}
        </>
      )}
    </View>
  );
}

// ---------- 目次 ----------
function TableOfContents({ data }: { data: MinimalPdfData }) {
  return (
    <View>
      <Text style={styles.tocLabel}>CONTENTS</Text>
      <Text style={styles.tocHeading}>目次</Text>
      <View style={styles.tocHeadingDivider} />
      {data.chapters.map((ch, i) => (
        <View key={i} style={styles.tocRow}>
          <Text style={styles.tocChapterNumber}>
            第 {CHAPTER_NUMBER_JA[i] ?? String(i + 1)} 章
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tocChapterTitle}>{ch.title}</Text>
            {ch.subtitle && (
              <Text style={styles.tocChapterSubtitle}>{ch.subtitle}</Text>
            )}
          </View>
        </View>
      ))}
      <View style={styles.tocBackmatterRow}>
        <Text style={styles.tocBackmatterLabel}>奥付</Text>
        <Text style={styles.tocBackmatterTitle}>
          統合した素材 / 生成情報
        </Text>
      </View>
      <View style={styles.tocBackmatterRow}>
        <Text style={styles.tocBackmatterLabel}>あとがき</Text>
        <Text style={styles.tocBackmatterTitle}>サービス情報</Text>
      </View>
    </View>
  );
}

// ---------- 章ページ ----------
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

// ---------- 奥付 ----------
function ColophonPage({ data }: { data: MinimalPdfData }) {
  const sources = data.sources ?? [];
  const selfCount = sources.filter((s) => s.kind === "self").length;
  const perceptionCount = sources.filter((s) => s.kind === "perception").length;
  return (
    <View>
      <Text style={styles.colophonLabel}>COLOPHON</Text>
      <Text style={styles.colophonHeading}>奥付</Text>
      <View style={styles.colophonDivider} />

      <Text style={styles.colophonSectionTitle}>統合した素材</Text>
      {sources.length === 0 && (
        <Text style={styles.colophonSourceName}>
          素材情報は記録されていません。
        </Text>
      )}
      {sources.map((s, i) => {
        const marker = s.kind === "self" ? "●" : "○";
        const label =
          s.kind === "self"
            ? `${s.name} (自己評価)`
            : `${s.name}さんから見たあなた`;
        return (
          <View key={i} style={styles.colophonSourceRow}>
            <Text style={styles.colophonSourceMarker}>{marker}</Text>
            <Text style={styles.colophonSourceName}>{label}</Text>
            <Text style={styles.colophonSourceCode}>
              {s.fullCode}
              {s.modifierLabel ? ` ・ ${s.modifierLabel}` : ""}
            </Text>
          </View>
        );
      })}

      <View style={styles.colophonInnerDivider} />

      <Text style={styles.colophonSectionTitle}>生成情報</Text>
      <View style={styles.colophonMetaRow}>
        <Text style={styles.colophonMetaLabel}>生成日時</Text>
        <Text style={styles.colophonMetaValue}>
          {formatDateTime(data.generatedAt)}
        </Text>
      </View>
      <View style={styles.colophonMetaRow}>
        <Text style={styles.colophonMetaLabel}>AI モデル</Text>
        <Text style={styles.colophonMetaValue}>
          {data.modelLabel ?? "Claude (詳細非公開)"}
        </Text>
      </View>
      <View style={styles.colophonMetaRow}>
        <Text style={styles.colophonMetaLabel}>統合素材数</Text>
        <Text style={styles.colophonMetaValue}>
          自己評価 {selfCount} 件 + 他者視点 {perceptionCount} 件
        </Text>
      </View>
    </View>
  );
}

// ---------- サービス情報 (最終ページ) ----------
function ServiceInfoPage() {
  return (
    <View style={styles.serviceWrapper}>
      <Text style={styles.serviceLabel}>{SERVICE_NAME_EN}</Text>
      <Text style={styles.serviceName}>{SERVICE_NAME_JA}</Text>
      <Text style={styles.serviceSubName}>プレミアム版</Text>
      <View style={styles.serviceDivider} />
      <Text style={styles.serviceClosing}>
        あなたの自己理解の旅を、{"\n"}
        これからも。
      </Text>
      <Text style={styles.serviceUrl}>{SERVICE_URL}</Text>
    </View>
  );
}

// ---------- ドキュメント ----------
export function IntegratedTrisetsuPDF({ data }: { data: MinimalPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <CoverPage data={data} />
      </Page>
      <Page size="A4" style={styles.page}>
        <TableOfContents data={data} />
      </Page>
      {data.chapters.map((ch, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <ChapterPage
            number={CHAPTER_NUMBER_JA[i] ?? String(i + 1)}
            chapter={ch}
          />
        </Page>
      ))}
      <Page size="A4" style={styles.page}>
        <ColophonPage data={data} />
      </Page>
      <Page size="A4" style={styles.page}>
        <ServiceInfoPage />
      </Page>
    </Document>
  );
}
