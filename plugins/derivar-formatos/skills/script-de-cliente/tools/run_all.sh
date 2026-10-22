#!/usr/bin/env bash
# Monta o script, roda no Photoshop simulado (2 modos) e gera a prévia.
# uso: run_all.sh ARQUIVO.psd perfil.js formatos.json PASTA_TRABALHO
set -e
T="$(cd "$(dirname "$0")" && pwd)"
PSD="$1"; PERFIL="$2"; FMT="$3"; W="$4"
mkdir -p "$W"
[ -f "$W/spec.json" ] || python3 -I "$T/psd2spec.py" "$PSD" "$W" > /dev/null
NOME=$(python3 -I -c "import re,sys;t=open(sys.argv[1],encoding='utf-8-sig').read();m=re.search(r'nome:\s*\"([^\"]+)\"',t);print(re.sub(r'[^A-Za-z0-9]+','_',m.group(1)).strip('_') if m else 'Cliente')" "$PERFIL")
python3 "$T/build.py" "$PERFIL" "$W/Derivar_$NOME.jsx"
node "$T/mock/run.js" "$W/spec.json" "$W/Derivar_$NOME.jsx" "$FMT" "$W/resultado_move.json" move > "$W/alerta_move.txt"
node "$T/mock/run.js" "$W/spec.json" "$W/Derivar_$NOME.jsx" "$FMT" "$W/resultado.json" > "$W/alerta.txt"
echo "--- resultado (Photoshop simulado):"; cat "$W/alerta.txt"
if grep -q "ERRO" "$W/alerta.txt" "$W/alerta_move.txt"; then echo ">>> HOUVE ERRO - corrigir antes de entregar"; fi
python3 -I "$T/preview.py" "$PSD" "$W/resultado.json" "$W/previa"
python3 -I "$T/units_report.py" "$W/resultado.json" > "$W/unidades.txt" && echo "unidades -> $W/unidades.txt"
