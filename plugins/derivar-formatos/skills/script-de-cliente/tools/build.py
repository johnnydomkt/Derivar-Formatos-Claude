#!/usr/bin/env python3
"""Monta o script do cliente: motor + perfil -> Derivar_<Cliente>.jsx

uso: build.py PERFIL.js SAIDA.jsx
Verifica a sintaxe com node. O arquivo sai em UTF-8 com BOM e quebras CRLF
(o Photoshop no Windows lê corretamente acentos assim)."""
import sys, os, subprocess, tempfile, re
here = os.path.dirname(os.path.abspath(__file__))
eng = os.path.join(here, '..', 'engine')
perfil, saida = sys.argv[1], sys.argv[2]
app = open(os.path.join(eng, 'app.jsx'), encoding='utf-8').read()
core = open(os.path.join(eng, 'core.js'), encoding='utf-8').read()
cli = open(perfil, encoding='utf-8-sig').read().strip()
if 'var CLIENTE' not in cli:
    sys.exit('ERRO: o perfil precisa declarar "var CLIENTE = {...};"')
# O Photoshop (ExtendScript) é ES3: estes recursos quebram o script lá, mesmo passando no node
bad = [(r'=>', 'arrow function'), (r'\b(let|const)\s', 'let/const'), (r'`', 'template string'),
       (r'\.(forEach|map|filter|reduce|some|every|find|includes)\(', 'método de array ES5+'),
       (r'\bJSON\.', 'JSON (não existe no ExtendScript)'), (r'Object\.(keys|assign|entries)', 'Object.keys/assign')]
noComments = re.sub(r'//.*', '', cli)
for pat, what in bad:
    if re.search(pat, noComments):
        sys.exit(f'ERRO: o perfil usa {what} - o Photoshop não suporta. Reescreva em ES3 (for, var, function).')
out = app.replace('//@@CLIENTE@@', cli).replace('//@@CORE@@', core)
open(saida, 'w', encoding='utf-8-sig', newline='\r\n').write(out)
chk = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8')
chk.write(re.sub(r'^#target.*$', '', out, flags=re.M)); chk.close()
r = subprocess.run(['node', '--check', chk.name], capture_output=True, text=True)
os.unlink(chk.name)
if r.returncode:
    sys.exit('ERRO DE SINTAXE:\n' + r.stderr)
print('ok ->', saida)
