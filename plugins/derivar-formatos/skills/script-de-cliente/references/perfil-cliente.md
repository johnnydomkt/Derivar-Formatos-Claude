# Perfil do cliente — referência

O perfil é um único objeto `var CLIENTE = {...};` (ES3). Modelo: `engine/perfil-modelo.js`.
Exemplo real: `examples/perfil-rgc.js`.

## Como o motor decide (resumo)

1. **Leitura**: encontra o fundo (`#fundo`/`bg`/dica `nomes.bg`, senão a camada mais baixa que
   cobre ≥90% do quadro). Cada elemento visível vira uma **unidade** (camada ou grupo; camadas com
   clipping vão junto da base). Grupo grande que mistura imagem grande e texto é aberto.
   Tipos: `text`, `image`, `shape`, `group` (grupo misto, ex. botão). Para textos, lê o tamanho
   real da fonte em px.
2. **Faixas**: unidade não-texto que ocupa ≥90% da largura (ou altura) encostada numa borda
   acompanha o fundo, presa àquela borda (ex.: forma creme de baixo).
3. **Tentativa fiel**: se a proporção mudou no máximo `fielMaxAspect` (padrão 1,7x), agrupa
   unidades próximas em blocos, usa uma escala única e ancora cada bloco na borda onde estava.
   Rejeita se houver sobreposição sem encolher além de 80% ou se o título ficar menor que
   `max(minHeadlinePx, minHeadlineFrac × menor lado)`.
4. **Reorganizar**: imagem principal (maior imagem visível, área ≥ `heroMinArea`) ganha uma zona
   (`heroZone` do espaço, lado `heroSide`); o resto vira linhas de blocos, cada uma voltando para
   topo/meio/base como no original, alinhamento esquerda/centro/direita preservado. Textos
   secundários abaixo de `minFont` px saem, menor primeiro. Nunca saem: imagem principal, maior
   texto, grupos (botões/selos), marca. Faixas (proporção ≥ `stripAspect`): tudo em linha, só
   textos ≥ `strongTextRatio` do título.

## Chaves do perfil

| chave | tipo | uso |
|---|---|---|
| `nome`, `versao`, `data` | texto | identificação; aparece na janela |
| `formatos` | lista `{label,w,h}` | formatos marcados por padrão |
| `nomes` | `{papel: [regex,...]}` | força papel quando o motor erra. Papéis: `bg`, `hero`, `logo`, `url`, `eyebrow`, `headline`, `sub`, `cta`. Usa a primeira regex que encontrar. `hero` vira a imagem principal; `headline` nunca é escondido; `logo` nunca é escondido |
| `ignorar` | `[regex,...]` | camadas/grupos que ficam exatamente onde estão |
| `ajustes` | objeto | parâmetros do motor para todos os formatos |
| `porFormato` | `{chave: ajustes}` | ajustes só para alguns formatos. Chaves: `"728x90"` (exato) ou tipo: `story` (altura/largura ≥1,7), `retrato`, `quadrado` (0,95–1,15), `paisagem` (>1,15), `faixa` (≥3), `pequeno` (menor lado <320). Várias podem valer; a mais específica (LxA) vence |
| `depoisDoLayout` | `function(ctx)` | ajuste fino final (abaixo) |

### Parâmetros aceitos em `ajustes` / `porFormato`

Do perfil: `modo` (`"auto"` ou `"reorganizar"`), `escalaTexto` (multiplica a escala; 1 = normal),
`fundo` (`"auto"`, `"topo"`, `"centro"`, `"base"`: enquadramento do fundo).

Do motor (valores padrão entre parênteses):
`fielMaxAspect` (1.7), `minHeadlinePx` (14), `minHeadlineFrac` (0.045), `minFont` (8),
`heroMinArea` (0.06), `heroZone` (0.42), `heroSide` (`"auto"`|`"left"`|`"right"`|`"top"`|`"bottom"`),
`stripAspect` (3), `strongTextRatio` (0.6), `marginFrac` (0.06), `storySafeTop` (0.13),
`storySafeBottom` (0.18), `scaleExp` (0.35; 0 = encaixar, 1 = preencher), `clusterGap` (0.03).

Exemplos:
```js
ajustes: { heroSide: "left" },                       // imagem sempre à esquerda ao reorganizar
porFormato: {
    "story":   { fielMaxAspect: 2 },                  // Story sempre tenta manter a composição
    "paisagem":{ modo: "reorganizar", fundo: "base" },
    "faixa":   { heroZone: 0.25 },
    "300x250": { escalaTexto: 1.15 }
}
```

## `depoisDoLayout(ctx)`

Chamado em cada formato/prancheta depois do cálculo, antes de mover as camadas.
```
ctx.formato        {label, w, h}
ctx.quadroOriginal {w, h}
ctx.unidades[i]    {name, kind, role, font, minFont, l, t, w, h}   (medidas no original)
ctx.layout.mode    "fiel" | "reorganizado"
ctx.layout.items[i]{x, y, s, hidden}   (posição do canto superior esquerdo no novo quadro, escala)
ctx.layout.bgAy    enquadramento vertical do fundo (0 topo … 1 base)
```
Altere `ctx.layout.items` diretamente. Uma unidade com tamanho final `u.w*s × u.h*s`.
Escreva em ES3. Identifique unidades por papel/tipo/tamanho/posição, não por texto de campanha.

Exemplo — no Story, marca centralizada embaixo:
```js
depoisDoLayout: function (ctx) {
    var f = ctx.formato, U = ctx.unidades, I = ctx.layout.items, i;
    if (f.h / f.w < 1.7) return;
    for (i = 0; i < U.length; i++) {
        if (U[i].role != "logo" || !I[i] || I[i].hidden) continue;
        var w = U[i].w * I[i].s, h = U[i].h * I[i].s;
        I[i].x = (f.w - w) / 2;
        I[i].y = f.h * 0.82 - h;
    }
}
```
Exemplo — achar a marca sem nome confiável (menor imagem perto de um canto):
```js
function acharMarca(U, Q) {
    var best = -1, i;
    for (i = 0; i < U.length; i++) {
        var u = U[i]; if (u.kind != "image") continue;
        var canto = (u.l < Q.w * 0.25 || u.l + u.w > Q.w * 0.75) && (u.t < Q.h * 0.25 || u.t + u.h > Q.h * 0.75);
        if (canto && u.w * u.h < Q.w * Q.h * 0.05 && (best < 0 || u.w * u.h < U[best].w * U[best].h)) best = i;
    }
    return best;
}
```

## Boas práticas

- Prefira poucas regras gerais a muitas regras de exceção; o perfil precisa funcionar nos próximos
  criativos do cliente, feitos por outros designers.
- Antes de entregar, teste o perfil com todos os PSDs do cliente que tiver.
- Aumente `versao` a cada entrega e registre em comentário o que mudou.
