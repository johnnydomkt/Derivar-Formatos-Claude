// Exemplo real: RGC (engenharia tributária). Criativo 1080x1350, foto em faixas
// diagonais como fundo, bloco de texto alinhado à esquerda embaixo, logo no topo
// à direita, site no topo à esquerda. Arquivos sem tags, nomes de camada variados.
var CLIENTE = {
    nome: "RGC",
    versao: "1.0",
    data: "2026-10-21",
    formatos: [
        { label: "Story",         w: 1080, h: 1920 },
        { label: "Feed quadrado", w: 1080, h: 1080 },
        { label: "Google Ads",    w: 1200, h: 1200 },
        { label: "Google Ads",    w: 1200, h: 628  },
        { label: "Google Ads",    w: 300,  h: 600  },
        { label: "Google Ads",    w: 300,  h: 250  },
        { label: "Google Ads",    w: 728,  h: 90   }
    ],
    nomes: {
        bg: ["^BG$"],
        logo: ["^Objeto Inteligente de Vetor", "logo"],
        url: ["^rodap", "\\.com\\.br"]
    },
    ignorar: [],
    ajustes: {},
    porFormato: {
        // exemplo: { "paisagem": { fundo: "base" } } mostraria a parte de baixo da foto nos banners largos
    },
    depoisDoLayout: null
};
