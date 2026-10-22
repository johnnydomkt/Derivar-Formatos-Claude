---
name: script-de-cliente
description: Cria ou atualiza o script de derivação de formatos do Photoshop (arquivo Derivar_NomeDoCliente.jsx) de um cliente da agência, a partir de um PSD aprovado. Use quando o designer pedir "criar o script do cliente", "script de derivação", "desdobrar formatos", "gerar Story / Google Ads a partir do PSD", "atualizar o script do cliente X", ou anexar um PSD junto com um Derivar_*.jsx.
---

# Script de derivação por cliente

Entrega um `Derivar_<Cliente>.jsx` que o designer roda no próprio Photoshop para gerar,
a partir do criativo aprovado (normalmente 1080x1350), PSDs **editáveis** em outros formatos
(Story, quadrado, Google Ads, tamanhos livres, carrossel com várias pranchetas).

O script = **motor** (igual para todos, em `engine/`) + **perfil do cliente** (regras daquele
cliente, um bloco `var CLIENTE = {...}`). O trabalho deste skill é escrever e validar o perfil.
Nunca edite `engine/` para atender um cliente específico — use o perfil.

Converse com o designer em português, em linguagem simples, sem caminhos de arquivo nem jargão
de código. Nunca peça para ele renomear camadas ou usar tags: cada designer nomeia de um jeito.

## 1. Reunir o material

- **PSD aprovado** do cliente (anexo ou pasta do computador). Obrigatório.
- **Nome do cliente** e **formatos** que ele usa. Se não disser, use os padrões do modelo
  (Story, Feed quadrado, Google Ads 1200x1200, 1200x628, 300x600, 300x250, 728x90) e diga isso.
- **Opcional, mas pedir uma vez:** versões que o designer já fez à mão em outros formatos
  (PNG ou PSD). São a melhor referência de como o cliente adapta a peça.
- **Atualização:** se ele mandar um `Derivar_<Cliente>.jsx` existente, extraia o perfil com
  `tools/extract_profile.py` e continue a partir dele (aumente `versao`).

## 2. Preparar o ambiente

Copie a pasta deste skill para o diretório de trabalho. Verifique `python3 -c "import psd_tools"`
(se faltar: `pip install --break-system-packages psd-tools`) e `node --version`.
Trabalhe numa cópia do PSD; o original é do designer.

## 3. Entender a peça

```
python3 tools/psd2spec.py CLIENTE.psd TRAB/
```
Leia `TRAB/estrutura.txt` e **olhe** `TRAB/original.png` (e os PNGs por prancheta).
Descreva para você mesmo, em 3–5 linhas: o que é fundo, se há faixa/forma de fundo, qual é a
imagem principal, título, textos de apoio, botão, marca, e como estão alinhados.

## 4. Primeira rodada

Copie `engine/perfil-modelo.js` para `TRAB/perfil.js`, preencha `nome`, `versao`, `data` e
`formatos`. Escreva os formatos em `TRAB/formatos.json` (`[{"label":"Story","w":1080,"h":1920},...]`).
```
bash tools/run_all.sh CLIENTE.psd TRAB/perfil.js TRAB/formatos.json TRAB/
```
Isso monta o script, roda no Photoshop simulado (dois modos de prancheta), gera
`TRAB/previa/previa.png` e `TRAB/unidades.txt` (o que o motor identificou e decidiu).
Se aparecer "HOUVE ERRO", corrija antes de seguir.

## 5. Avaliar e ajustar (o centro do trabalho)

Olhe a prévia comparando com o original e com as referências do designer. Checklist por formato:
- a imagem principal, o título, a marca e o botão aparecem e estão inteiros;
- o título está legível e é o maior texto; a hierarquia é a mesma do original;
- nada se sobrepõe de forma estranha; margens coerentes; Story livre nas áreas da interface;
- o enquadramento do fundo mostra a parte importante da foto;
- formatos que mantêm a proporção parecem a mesma peça; os reorganizados parecem da mesma família.

Quando algo errar, descubra a causa em `unidades.txt` (papel/tipo/fonte errados? modo errado?)
e corrija no perfil, na ordem de preferência:
1. **`ajustes` / `porFormato`** — parâmetros do motor (ex.: lado da imagem, enquadramento, quando
   reorganizar, tamanho de texto). Valem para qualquer criativo do cliente.
2. **`nomes`** — só quando o motor não reconhece um papel. Use regex tolerante a variações
   (`"logo|marca"`), nunca o texto exato de uma campanha.
3. **`ignorar`** — camadas que devem ficar paradas (ex.: moldura, selo fixo).
4. **`depoisDoLayout`** — regra em código para um ajuste fino que os itens acima não resolvem.
   Escreva-a por tipo/tamanho/posição das unidades, não por nome de campanha.

Detalhes, chaves e exemplos: `references/perfil-cliente.md`. Rode `run_all.sh` de novo a cada
mudança e olhe a prévia de novo. Pare quando o checklist passar (normalmente 2–5 rodadas).
O código do perfil roda no Photoshop (ExtendScript = JavaScript antigo, ES3): só `var`, `for`,
`function`; nada de `=>`, `let/const`, `forEach/map`, `JSON`. O `build.py` recusa isso.

## 6. Mostrar ao designer

Envie `previa.png` com uma frase dizendo quais formatos mantiveram a composição e quais foram
reorganizados. Explique que é uma prévia simulada (as fontes e efeitos podem variar um pouco no
Photoshop). Pergunte se quer mudar algo e aplique os pedidos no perfil (passo 5).

## 7. Entregar

- Rode `run_all.sh` uma última vez (sem "ERRO" nos dois modos).
- Envie `Derivar_<Cliente>.jsx` e a prévia final.
- Instruções curtas: copiar para a pasta `Presets\Scripts` do Photoshop e reiniciar (aparece em
  Arquivo > Scripts), ou rodar por Arquivo > Scripts > Procurar. Na janela: formatos marcados,
  campo de tamanhos personalizados, documento aberto ou pasta inteira. Saída na pasta `derivados`.
- Peça que ele rode uma vez no Photoshop e mande print se algo sair diferente da prévia
  (ou a mensagem de aviso/erro do final). Com isso, volte ao passo 5.
- Diga que, para atualizar o script depois (layout novo, formato novo), basta mandar o `.jsx`
  atual junto com o PSD novo.

## Quando o problema é no Photoshop real

Se o designer mandar uma mensagem de erro do script, leia `references/armadilhas-photoshop.md`
antes de mexer: a maioria dos casos (camada travada, camada de preenchimento, ajuste, prancheta,
acentos) já está documentada lá com a correção. Se a correção for no motor (vale para todos os
clientes), faça no `engine/`, teste com `examples/perfil-rgc.js` também, e avise o designer que
a correção deve ser levada a quem mantém o plugin.
