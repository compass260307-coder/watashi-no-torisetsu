# Alice Plus (LINE) Phase 4: リッチメニュー画像 (2500x843) の生成。
#
# 使い方: python3 scripts/line-rich-menu-image.py <出力.png>
# フォントはサイトと同じ M PLUS Rounded 1c を Google Fonts から /tmp に取得して使う。
# 生成後は scripts/line-rich-menu.mjs でアップロードする。

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "richmenu.png"
FONT_DIR = Path("/tmp/richmenu-fonts")


def ensure_font(weight: int) -> str:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    path = FONT_DIR / f"mplus-rounded-{weight}.ttf"
    if path.exists():
        return str(path)
    css = subprocess.run(
        [
            "curl", "-s", "-A", "curl",
            f"https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@{weight}",
        ],
        capture_output=True, text=True, check=True,
    ).stdout
    url = next(
        part.split(")")[0]
        for part in css.split("url(")
        if part.startswith("https://") and ".ttf" in part
    )
    subprocess.run(["curl", "-s", "-o", str(path), url], check=True)
    return str(path)


W, H = 2500, 843
BG = (250, 246, 239)  # 温かいオフホワイト
CARD = (255, 255, 255)
BORDER = (232, 224, 210)
TEXT = (58, 54, 48)
CAPTION = (138, 131, 120)

CELLS = [
    {"pill": "トリセツ", "label": "診断結果", "cap": "あなたの取説を見る",
     "accent": (239, 141, 126), "pill_bg": (253, 237, 234)},
    {"pill": "ガイド", "label": "使い方", "cap": "Aliceと話すヒント",
     "accent": (127, 184, 164), "pill_bg": (233, 244, 240)},
    {"pill": "月480円", "label": "Alice Plus", "cap": "上限なしでおしゃべり",
     "accent": (232, 184, 75), "pill_bg": (250, 241, 220)},
]

f_pill = ImageFont.truetype(ensure_font(700), 44)
f_label = ImageFont.truetype(ensure_font(800), 104)
f_cap = ImageFont.truetype(ensure_font(500), 50)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

margin, gap = 36, 28
cw = (W - margin * 2 - gap * 2) / 3

for i, c in enumerate(CELLS):
    x0 = margin + i * (cw + gap)
    x1 = x0 + cw
    y0, y1 = margin, H - margin
    d.rounded_rectangle([x0, y0, x1, y1], radius=44, fill=CARD, outline=BORDER, width=4)
    cx = (x0 + x1) / 2

    tw = d.textlength(c["pill"], font=f_pill)
    ph, pw = 78, tw + 76
    py0 = y0 + 96
    d.rounded_rectangle(
        [cx - pw / 2, py0, cx + pw / 2, py0 + ph], radius=ph / 2, fill=c["pill_bg"]
    )
    d.text((cx, py0 + ph / 2 + 2), c["pill"], font=f_pill, fill=c["accent"], anchor="mm")

    ly = py0 + ph + 158
    d.text((cx, ly), c["label"], font=f_label, fill=TEXT, anchor="mm")

    uy = ly + 92
    d.rounded_rectangle([cx - 60, uy, cx + 60, uy + 14], radius=7, fill=c["accent"])

    d.text((cx, uy + 108), c["cap"], font=f_cap, fill=CAPTION, anchor="mm")

img.save(OUT)
print("saved", OUT, img.size)
