"""生成游戏图标（纯几何绘制，与游戏内视觉语言一致）"""
import math
from PIL import Image, ImageDraw, ImageFilter

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 深海底
d.rounded_rectangle([8, 8, S - 8, S - 8], radius=96, fill=(4, 18, 26, 255))
ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
rd.rounded_rectangle([8, 8, S - 8, S - 8], radius=96, outline=(62, 240, 200, 90), width=6)
img.alpha_composite(ring)

cx, cy = S * 0.5, S * 0.60

# 灯锥
cone = Image.new("RGBA", (S, S), (0, 0, 0, 0))
cd = ImageDraw.Draw(cone)
half = math.radians(31)
L = S * 0.62
pts = [(cx, cy)]
for i in range(25):
    a = -math.pi / 2 - half + (2 * half) * i / 24
    pts.append((cx + math.cos(a) * L, cy + math.sin(a) * L))
cd.polygon(pts, fill=(62, 240, 200, 70))
cone = cone.filter(ImageFilter.GaussianBlur(14))
img.alpha_composite(cone)

# 放大一点
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(62, 240, 200, 40))
glow = glow.filter(ImageFilter.GaussianBlur(30))
img.alpha_composite(glow)

# 飞船
ship = [(cx + 86, cy - 86), (cx - 58, cy - 6), (cx - 22, cy + 4), (cx - 58, cy + 6)]
f = Image.new("RGBA", (S, S), (0, 0, 0, 0))
fd = ImageDraw.Draw(f)
fd.polygon(ship, fill=(12, 43, 50, 255), outline=(62, 240, 200, 255), width=8)
img.alpha_composite(f)

# 舷窗
d.ellipse([cx - 4, cy - 16, cx + 18, cy + 6], fill=(160, 255, 235, 255))

# 敌光
e = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ed = ImageDraw.Draw(e)
ed.ellipse([S * 0.72, S * 0.20, S * 0.86, S * 0.34], fill=(255, 79, 163, 150))
e = e.filter(ImageFilter.GaussianBlur(24))
img.alpha_composite(e)
d.ellipse([S * 0.775, S * 0.255, S * 0.805, S * 0.285], fill=(255, 190, 220, 255))

img.save(r"D:\downlight\build\icon.ico",
         sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
img.resize((256, 256), Image.LANCZOS).save(r"D:\downlight\build\icon-preview.png")
print("icon ok")
