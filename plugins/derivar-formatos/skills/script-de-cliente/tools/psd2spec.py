#!/usr/bin/env python3
"""Lê um PSD e gera (1) a estrutura de camadas para o Photoshop simulado e
(2) um resumo legível + a imagem do original.

uso: psd2spec.py ARQUIVO.psd PASTA_SAIDA
saídas: PASTA/spec.json, PASTA/estrutura.txt, PASTA/original.png (e um PNG por prancheta)"""
import json, sys, os, warnings
warnings.filterwarnings('ignore')
from psd_tools import PSDImage
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
p = PSDImage.open(src)
KIND = {'type': 2, 'smartobject': 3, 'shape': 4, 'pixel': 1, 'solidcolorfill': 4,
        'gradientfill': 5, 'patternfill': 6}

def font(l):
    try:
        runs = l.engine_dict['StyleRun']['RunArray']
        sizes = [r['StyleSheet']['StyleSheetData'].get('FontSize', 0) for r in runs]
        t = l.transform
        yy = (t[2] ** 2 + t[3] ** 2) ** 0.5
        return round(max(sizes) * yy, 1)
    except Exception:
        return 0

def locked(l):
    try:
        from psd_tools.constants import Tag
        v = l._record.tagged_blocks.get_data(Tag.PROTECTED_SETTING)
        return bool(v) and (int(v) & 0x80000000) != 0
    except Exception:
        return False

def conv(l, pid):
    d = {'pid': pid, 'name': l.name, 'visible': l.visible, 'grouped': bool(getattr(l, 'clipping', False))}
    if l.is_group():
        if l.kind == 'artboard':
            d['artboard'] = list(l.bbox)
        kids = list(l)[::-1]                      # Photoshop: primeiro = topo
        d['children'] = [conv(c, pid + '/' + str(len(kids) - 1 - i)) for i, c in enumerate(kids)]
        return d
    k = KIND.get(l.kind, 20)                      # 20 = camada de ajuste
    d['kind'] = k
    d['b'] = list(l.bbox) if k != 20 else [0, 0, 0, 0]
    if k in (4, 5, 6) and not l.has_vector_mask() and not l.has_mask():
        d['infinite'] = True
    if k == 2:
        d['font'] = font(l); d['text'] = (l.text or '')[:120]
    if locked(l):
        d['allLocked'] = True
    return d

top = list(p)[::-1]
spec = {'name': os.path.basename(src), 'w': p.width, 'h': p.height,
        'layers': [conv(l, str(len(top) - 1 - i)) for i, l in enumerate(top)]}
json.dump(spec, open(os.path.join(out, 'spec.json'), 'w'), ensure_ascii=False)

NAMES = {1: 'pixel', 2: 'TEXTO', 3: 'smart', 4: 'forma', 5: 'degradê', 6: 'padrão', 20: 'ajuste'}
lines = [f"{spec['name']}  {p.width}x{p.height}"]
def show(ls, d=0):
    for l in ls:
        tag = 'PRANCHETA ' + str(l['artboard']) if 'artboard' in l else ('grupo' if 'children' in l else NAMES[l['kind']])
        extra = []
        if 'b' in l and l['kind'] != 20: extra.append(str(l['b']))
        if l.get('font'): extra.append(f"fonte {l['font']}px")
        if l.get('text'): extra.append('"' + l['text'].replace('\r', ' / ').replace('\n', ' / ')[:60] + '"')
        if l['grouped']: extra.append('[clipping]')
        if l.get('allLocked'): extra.append('[travada]')
        if l.get('infinite'): extra.append('[preenche tudo]')
        if not l['visible']: extra.append('(oculta)')
        lines.append('  ' * d + f"- {l['name']}  <{tag}>  " + '  '.join(extra))
        if 'children' in l: show(l['children'], d + 1)
show(spec['layers'])
open(os.path.join(out, 'estrutura.txt'), 'w').write('\n'.join(lines) + '\n')
img = p.composite()
img.convert('RGB').save(os.path.join(out, 'original.png'))
for l in p:
    if l.kind == 'artboard':
        x0, y0, x1, y1 = l.bbox
        img.crop((x0, y0, x1, y1)).convert('RGB').save(os.path.join(out, 'original_' + ''.join(c if c.isalnum() else '_' for c in l.name) + '.png'))
print('\n'.join(lines))
