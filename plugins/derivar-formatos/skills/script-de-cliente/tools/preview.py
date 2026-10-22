#!/usr/bin/env python3
"""Desenha a prévia dos formatos com os pixels reais do PSD, usando as posições
calculadas pelo script (saída do Photoshop simulado).

uso: preview.py ARQUIVO.psd resultado.json PASTA_SAIDA
gera um PNG por formato/prancheta e PASTA/previa.png (folha com todos)."""
import json, sys, os, warnings
warnings.filterwarnings('ignore')
from psd_tools import PSDImage
from PIL import Image, ImageDraw, ImageFont
psd = PSDImage.open(sys.argv[1]); res = json.load(open(sys.argv[2])); out = sys.argv[3]
os.makedirs(out, exist_ok=True)

def by_pid():
    m = {}
    def walk(ls, pre):
        ls = list(ls)
        for i, l in enumerate(ls):
            pid = (pre + '/' if pre else '') + str(i)
            m[pid] = l
            if l.is_group(): walk(l, pid)
    walk(psd, '')
    return m
PL = by_pid()
CACHE = {}
def comp(pid):
    if pid not in CACHE:
        l = PL[pid]
        try: im = l.composite()
        except Exception: im = None
        CACHE[pid] = (im, l.bbox)
    return CACHE[pid]

def leaf_tr(n):
    b, b0 = n['b'], n['b0']
    w0 = b0[2] - b0[0]
    if w0 <= 0: return None
    s = (b[2] - b[0]) / w0
    return (round(s, 4), round(b[0] - s * b0[0], 1), round(b[1] - s * b0[1], 1))

def group_tr(n):
    trs = set()
    def walk(c):
        for x in c:
            if not x['visible']: continue
            if 'children' in x: walk(x['children'])
            elif x.get('kind', 0) != 20:
                t = leaf_tr(x)
                if t: trs.add(t)
    walk(n['children'])
    if len(trs) == 1: return trs.pop()
    return None

def paste(canvas, pid, tr, origin):
    im, bb = comp(pid)
    if im is None or bb[2] - bb[0] <= 0: return
    s, dx, dy = tr
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    if w > 6000 or h > 6000: return
    im = im.convert('RGBA').resize((w, h), Image.LANCZOS)
    x, y = round(s * bb[0] + dx - origin[0]), round(s * bb[1] + dy - origin[1])
    canvas.alpha_composite(im, (x, y)) if x >= 0 and y >= 0 and x + w <= canvas.width and y + h <= canvas.height else _paste_clip(canvas, im, x, y)

def _paste_clip(canvas, im, x, y):
    l, t = max(0, -x), max(0, -y)
    r, b = min(im.width, canvas.width - x), min(im.height, canvas.height - y)
    if r <= l or b <= t: return
    canvas.alpha_composite(im.crop((l, t, r, b)), (x + l, y + t))

def render(nodes, canvas, origin):
    for n in reversed(nodes):                      # de baixo para cima
        if not n['visible']: continue
        if 'children' in n:
            tr = group_tr(n)
            if tr: paste(canvas, n['pid'], tr, origin)
            else: render(n['children'], canvas, origin)
        else:
            if n.get('kind') == 20 or n.get('grouped'): continue   # ajuste / clipping (vai com a base)
            tr = leaf_tr(n)
            if tr: paste(canvas, n['pid'], tr, origin)

sheet_items = []
for arq in res['arquivos']:
    boards = [n for n in arq['camadas'] if n.get('artboard')]
    if not boards:
        W = max(n['b'][2] for n in arq['camadas'] if 'b' in n) if False else None
    for bd in boards:
        l, t, r, b = bd['artboard']
        cv = Image.new('RGBA', (round(r - l), round(b - t)), (255, 255, 255, 255))
        render(bd['children'], cv, (l, t))
        name = arq['arquivo'].replace('.psd', '') + '__' + ''.join(c if c.isalnum() else '_' for c in bd['name'])[:40]
        cv.convert('RGB').save(os.path.join(out, name + '.png'))
        sheet_items.append((bd['name'], cv))
    if not boards:
        print('aviso: documento sem prancheta - prévia não suportada para', arq['arquivo'])

font = ImageFont.load_default()
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except Exception: pass
thumbs = []
for lab, c in sheet_items:
    W, H = c.size; sc = 1 if max(W, H) <= 600 else min(520 / H, 760 / W)
    thumbs.append((lab, c.resize((max(1, round(W * sc)), max(1, round(H * sc))), Image.LANCZOS)))
SW, pad = 1800, 24; x = y = pad; rowh = 0; pos = []
for lab, t in thumbs:
    if x + t.width > SW - pad and x > pad: x = pad; y += rowh + pad + 26; rowh = 0
    pos.append((x, y, lab, t)); x += t.width + pad; rowh = max(rowh, t.height)
sh = Image.new('RGB', (SW, y + rowh + pad + 26), '#ececec'); d = ImageDraw.Draw(sh)
for x, y, lab, t in pos:
    d.text((x, y), lab, fill='#222', font=font); sh.paste(t.convert('RGB'), (x, y + 24))
sh.save(os.path.join(out, 'previa.png'))
print('ok ->', os.path.join(out, 'previa.png'))
