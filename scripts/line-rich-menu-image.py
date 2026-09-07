# Alice Plus (LINE): リッチメニュー画像 (2500x1686) の生成。
#
# 使い方: python3 scripts/line-rich-menu-image.py [出力.png]
# フォントはサイトと同じ M PLUS Rounded 1c を Google Fonts から /tmp に取得して使う。
# 生成後は scripts/line-rich-menu.mjs でアップロードする。
#
# scripts/line-rich-menu.mjs と同じ座標で、ブランド帯 (非タップ) +
# 上段3セル + 下段4セルを描く。セル順も同スクリプトの areas と揃える。

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else PROJECT_ROOT / "public/line/alice-rich-menu.png"
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


W, H = 2500, 1686
BRAND_H = 540
TOP_H = 640
BOTTOM_Y = BRAND_H + TOP_H
BG = (250, 246, 239)  # 温かいオフホワイト
CARD = (255, 255, 255)
BORDER = (232, 224, 210)
TEXT = (58, 54, 48)
CAPTION = (138, 131, 120)

TOP_CELLS = [
    {
        "bounds": (0, BRAND_H, 833, TOP_H),
        "pill": "MY TYPE",
        "label": "自分のタイプ",
        "cap": "診断結果をひらく",
        "accent": (239, 141, 126),
        "pill_bg": (253, 237, 234),
    },
    {
        "bounds": (833, BRAND_H, 833, TOP_H),
        "pill": "FORTUNE",
        "label": "占いで遊ぶ",
        "cap": "今日のヒントを受け取る",
        "accent": (132, 111, 202),
        "pill_bg": (241, 237, 251),
    },
    {
        "bounds": (1666, BRAND_H, 834, TOP_H),
        "pill": "GUIDE",
        "label": "使い方",
        "cap": "Aliceと話すヒント",
        "accent": (127, 184, 164),
        "pill_bg": (233, 244, 240),
    },
]

BOTTOM_CELLS = [
    {
        "bounds": (0, BOTTOM_Y, 625, H - BOTTOM_Y),
        "pill": "月額¥480",
        "label": "Alice Plus",
        "cap": "無料枠を超えておしゃべり",
        "accent": (212, 158, 42),
        "pill_bg": (250, 241, 220),
    },
    {
        "bounds": (625, BOTTOM_Y, 625, H - BOTTOM_Y),
        "pill": "MISSION",
        "label": "ミッション",
        "cap": "毎日のチャレンジ",
        "accent": (239, 141, 126),
        "pill_bg": (253, 237, 234),
    },
    {
        "bounds": (1250, BOTTOM_Y, 625, H - BOTTOM_Y),
        "pill": "MENU",
        "label": "メニュー",
        "cap": "できることを見る",
        "accent": (132, 111, 202),
        "pill_bg": (241, 237, 251),
    },
    {
        "bounds": (1875, BOTTOM_Y, 625, H - BOTTOM_Y),
        "pill": "SUPPORT",
        "label": "お問い合わせ",
        "cap": "困ったときはこちら",
        "accent": (127, 184, 164),
        "pill_bg": (233, 244, 240),
    },
]

f_brand_kicker = ImageFont.truetype(ensure_font(700), 38)
f_brand = ImageFont.truetype(ensure_font(800), 104)
f_brand_cap = ImageFont.truetype(ensure_font(500), 43)
f_top_pill = ImageFont.truetype(ensure_font(700), 34)
f_top_label = ImageFont.truetype(ensure_font(800), 76)
f_top_cap = ImageFont.truetype(ensure_font(500), 37)
f_bottom_pill = ImageFont.truetype(ensure_font(700), 27)
f_bottom_label = ImageFont.truetype(ensure_font(800), 53)
f_bottom_cap = ImageFont.truetype(ensure_font(500), 29)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# 非タップのブランド帯。タップ領域はこの下 (y=540) から始まる。
d.ellipse([2040, -190, 2630, 400], fill=(247, 235, 217))
d.ellipse([2190, 70, 2550, 430], fill=(240, 232, 249))
d.text((104, 100), "ALICE MENU", font=f_brand_kicker, fill=(171, 131, 47), anchor="lm")
d.text((104, 252), "Aliceと、今日も少し話そう。", font=f_brand, fill=TEXT, anchor="lm")
d.text(
    (108, 390),
    "その日の気分に合わせて、メニューを選んでね。",
    font=f_brand_cap,
    fill=CAPTION,
    anchor="lm",
)


def draw_cell(cell: dict, compact: bool) -> None:
    x, y, width, height = cell["bounds"]
    inset_x = 14
    inset_y = 15
    x0, y0 = x + inset_x, y + inset_y
    x1, y1 = x + width - inset_x, y + height - inset_y
    radius = 34 if compact else 42
    d.rounded_rectangle(
        [x0, y0, x1, y1],
        radius=radius,
        fill=CARD,
        outline=BORDER,
        width=4,
    )
    cx = x + width / 2

    pill_font = f_bottom_pill if compact else f_top_pill
    label_font = f_bottom_label if compact else f_top_label
    cap_font = f_bottom_cap if compact else f_top_cap
    pill_height = 52 if compact else 66
    pill_pad = 48 if compact else 66
    pill_y = y0 + (52 if compact else 72)
    pill_width = d.textlength(cell["pill"], font=pill_font) + pill_pad
    d.rounded_rectangle(
        [
            cx - pill_width / 2,
            pill_y,
            cx + pill_width / 2,
            pill_y + pill_height,
        ],
        radius=pill_height / 2,
        fill=cell["pill_bg"],
    )
    d.text(
        (cx, pill_y + pill_height / 2 + 1),
        cell["pill"],
        font=pill_font,
        fill=cell["accent"],
        anchor="mm",
    )

    label_y = pill_y + pill_height + (80 if compact else 108)
    d.text((cx, label_y), cell["label"], font=label_font, fill=TEXT, anchor="mm")

    underline_y = label_y + (62 if compact else 82)
    underline_width = 76 if compact else 106
    d.rounded_rectangle(
        [cx - underline_width / 2, underline_y, cx + underline_width / 2, underline_y + 10],
        radius=5,
        fill=cell["accent"],
    )
    d.text(
        (cx, underline_y + (69 if compact else 88)),
        cell["cap"],
        font=cap_font,
        fill=CAPTION,
        anchor="mm",
    )


for item in TOP_CELLS:
    draw_cell(item, compact=False)

for item in BOTTOM_CELLS:
    draw_cell(item, compact=True)

output_path = OUT
output_path.parent.mkdir(parents=True, exist_ok=True)
img.save(output_path, optimize=True)
print("saved", output_path, img.size)
