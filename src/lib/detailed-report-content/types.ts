// 詳細レポート (課金特典・/report/[token]) のコンテンツ型。
//
// 章構成は 16Personalities のタイプ別プロフィール PDF を参考にした 8 章固定:
//   はじめに / 長所と短所 / 恋愛関係 / 友人関係 / 子育て / キャリアパス /
//   仕事における傾向 / まとめ
// 本文はすべてオリジナル (32タイプ既存コンテンツの世界観・文体で書き下ろし)。
// MBTI・16Personalities 由来の文言は表示テキストに出さない (商標・著作権ポリシー)。

export interface ReportBullet {
  title: string; // 例: "豊かな観察眼"
  body: string;
}

export interface ReportSection {
  heading?: string; // 章内の小見出し (省略可)
  quote?: string; // 引用風の抜き出し文 (罫線で囲んで表示)
  body?: string; // 段落。"\n\n" 区切りで複数段落
  bullets?: ReportBullet[]; // 長所・短所などの箇条書き
}

export interface ReportChapter {
  title: string; // 章タイトル (8章固定の名称)
  sections: ReportSection[];
}

export interface DetailedReport {
  chapters: ReportChapter[];
}

/** 8 章の正式タイトル (執筆・描画の共通定数) */
export const REPORT_CHAPTER_TITLES = [
  "はじめに",
  "長所と短所",
  "恋愛関係",
  "友人関係",
  "子育て",
  "キャリアパス",
  "仕事における傾向",
  "まとめ",
] as const;
