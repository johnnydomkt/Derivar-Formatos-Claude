var CLIENTE = {
    // Nome que aparece no título da janela e no nome do arquivo de presets
    nome: "Cliente",
    // Versão do perfil (aumente a cada ajuste) e data
    versao: "1.0",
    data: "",
    // Formatos marcados por padrão na janela (o designer ainda pode digitar outros)
    formatos: [
        { label: "Story",         w: 1080, h: 1920 },
        { label: "Feed quadrado", w: 1080, h: 1080 },
        { label: "Google Ads",    w: 1200, h: 1200 },
        { label: "Google Ads",    w: 1200, h: 628  },
        { label: "Google Ads",    w: 300,  h: 600  },
        { label: "Google Ads",    w: 300,  h: 250  },
        { label: "Google Ads",    w: 728,  h: 90   }
    ],
    // Dicas de nome de camada por papel (expressões regulares, sem diferenciar maiúsculas).
    // Só são usadas quando a camada não tem tag #. Papéis: bg, hero, logo, url, eyebrow,
    // headline, sub, cta. Ex.: headline: ["^t[ií]tulo", "headline"], logo: ["logo", "marca"]
    nomes: {},
    // Camadas que o script deve deixar exatamente onde estão (regex no nome)
    ignorar: [],
    // Ajustes do motor para este cliente (veja references/perfil-cliente.md)
    ajustes: {},
    // Ajustes por formato: chave "LxA" (ex.: "728x90") ou tipo:
    // "story", "retrato", "quadrado", "paisagem", "faixa", "pequeno"
    porFormato: {},
    // Regra final opcional: recebe o layout calculado e pode corrigir posições.
    // ctx = { formato:{label,w,h}, quadroOriginal:{w,h}, unidades:[...], layout:{mode, items, bgAy} }
    // layout.items[i] = { x, y, s, hidden } para a unidade i (coordenadas do novo formato)
    depoisDoLayout: null
};
