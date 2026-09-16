// Alice恋愛特化リッチメニューの作成・画像アップロード・既定設定。
//
// 使い方:
//   node scripts/line-rich-menu.mjs --validate-only
//   node --env-file=.env.local scripts/line-rich-menu.mjs --keep-old
//
// 上段3セル + 下段4セル。「Alice Plus」は既存のLIFF経由申込ページ
// (?dest=plus)、「ミッション」は既存のミッションページを開く。画像内の表示順とareasの順序は
// richmenu-config.json / scripts/line-rich-menu-image.py に揃える。

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);
const validateOnly = args.includes("--validate-only");
const keepOld = args.includes("--keep-old");
const imageOptionIndex = args.indexOf("--image");
const imageArgument =
  imageOptionIndex >= 0 ? args[imageOptionIndex + 1] : undefined;
const imagePath = imageArgument
  ? path.resolve(imageArgument)
  : path.join(PROJECT_ROOT, "public/line/alice-rich-menu-love-v5.jpg");
const configPath = path.join(PROJECT_ROOT, "richmenu-config.json");

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!validateOnly && !token) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  process.exit(1);
}

const template = JSON.parse(await readFile(configPath, "utf8"));
const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
if (!validateOnly && !liffId) {
  console.error("NEXT_PUBLIC_LINE_LIFF_ID is not set");
  process.exit(1);
}
const resolvedLiffId = liffId ?? "validate-only";

if (typeof template.name !== "string" || !template.name) {
  throw new Error("richmenu-config.json must contain a non-empty name");
}
const menuNamePrefix = template.name;
const menu = {
  ...template,
  name: `${menuNamePrefix}-${new Date().toISOString().slice(0, 10)}`,
  areas: template.areas.map((area) => ({
    ...area,
    action:
      area.action.type === "uri"
        ? {
            ...area.action,
            uri: area.action.uri.replace("{{LIFF_ID}}", resolvedLiffId),
          }
        : area.action,
  })),
};

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
      0xc0,
      0xc1,
      0xc2,
      0xc3,
      0xc5,
      0xc6,
      0xc7,
      0xc9,
      0xca,
      0xcb,
      0xcd,
      0xce,
      0xcf,
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

function validateMenu(imageInfo, imageBytes) {
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
    { type: "message", text: "Aliceに恋愛相談" },
    { type: "message", text: "今日の恋模様" },
    { type: "message", text: "恋のタロット" },
    {
      type: "uri",
      uri: `https://liff.line.me/${resolvedLiffId}?dest=plus`,
    },
    { type: "message", text: "相性占い" },
    {
      type: "uri",
      uri: `https://liff.line.me/${resolvedLiffId}?dest=love-footprints`,
    },
    {
      type: "uri",
      uri: `https://liff.line.me/${resolvedLiffId}?dest=missions`,
    },
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
      y >= 0 &&
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
      throw new Error(`rich menu area ${index} does not match the image layout`);
    }
    if (JSON.stringify(area.action) !== JSON.stringify(expectedActions[index])) {
      throw new Error(`unexpected rich menu action at index ${index}`);
    }
  }
}

const image = await readFile(imagePath);
const imageInfo = inspectImage(image);
validateMenu(imageInfo, image.length);
const imageContentType =
  imageInfo.format === "jpeg" ? "image/jpeg" : "image/png";
console.log(
  `validated: ${imageInfo.width}x${imageInfo.height} ${imageInfo.format.toUpperCase()}, ${image.length} bytes, ${menu.areas.length} areas`,
);
if (validateOnly) process.exit(0);

const headers = { Authorization: `Bearer ${token}` };
const jsonHeaders = { ...headers, "Content-Type": "application/json" };

async function api(base, apiPath, options = {}) {
  const response = await fetch(`${base}${apiPath}`, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${apiPath} -> ${response.status}: ${body}`,
    );
  }
  return body ? JSON.parse(body) : {};
}

const { richMenuId } = await api("https://api.line.me", "/v2/bot/richmenu", {
  method: "POST",
  headers: jsonHeaders,
  body: JSON.stringify(menu),
});
console.log("created:", richMenuId);

await api(
  "https://api-data.line.me",
  `/v2/bot/richmenu/${richMenuId}/content`,
  {
    method: "POST",
    headers: { ...headers, "Content-Type": imageContentType },
    body: image,
  },
);
console.log("image uploaded");

await api("https://api.line.me", `/v2/bot/user/all/richmenu/${richMenuId}`, {
  method: "POST",
  headers,
});
console.log("set as default");

if (!keepOld) {
  const { richmenus } = await api("https://api.line.me", "/v2/bot/richmenu/list", {
    headers,
  });
  for (const existingMenu of richmenus ?? []) {
    if (
      existingMenu.richMenuId !== richMenuId &&
      existingMenu.name.startsWith(menuNamePrefix)
    ) {
      await api(
        "https://api.line.me",
        `/v2/bot/richmenu/${existingMenu.richMenuId}`,
        { method: "DELETE", headers },
      );
      console.log(
        "deleted old:",
        existingMenu.richMenuId,
        existingMenu.name,
      );
    }
  }
}

console.log("done");
