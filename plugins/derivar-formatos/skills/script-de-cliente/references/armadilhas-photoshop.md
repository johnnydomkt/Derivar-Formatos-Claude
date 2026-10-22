# Armadilhas do Photoshop já resolvidas no motor

Antes de "corrigir" algo, confirme se o motor já trata o caso. Tudo abaixo aconteceu de verdade.

| Sintoma (mensagem no fim da execução) | Causa | Como o motor trata |
|---|---|---|
| `O comando "Transformar" não está disponível` na etapa fundo | camada **travada** (cadeado) dentro do grupo do fundo | `unlockTree` destrava, transforma e trava de novo |
| idem, em `elementos soltos` / `layout` | **camada de ajuste** (Curvas, Níveis…) solta ou com clipping | ajustes não são transformados; os soltos ficam parados (valem para tudo) |
| idem, em `prancheta "X" - fundo` (carrossel) | **camada de preenchimento** (Cor Sólida/Degradê/Padrão) sem máscara, ou grupo que contém uma | `transformSafe`: pula preenchimentos infinitos; se um grupo é recusado, tenta camada por camada |
| `undefined não é um objeto` | variável global usada antes de ser inicializada (o código principal roda no topo do IIFE) | inicialize globais junto de `LOG`, nunca depois das funções |
| formato salvo, mas só a 1ª prancheta mudou | documento com várias pranchetas | `findArtboards` processa todas; novas pranchetas ficam numa fileira abaixo das originais |
| conteúdo deslocado depois de mover prancheta | versões do Photoshop diferem: mover prancheta leva ou não o conteúdo | o motor mede uma camada de referência antes/depois e compensa (testado nos 2 modos do simulador) |
| site/elemento minúsculo ou fora do quadro | a mesma camada entrou duas vezes numa unidade (grupo + filho) e foi transformada 2x | `isAncestor` remove duplicatas; dicas de `nomes` usam só a 1ª que encontrar |
| texto do botão sumiu na faixa | rótulo de botão tratado como texto secundário | `sitsOnSomething`: texto sobre outro elemento não sai sozinho |
| acentos quebrados nos nomes/mensagens | arquivo sem BOM lido como Windows-1252 | `build.py` grava UTF-8 com BOM e CRLF |
| `Erro de sintaxe` só no Photoshop | ExtendScript é ES3 | `build.py` recusa `=>`, `let/const`, template string, `forEach/map…`, `JSON`, `Object.keys` no perfil |

## Limites conhecidos

- O simulador não reproduz renderização de fonte, efeitos de camada nem modos de mesclagem: a
  prévia é aproximada. Posições, escalas e o que aparece/some são os mesmos do Photoshop.
- Documento **sem prancheta**: o script funciona (redimensiona a tela), mas `preview.py` só
  desenha documentos com prancheta.
- Pixel layers ampliados (ex.: fundo no Story ≈1,4x) perdem nitidez; smart objects e vetores não.
- Imagem contínua entre slides de carrossel (panorâmica): cada prancheta é ajustada sozinha, a
  emenda não é preservada.
- Fundo que não cobre o novo formato: sugerir ao designer o Preenchimento/Expansão Generativa do
  Photoshop só naquela camada.
