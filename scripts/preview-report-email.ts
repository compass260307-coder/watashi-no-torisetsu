// 詳細レポートお届けメールの HTML プレビュー生成 (QA用)。
// 使い方: npx tsx scripts/preview-report-email.ts > /tmp/report-email.html
import { renderDetailedReportHtml } from "../src/lib/email";

process.stdout.write(
  renderDetailedReportHtml({
    reportUrl: "https://www.watashi-torisetsu.com/report/EXAMPLE_TOKEN",
    pdfUrl: "https://www.watashi-torisetsu.com/report/EXAMPLE_TOKEN/pdf",
    meUrl: "https://www.watashi-torisetsu.com/me/EXAMPLE_TOKEN",
    greetingName: "わかん",
  }),
);
