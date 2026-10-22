#!/usr/bin/env python3
"""Resumo legível do que o motor identificou e decidiu em cada formato.
uso: units_report.py resultado.json"""
import json, sys
r = json.load(open(sys.argv[1]))
for d in r.get('unidades', []):
    L = d['layout']
    print(f"\n=== {d['prancheta']}  {d['formato']}  modo: {L['mode']}")
    for i, u in enumerate(d['unidades']):
        it = L['items'].get(str(i))
        st = 'OCULTO' if it and it['hidden'] else (f"x={it['x']:.0f} y={it['y']:.0f} escala={it['s']:.2f}" if it else '—')
        print(f"  [{i}] {u.get('name','')[:34]:34} {u['kind']:5} papel={u.get('role') or '-':8} fonte={u.get('font',0):5.1f} "
              f"orig=({u['l']:.0f},{u['t']:.0f} {u['w']:.0f}x{u['h']:.0f}) -> {st}")
