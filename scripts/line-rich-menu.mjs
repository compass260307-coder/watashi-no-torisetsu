// Alice Plus (LINE) Phase 4: リッチメニュー作成・画像アップロード・既定設定。
//
// 使い方:
//   node --env-file=.env.local scripts/line-rich-menu.mjs [image.png]
//
// ブランド帯 (非タップ) + 上段3セル + 下段4セル。画像内の表示順と
// areas の順序は richmenu-config.json と scripts/line-rich-menu-image.py に揃える。
// 画像は 2500x1686 PNG (生成は scripts/line-rich-menu-image.py)。
// 再実行すると新しいメニューを作って既定を差し替え、古い alice-main-menu-* を削除する。

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATE_ONLY = process.argv[2] === "--validate-only";
const imageArgument = process.argv[VALIDATE_ONLY ? 3 : 2];
const imagePath = imageArgument
  ? path.resolve(imageArgument)
  : path.join(PROJECT_ROOT, "public/line/alice-rich-menu.png");
const configPath = path.join(PROJECT_ROOT, "richmenu-config.json");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!VALIDATE_ONLY && !TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  process.exit(1);
}

// 「自分のタイプ」「Alice Plus」はLIFF経由でその場でサイトを開く (2026-09-02)。
// LIFFがタップした本人を特定し、/liff → /api/line/liff-route が本人のURLへ流す
const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
if (!VALIDATE_ONLY && !LIFF_ID) {
  console.error("NEXT_PUBLIC_LINE_LIFF_ID is not set");
  process.exit(1);
}
const liffIdForMenu = LIFF_ID ?? "validate-only";

const menuTemplate = JSON.parse(await readFile(configPath, "utf8"));
const MENU_NAME_PREFIX = menuTemplate.name;
if (typeof MENU_NAME_PREFIX !== "string" || !MENU_NAME_PREFIX) {
  throw new Error("richmenu-config.json must contain a non-empty name");
}
const MENU = {
  ...menuTemplate,
  name: `${MENU_NAME_PREFIX}-${new Date().toISOString().slice(0, 10)}`,
  areas: menuTemplate.areas.map((area) => ({
    ...area,
    action:
      area.action.type === "uri"
        ? {
            ...area.action,
            uri: area.action.uri.replace("{{LIFF_ID}}", liffIdForMenu),
          }
        : area.action,
  })),
};

const headers = { Authorization: `Bearer ${TOKEN}` };
const json = { ...headers, "Content-Type": "application/json" };

async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

const image = await readFile(imagePath);

function inspectImage(buffer) {
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer.subarray(1, 4).toString("ascii") === "PNG";
  if (isPng) {
    return {
      format: "png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  const isJpeg = buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
  if (isJpeg) {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;

    while (offset < buffer.length) {
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length) break;

      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) break;

      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
        return {
          format: "jpeg",
          width: buffer.readUInt16BE(offset + 5),
          height: buffer.readUInt16BE(offset + 3),
        };
      }
      offset += segmentLength;
    }
    throw new Error("JPEG dimensions could not be read");
  }

  throw new Error("rich menu image must be PNG or JPEG");
}

function validateMenu(menu, imageInfo, imageBytes) {
  if (imageBytes > 1_000_000) {
    throw new Error(
      `rich menu image is ${imageBytes} bytes; LINE limit is 1000000 bytes`,
    );
  }
  if (
    imageInfo.width !== menu.size.width ||
    imageInfo.height !== menu.size.height
  ) {
    throw new Error(
      `rich menu image is ${imageInfo.width}x${imageInfo.height}; expected ${menu.size.width}x${menu.size.height}`,
    );
  }

  const expectedAreaBounds = [
    { x: 0, y: 540, width: 833, height: 640 },
    { x: 833, y: 540, width: 833, height: 640 },
    { x: 1666, y: 540, width: 834, height: 640 },
    { x: 0, y: 1180, width: 625, height: 506 },
    { x: 625, y: 1180, width: 625, height: 506 },
    { x: 1250, y: 1180, width: 625, height: 506 },
    { x: 1875, y: 1180, width: 625, height: 506 },
  ];
  const expectedActions = [
    { type: "uri", uri: `https://liff.line.me/${liffIdForMenu}?dest=me` },
    { type: "message", text: "占いで遊ぶ" },
    { type: "message", text: "使い方" },
    { type: "uri", uri: `https://liff.line.me/${liffIdForMenu}?dest=plus` },
    {
      type: "uri",
      uri: `https://liff.line.me/${liffIdForMenu}?dest=missions`,
    },
    { type: "message", text: "メニュー" },
    { type: "message", text: "お問い合わせ" },
  ];
  if (menu.areas.length !== expectedAreaBounds.length) {
    throw new Error(
      `rich menu has ${menu.areas.length} areas; expected ${expectedAreaBounds.length}`,
    );
  }

  for (const [index, area] of menu.areas.entries()) {
    const { x, y, width, height } = area.bounds;
    const valid =
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isInteger(width) &&
      Number.isInteger(height) &&
      x >= 0 &&
      y >= 540 &&
      width > 0 &&
      height > 0 &&
      x + width <= menu.size.width &&
      y + height <= menu.size.height;
    if (!valid) throw new Error(`invalid rich menu area at index ${index}`);

    const expected = expectedAreaBounds[index];
    if (
      x !== expected.x ||
      y !== expected.y ||
      width !== expected.width ||
      height !== expected.height
    ) {
      throw new Error(
        `rich menu area ${index} no longer matches scripts/line-rich-menu-image.py`,
      );
    }
    if (JSON.stringify(area.action) !== JSON.stringify(expectedActions[index])) {
      throw new Error(`unexpected rich menu action at index ${index}`);
    }
  }
}

const imageInfo = inspectImage(image);
validateMenu(MENU, imageInfo, image.length);
const imageContentType =
  imageInfo.format === "jpeg" ? "image/jpeg" : "image/png";
console.log(
  `validated: ${imageInfo.width}x${imageInfo.height} ${imageInfo.format.toUpperCase()}, ${image.length} bytes, ${MENU.areas.length} areas`,
);

if (VALIDATE_ONLY) process.exit(0);

// 1) 作成
const { richMenuId } = await api("https://api.line.me", "/v2/bot/richmenu", {
  method: "POST",
  headers: json,
  body: JSON.stringify(MENU),
});
console.log("created:", richMenuId);

// 2) 画像アップロード (api-data ホスト)
await api("https://api-data.line.me", `/v2/bot/richmenu/${richMenuId}/content`, {
  method: "POST",
  headers: { ...headers, "Content-Type": imageContentType },
  body: image,
});
console.log("image uploaded");

// 3) 全ユーザーの既定に設定
await api("https://api.line.me", `/v2/bot/user/all/richmenu/${richMenuId}`, {
  method: "POST",
  headers,
});
console.log("set as default");

// 4) 古い alice-main-menu-* を掃除
const { richmenus } = await api("https://api.line.me", "/v2/bot/richmenu/list", {
  headers,
});
for (const menu of richmenus ?? []) {
  if (menu.richMenuId !== richMenuId && menu.name.startsWith(MENU_NAME_PREFIX)) {
    await api("https://api.line.me", `/v2/bot/richmenu/${menu.richMenuId}`, {
      method: "DELETE",
      headers,
    });
    console.log("deleted old:", menu.richMenuId, menu.name);
  }
}
console.log("done");
