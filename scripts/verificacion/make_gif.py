"""Arma un GIF a partir de los fotogramas de clip31.mjs, respetando las marcas de tiempo reales (reloj de pared).
python make_gif.py <dirClip> <salida.gif> [fps] [ancho]"""
import json, sys, os
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 10
width = int(sys.argv[4]) if len(sys.argv) > 4 else 800
data = json.load(open(os.path.join(d, 'frames.json')))
fr = data['frames']
t0 = fr[0]['t']
span = fr[-1]['t'] - t0
out_frames, k = [], 0
n = int(span * fps)
for j in range(n):
    t = t0 + j / fps
    while k + 1 < len(fr) and fr[k + 1]['t'] <= t:
        k += 1
    im = Image.open(os.path.join(d, 'frames', f"f{fr[k]['i']:04d}.jpg")).convert('RGB')
    h = int(im.height * width / im.width)
    out_frames.append(im.resize((width, h), Image.LANCZOS).quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE))
out_frames[0].save(out, save_all=True, append_images=out_frames[1:], duration=int(1000 / fps), loop=0, optimize=False)
print(len(out_frames), 'fotogramas', round(span, 1), 's', os.path.getsize(out) // 1024, 'KB')
