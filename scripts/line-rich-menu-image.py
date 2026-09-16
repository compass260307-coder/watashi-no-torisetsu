# Alice Plus: 恋愛特化リッチメニュー画像 (2500x1686) の生成。
#
# 使い方: python3 scripts/line-rich-menu-image.py [出力.jpg]
# 文字・アイコンを含むフェルト完成アートをLINE規定サイズへ整え、
# 1MB以下の最高品質JPEGとして保存する。タップ領域は
# richmenu-config.json / scripts/line-rich-menu.mjs の5領域に揃える。

import io
import sys
from pathlib import Path

from PIL import Image, ImageOps

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ARTWORK = PROJECT_ROOT / "public/line/alice-rich-menu-love-art-v5.png"
OUT = (
    Path(sys.argv[1])
    if len(sys.argv) > 1
    else PROJECT_ROOT / "public/line/alice-rich-menu-love-v5.jpg"
)

W, H = 2500, 1686
LINE_IMAGE_LIMIT = 1_000_000

artwork = Image.open(ARTWORK).convert("RGB")
image = ImageOps.fit(
    artwork,
    (W, H),
    method=Image.Resampling.LANCZOS,
    centering=(0.5, 0.5),
)


def save_under_line_limit(output: Path) -> int:
    """LINEの1MB制限に収まる最高品質のJPEGとして保存する。"""
    output.parent.mkdir(parents=True, exist_ok=True)
    for quality in range(88, 57, -2):
        buffer = io.BytesIO()
        image.save(
            buffer,
            format="JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
        )
        data = buffer.getvalue()
        if len(data) <= LINE_IMAGE_LIMIT:
            output.write_bytes(data)
            return len(data)
    raise RuntimeError("rich menu image could not be compressed below 1MB")


size = save_under_line_limit(OUT)
print("saved", OUT, image.size, f"{size} bytes")
