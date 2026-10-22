#!/usr/bin/env python3
"""Extrai o bloco PERFIL DO CLIENTE de um Derivar_<Cliente>.jsx já entregue,
para atualizar o perfil ou remontar com uma versão nova do motor.

uso: extract_profile.py Derivar_X.jsx perfil.js"""
import sys, re
t = open(sys.argv[1], encoding='utf-8-sig').read().replace('\r\n', '\n')
m = re.search(r'// 1\) PERFIL DO CLIENTE\n// =+\n(.*?)\n// =+\n// FIM DO PERFIL DO CLIENTE', t, re.S)
if not m:
    m = re.search(r'(var CLIENTE = \{.*?\n\};)', t, re.S)
if not m:
    sys.exit('ERRO: bloco do perfil não encontrado (script anterior ao formato com perfil?)')
open(sys.argv[2], 'w', encoding='utf-8').write(m.group(1).strip() + '\n')
v = re.search(r'ENGINE_VERSION = "([^"]+)"', t)
print('perfil extraído ->', sys.argv[2], '| motor do arquivo:', v.group(1) if v else 'desconhecido')
