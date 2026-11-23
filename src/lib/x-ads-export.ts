// X 広告マネージャーの時間別エクスポート (xlsx) を読み、日本時間の時間別の実績に直す。
//
// ファイルは 1 アカウント 1 つ。1 行が「キャンペーン × 1 時間」で、時刻 (Time period) は
// アカウントのタイムゾーンで書かれている。キャンペーン名は
// `MMDD_PULSE24h_{アカウント記号}{単価}_{ラベル}_{A/B/C}` の形。
//
// xlsx は zip の中に XML が入った形式。この用途のためだけにライブラリを足さず、
// ブラウザ標準の解凍 (DecompressionStream) と、必要な要素だけを拾う読み取りで済ませる。
// ブラウザでも Node でも動く (画面と検証スクリプトの両方から使う)。

export interface XAdsExportRow {
  /** アカウントのタイムゾーンでの時刻。"2026-11-18 00:00:00" */
  timePeriod: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
}

export interface XAdsHourlyRow {
  /** 日本時間の日付 (YYYY-MM-DD) と時 (0〜23)。 */
  day: string;
  hour: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
}

const CAMPAIGN_PATTERN = /^\d{4}_PULSE24h_([A-Z]+?)\d+_?.*_[A-Z]$/;

/* ------------------------------------------------------------------ zip */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** zip の中から、名前が一致するファイルを取り出す (無ければ null)。 */
async function readZipEntry(
  zip: Uint8Array,
  name: string,
): Promise<Uint8Array | null> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // 末尾の「中央ディレクトリの終わり」を後ろから探す。
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0)
    throw new Error("xlsx として読めません (zip の終端がありません)");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const entryName = decoder.decode(
      zip.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (entryName === name) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const body = zip.subarray(start, start + compressedSize);
      if (method === 0) return body;
      if (method === 8) return inflateRaw(body);
      throw new Error("xlsx の圧縮形式に対応していません");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/* ------------------------------------------------------------------ xml */

function decodeXml(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|amp|lt|gt|quot|apos);/g,
    (entity, hex?: string, dec?: string) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      return {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
      }[entity] as string;
    },
  );
}

/** 要素の中の <t>...</t> をつなげた文字列 (書式つきの文字は複数の <t> に分かれる)。 */
function textOf(xml: string): string {
  let out = "";
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    out += decodeXml(match[1]);
  }
  return out;
}

