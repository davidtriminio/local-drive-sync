"""Genera build/icon.png e icon.ico (variante B: carpeta con insignia de sync)."""
import math
from PIL import Image, ImageDraw

S = 1024 * 2          # supersampling
K = S / 130           # escala desde el lienzo de 130 unidades
BG, TAB, BODY, ARC = '#0f172a', '#34d399', '#10b981', '#34d399'

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
r = lambda *v: [x * K for x in v]

d.rounded_rectangle(r(0, 0, 130, 130), radius=30 * K, fill=BG)
d.rounded_rectangle(r(22, 38, 58, 56), radius=4 * K, fill=TAB)
d.rounded_rectangle(r(22, 48, 108, 106), radius=8 * K, fill=BODY)

cx, cy, R, rad = 96, 98, 25, 13.5
d.ellipse(r(cx - R, cy - R, cx + R, cy + R), fill=BG)

def arc(a0, a1):
    w = 5.2 * K
    pts = [(cx + rad * math.cos(math.radians(a)), cy + rad * math.sin(math.radians(a)))
           for a in [a0 + (a1 - a0) * i / 40 for i in range(41)]]
    for p in pts:
        d.ellipse([p[0] * K - w / 2, p[1] * K - w / 2, p[0] * K + w / 2, p[1] * K + w / 2], fill=ARC)
    d.line([(x * K, y * K) for x, y in pts], fill=ARC, width=int(w), joint='curve')
    # punta de flecha en el extremo final, tangente al giro horario
    a = math.radians(a1)
    ex, ey = cx + rad * math.cos(a), cy + rad * math.sin(a)
    tx, ty = -math.sin(a), math.cos(a)
    nx, ny = math.cos(a), math.sin(a)
    head = [(ex + tx * 6.5, ey + ty * 6.5),
            (ex + nx * 6.5, ey + ny * 6.5),
            (ex - nx * 6.5, ey - ny * 6.5)]
    d.polygon([(x * K, y * K) for x, y in head], fill=ARC)

arc(195, 320)
arc(15, 140)

img = img.resize((1024, 1024), Image.LANCZOS)
img.save('build/icon.png')
img.save('build/icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)])
