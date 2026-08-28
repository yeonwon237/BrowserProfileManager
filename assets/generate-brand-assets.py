from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SCALE = 4

def render(size):
    n = size * SCALE
    unit = size / 64 * SCALE
    image = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    pixels = image.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / max(1, 2 * (n - 1))
            if t < .52:
                q = t / .52; a, b = (37, 99, 235), (79, 70, 229)
            else:
                q = (t - .52) / .48; a, b = (79, 70, 229), (124, 58, 237)
            pixels[x, y] = tuple(round(a[i] + (b[i] - a[i]) * q) for i in range(3)) + (255,)
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle((4*unit, 4*unit, 60*unit, 60*unit), radius=17*unit, fill=255)
    image.putalpha(mask)
    d = ImageDraw.Draw(image)
    p = lambda value: round(value * unit)
    d.line([(p(19),p(19)),(p(32),p(32)),(p(45),p(19))], fill=(245,250,255,255), width=p(5.5), joint='curve')
    d.line([(p(32),p(32)),(p(32),p(46))], fill=(165,243,252,255), width=p(5.5))
    d.line([(p(18),p(46)),(p(18),p(33)),(p(31),p(46))], fill=(255,255,255,235), width=p(4.5), joint='curve')
    for x, y, color in [(19,19,(255,255,255,255)),(45,19,(196,181,253,255)),(32,46,(103,232,249,255))]:
        d.ellipse((p(x-4),p(y-4),p(x+4),p(y+4)), fill=color)
    return image.resize((size,size), Image.Resampling.LANCZOS)

sizes = [16, 24, 32, 48, 64, 128, 256, 512]
images = {size: render(size) for size in sizes}
images[512].save(ROOT / 'logo-512.png')
images[256].save(ROOT / 'logo-256.png')
images[32].save(ROOT / 'favicon-32.png')
images[256].save(ROOT / 'icon.ico', format='ICO', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Generated YNlogin brand assets:', ', '.join(str(p.name) for p in [ROOT/'icon.ico', ROOT/'logo-512.png', ROOT/'logo-256.png', ROOT/'favicon-32.png']))