/** "AB12" → 列の番号 (A = 0)。 */
function columnIndex(reference: string): number {
  let index = 0;
  for (const char of reference) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

/** 最初のシートを、行ごとの文字列の配列にする。 */
async function readFirstSheet(file: Uint8Array): Promise<string[][]> {
  const decoder = new TextDecoder();
  const sharedXml = await readZipEntry(file, "xl/sharedStrings.xml");
  const shared = sharedXml
    ? [...decoder.decode(sharedXml).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
        (match) => textOf(match[1]),
      )
    : [];
  const sheetXml = await readZipEntry(file, "xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("xlsx にシートがありません");
  const rows: string[][] = [];
  for (const rowMatch of decoder
    .decode(sheetXml)
    .matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cell of rowMatch[1].matchAll(
      /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const attributes = cell[1];
      const body = cell[2] ?? "";
      const reference = /\br="([A-Z]+)\d+"/.exec(attributes)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (raw !== undefined) value = decodeXml(raw);
      row[reference ? columnIndex(reference) : row.length] = value;
    }
    rows.push(Array.from(row, (value) => value ?? ""));
  }
  return rows;
}

/* --------------------------------------------------------------- 読み取り */

const number = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** エクスポートの行を取り出す。見出しが想定と違うときは、何が無いかを言って止める。 */
export async function parseXAdsExport(
  file: ArrayBuffer | Uint8Array,
): Promise<XAdsExportRow[]> {
  const rows = await readFirstSheet(
    file instanceof Uint8Array ? file : new Uint8Array(file),
  );
  const head = rows[0] ?? [];
  const column = (label: string) => head.indexOf(label);
  const time = column("Time period");
  // キャンペーン単位と広告グループ単位の 2 種類のエクスポートがある。
  const name = Math.max(column("Campaign name"), column("Ad Group name"));
  const spend = column("Spend");
  const missing = [
    time < 0 ? "Time period" : null,
    name < 0 ? "Campaign name" : null,
    spend < 0 ? "Spend" : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `X の時間別エクスポートではないようです (見出しに ${missing.join("、")} がありません)`,
    );
  }
  const impressions = column("Impressions");
  const clicks = column("Link clicks");
  const leads = column("Leads");
  const purchases = column("Purchases");
  return rows
    .slice(1)
    .filter((row) => /^\d{4}-\d{2}-\d{2} \d{2}:/.test(row[time] ?? ""))
    .map((row) => ({
      timePeriod: row[time].slice(0, 19),
      campaignName: row[name] ?? "",
      spend: number(row[spend]),
      impressions: number(row[impressions]),
      clicks: number(row[clicks]),
      leads: number(row[leads]),
      purchases: number(row[purchases]),
    }));
}

/**
 * キャンペーン名から、このファイルのアカウント記号を決める。
 * 名前の形が違うキャンペーンが混ざっていても、いちばん多い記号をファイル全体の記号とする
 * (ファイルは 1 アカウント 1 つなので)。1 つも読み取れなければ null。
 */
export function detectXAdsAccount(rows: XAdsExportRow[]): {
  code: string | null;
  unmatchedCampaigns: number;
} {
  const counts = new Map<string, number>();
  const unmatched = new Set<string>();
  for (const row of rows) {
    const code = CAMPAIGN_PATTERN.exec(row.campaignName)?.[1];
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    else unmatched.add(row.campaignName);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { code: best?.[0] ?? null, unmatchedCampaigns: unmatched.size };
}

/**
 * キャンペーン名の一覧から、アカウント記号を決める (いちばん多い記号)。
 * X Ads API から取ったキャンペーン名にも使う。1 つも読み取れなければ null。
 */
export function accountCodeFromCampaignNames(names: string[]): string | null {
  return detectXAdsAccount(
    names.map((campaignName) => ({ campaignName }) as XAdsExportRow),
  ).code;
}

/** あるタイムゾーンでの「その時刻」が、UTC の何ミリ秒かを返す。夏時間も考慮する。 */
function zonedTimeToUtc(wallTime: string, timeZone: string): number {
  const [date, clock] = wallTime.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = clock.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  // そのタイムゾーンが UTC より何ミリ秒進んでいるかを、時刻を表示させて求める。
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(
      format
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    return (
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      ) - instant
    );
  };
  const guess = asUtc - offsetAt(asUtc);
  // 夏時間の切り替え前後では、1 回目の見積もりがずれることがあるのでもう一度合わせる。
  return asUtc - offsetAt(guess);
}

/** 行を日本時間の「日 × 時」に足し上げる。 */
export function toJstHourly(
  rows: XAdsExportRow[],
  timeZone: string,
): XAdsHourlyRow[] {
  const byHour = new Map<string, XAdsHourlyRow>();
  for (const row of rows) {
    const jst = new Date(zonedTimeToUtc(row.timePeriod, timeZone) + 9 * 3600e3);
    const day = jst.toISOString().slice(0, 10);
    const hour = jst.getUTCHours();
    const key = `${day} ${hour}`;
    const total = byHour.get(key) ?? {
      day,
      hour,
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      purchases: 0,
    };
    total.spend += row.spend;
    total.impressions += row.impressions;
    total.clicks += row.clicks;
    total.leads += row.leads;
    total.purchases += row.purchases;
    byHour.set(key, total);
  }
  return [...byHour.values()]
    .map((row) => ({ ...row, spend: Math.round(row.spend * 100) / 100 }))
    .sort((a, b) =>
      a.day === b.day ? a.hour - b.hour : a.day < b.day ? -1 : 1,
    );
}
