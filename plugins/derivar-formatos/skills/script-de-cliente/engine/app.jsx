// =====================================================================
//  DERIVAR FORMATOS  -  Photoshop (ExtendScript)
//  Script de derivação de formatos com perfil de cliente.
//  Mantém camadas, textos, smart objects e estilos editáveis.
//
//  Instalação: copie este arquivo para a pasta Presets\Scripts do
//  Photoshop e reinicie. Ele aparece em Arquivo > Scripts.
//  (Ou rode direto por Arquivo > Scripts > Procurar...)
//
//  Estrutura do arquivo:
//    1) PERFIL DO CLIENTE  - regras específicas deste cliente (editável)
//    2) MOTOR DE LAYOUT    - igual para todos os clientes (não editar)
//    3) PHOTOSHOP          - leitura de camadas, transformações, janela
// =====================================================================
#target photoshop
app.bringToFront();

(function () {

var ENGINE_VERSION = "3.2";

// =====================================================================
// 1) PERFIL DO CLIENTE
// =====================================================================
//@@CLIENTE@@
// =====================================================================
// FIM DO PERFIL DO CLIENTE
// =====================================================================

var VERSION = ENGINE_VERSION + (CLIENTE.versao ? " / perfil " + CLIENTE.versao : "");
var ROLE_KEYS = ["hero", "logo", "url", "eyebrow", "headline", "sub", "cta"];
var ALIASES = {
    "fundo": "bg", "background": "bg",
    "imagem": "hero", "produto": "hero", "foto": "hero",
    "site": "url", "arroba": "url",
    "chapeu": "eyebrow", "sobretitulo": "eyebrow",
    "titulo": "headline", "title": "headline",
    "apoio": "sub", "subtitulo": "sub", "texto": "sub",
    "botao": "cta", "button": "cta"
};
var DEFAULT_FORMATS = [
    { label: "Story",           w: 1080, h: 1920 },
    { label: "Feed quadrado",   w: 1080, h: 1080 },
    { label: "Google Ads",      w: 1200, h: 1200 },
    { label: "Google Ads",      w: 1200, h: 628  },
    { label: "Google Ads",      w: 300,  h: 600  },
    { label: "Google Ads",      w: 300,  h: 250  },
    { label: "Google Ads",      w: 728,  h: 90   }
];
var DEFAULT_PRESETS = [
    { name: CLIENTE.nome + " - padrão", formats: CLIENTE.formatos || DEFAULT_FORMATS }
];

// =====================================================================
// 2) MOTOR DE LAYOUT
// =====================================================================
//@@CORE@@

// =====================================================================
// 3) PHOTOSHOP
// =====================================================================

var cTID = function (s) { return charIDToTypeID(s); };
var sTID = function (s) { return stringIDToTypeID(s); };
var LOG = [], STEP = "", DONE = 0, WARN = {}, ADJ = null;
var PRESET_FILE = new File(Folder.userData + "/DerivarFormatos/presets_" + slug(CLIENTE.nome) + ".txt");

// ---------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------
var presets = loadPresets();
var cfg = showDialog(presets);
if (!cfg) return;
if (!cfg.formats.length) { alert("Nenhum formato selecionado."); return; }

var oldUnits = app.preferences.rulerUnits, oldDialogs = app.displayDialogs;
app.preferences.rulerUnits = Units.PIXELS;
app.displayDialogs = DialogModes.NO;
var outFolders = [];
try {
    if (cfg.folderMode) {
        var fo = Folder.selectDialog("Escolha a pasta com os PSDs aprovados");
        if (!fo) return;
        var files = fo.getFiles(function (f) { return f instanceof File && /\.(psd|psb)$/i.test(f.name); });
        if (!files.length) { alert("Nenhum PSD encontrado nessa pasta."); return; }
        var outF = new Folder(fo + "/derivados");
        for (var i = 0; i < files.length; i++) {
            var d = app.open(files[i]);
            processDoc(d, cfg, outF);
            d.close(SaveOptions.DONOTSAVECHANGES);
        }
        outFolders.push(outF);
    } else {
        var src = app.activeDocument, out;
        try { out = new Folder(src.path + "/derivados"); }
        catch (e) { out = Folder.selectDialog("O arquivo ainda não foi salvo. Escolha a pasta de saída:"); }
        if (!out) return;
        processDoc(src, cfg, out);
        outFolders.push(out);
    }
} finally {
    app.preferences.rulerUnits = oldUnits;
    app.displayDialogs = oldDialogs;
}

alert("Arquivos gerados: " + DONE +
      (outFolders.length ? "\nPasta: " + decodeURI(outFolders[0].fsName) : "") +
      (LOG.length ? "\n\nAvisos:\n" + LOG.join("\n") : ""));

// ---------------------------------------------------------------------
function processDoc(src, cfg, folder) {
    if (!folder.exists) folder.create();
    var base = src.name.replace(/\.[^\.]+$/, "");
    var used = {};
    for (var i = 0; i < cfg.formats.length; i++) {
        var f = cfg.formats[i];
        var id = slug(f.label) + "_" + f.w + "x" + f.h;
        if (used[id]) id += "_" + i; used[id] = true;
        try {
            STEP = "duplicar";
            build(src, f, id, cfg, folder, base);
            DONE++;
        } catch (err) {
            LOG.push(base + " / " + f.label + " " + f.w + "x" + f.h + ": ERRO na etapa [" + STEP + "] - " + err + (err.line ? " (linha " + err.line + ")" : ""));
            try { if (app.activeDocument !== src) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        }
        app.activeDocument = src;
    }
}

function build(src, f, id, cfg, folder, base) {
    var doc = src.duplicate(base + "__" + id, false);
    app.activeDocument = doc;

    STEP = "analisar pranchetas";
    var abs = findArtboards(doc), i;
    if (!abs.length) {
        var O0 = { l: 0, t: 0, w: px(doc.width), h: px(doc.height) };
        doc.resizeCanvas(UnitValue(f.w, "px"), UnitValue(f.h, "px"), AnchorPosition.TOPLEFT);
        layoutFrame(doc, O0, { l: 0, t: 0 }, f, cfg, base);
    } else {
        var items = [];
        for (i = 0; i < abs.length; i++) items.push({ L: abs[i], r: artboardRect(abs[i]) });
        // ordem de leitura: de cima para baixo, da esquerda para a direita
        items.sort(function (a, b) { return Math.abs(a.r.t - b.r.t) > 10 ? a.r.t - b.r.t : a.r.l - b.r.l; });
        var GAP = 100, minL = 1e9, maxB = -1e9;
        for (i = 0; i < items.length; i++) { minL = Math.min(minL, items[i].r.l); maxB = Math.max(maxB, items[i].r.b); }
        for (i = 0; i < items.length; i++) {
            var it = items[i];
            var O = { l: it.r.l, t: it.r.t, w: it.r.r - it.r.l, h: it.r.b - it.r.t };
            // 1 prancheta: fica no mesmo lugar. Várias (carrossel): nova fileira abaixo das originais
            var N = items.length == 1 ? { l: O.l, t: O.t } : { l: minL + i * (f.w + GAP), t: maxB + GAP * 2 };
            var name = it.L.name;
            STEP = "prancheta \"" + name + "\" - tamanho";
            var ref = refLayer(it.L), b0 = ref ? bounds(ref) : null;
            setArtboardRect(it.L, N.l, N.t, N.l + f.w, N.t + f.h);
            var C = { l: O.l, t: O.t, w: O.w, h: O.h };
            if (ref) { var b1 = bounds(ref); C.l += b1[0] - b0[0]; C.t += b1[1] - b0[1]; } // se o PS levou o conteúdo junto
            layoutFrame(it.L, C, N, f, cfg, base + " / " + name);
            try { it.L.name = name + " - " + f.label + " " + f.w + "x" + f.h; } catch (e) {}
        }
    }

    STEP = "salvar";
    var opts = new PhotoshopSaveOptions();
    opts.layers = true; opts.embedColorProfile = true; opts.alphaChannels = true;
    doc.saveAs(new File(folder + "/" + base + "__" + id + ".psd"), opts, true, Extension.LOWERCASE);
    doc.close(SaveOptions.DONOTSAVECHANGES);
}

// Diagrama um quadro: C = onde o conteúdo está (origem + tamanho original),
// N = canto superior esquerdo do novo quadro (f.w x f.h)
function layoutFrame(container, C, N, f, cfg, who) {
    var stepBase = STEP.replace(/ - tamanho$/, "");
    STEP = stepBase + " - analisar camadas";
    var S = scan(container, C);

    // unidades: papéis marcados (#titulo, #logo...) + demais elementos visíveis
    var units = [], roleOf = [], k;
    for (k in S.roles) { units.push(S.roles[k]); roleOf.push(k); }
    for (k = 0; k < S.free.length; k++) { units.push(S.free[k]); roleOf.push(null); }
    var U = [], keep = [];
    for (var i = 0; i < units.length; i++) {
        var ub = unionBounds(units[i]);
        if (ub[2] - ub[0] < 1 || ub[3] - ub[1] < 1) continue;
        var fi = fontInfo(units[i]);
        U.push({ l: ub[0] - C.l, t: ub[1] - C.t, w: ub[2] - ub[0], h: ub[3] - ub[1],
                 kind: unitKind(units[i]), font: fi.max, minFont: fi.min, role: roleOf[i], name: units[i][0].name });
        keep.push(units[i]);
    }

    var tune = mergeTune(CLIENTE.ajustes, formatTune(f));
    var mode = cfg.layout == "reorganizar" ? "reorganizar" : (tune.modo || cfg.layout);
    var L = autoLayout(U, C, f.w, f.h, { textScale: cfg.textScale * (tune.escalaTexto || 1), mode: mode, bgAlign: cfg.bgAlign != "auto" ? cfg.bgAlign : (tune.fundo || "auto"), tune: tune });
    if (typeof DEBUG_UNITS != "undefined") DEBUG_UNITS.push({ formato: f.w + "x" + f.h, prancheta: who, unidades: U, layout: L, ajustes: tune });
    if (CLIENTE.depoisDoLayout) {
        try {
            CLIENTE.depoisDoLayout({ formato: { label: f.label, w: f.w, h: f.h }, quadroOriginal: { w: C.w, h: C.h },
                                     unidades: U, layout: L, modo: L.mode });
        } catch (eHook) { warn("regra do perfil (depoisDoLayout) falhou: " + eHook); }
    }
    var sb = Math.max(f.w / C.w, f.h / C.h);

    STEP = stepBase + " - fundo";
    if (S.bg) {
        if (S.bg.typename == "ArtLayer" && S.bg.isBackgroundLayer) S.bg.isBackgroundLayer = false;
        transformSafe(S.bg, C.l, C.t, sb, N.l + (f.w - C.w * sb) / 2 - C.l, N.t + (f.h - C.h * sb) * L.bgAy - C.t);
    } else warn(who + ": fundo não encontrado (nomeie o grupo do fundo como #fundo)");

    STEP = stepBase + " - layout " + L.mode;
    for (i = 0; i < keep.length; i++) {
        var it = L.items[i];
        if (!it) continue;
        if (it.hidden) { setVisible(keep[i], false); continue; }
        try { placeLayers(keep[i], C.l + U[i].l, C.t + U[i].t, N.l + it.x, N.t + it.y, it.s); }
        catch (e) { warn("\"" + keep[i][0].name + "\" ficou na posição original"); }
    }
}

// tipo da unidade: texto, imagem, forma ou grupo (ex.: botão = forma + texto)
// ajustes do perfil: gerais + do formato (por "LxA" ou por tipo: story, quadrado, paisagem, faixa, pequeno)
function formatTune(f) {
    var by = CLIENTE.porFormato || {}, out = {}, a = f.w / f.h, keys = [];
    if (a >= 3) keys.push("faixa"); else if (a > 1.15) keys.push("paisagem"); else if (a >= 0.95) keys.push("quadrado");
    else if (f.h / f.w >= 1.7) keys.push("story"); else keys.push("retrato");
    if (Math.min(f.w, f.h) < 320) keys.push("pequeno");
    keys.push(f.w + "x" + f.h);
    for (var i = 0; i < keys.length; i++) if (by[keys[i]]) for (var k in by[keys[i]]) out[k] = by[keys[i]][k];
    return out;
}

function mergeTune(a, b) {
    var o = {}, k;
    if (a) for (k in a) o[k] = a[k];
    if (b) for (k in b) o[k] = b[k];
    return o;
}

function unitKind(ls) {
    var base = [], i;
    for (i = 0; i < ls.length; i++) if (!(ls[i].typename == "ArtLayer" && ls[i].grouped)) base.push(ls[i]);
    if (base.length != 1) return "group";
    var L = base[0];
    if (L.typename == "LayerSet") return onlyText(L) ? "text" : "group";
    try {
        if (L.kind == LayerKind.TEXT) return "text";
        if (L.kind == LayerKind.SOLIDFILL || L.kind == LayerKind.GRADIENTFILL || L.kind == LayerKind.PATTERNFILL) return "shape";
    } catch (e) {}
    return "image";
}

// grupo cujo conteúdo visível é só texto (ex.: grupo com o site)
function onlyText(S) {
    var any = false;
    for (var i = 0; i < S.layers.length; i++) {
        var L = S.layers[i];
        if (!L.visible) continue;
        if (L.typename == "LayerSet") { if (!onlyText(L)) return false; any = true; continue; }
        var isT = false;
        try { isT = L.kind == LayerKind.TEXT; } catch (e) {}
        if (!isT) return false;
        any = true;
    }
    return any;
}

// maior e menor tamanho de letra (px) dentro da unidade
function fontInfo(ls) {
    var r = { max: 0, min: 0 }, res = 72;
    try { res = app.activeDocument.resolution; } catch (e) {}
    function visit(L) {
        if (!L.visible) return;
        if (L.typename == "LayerSet") { for (var j = 0; j < L.layers.length; j++) visit(L.layers[j]); return; }
        var isText = false;
        try { isText = L.kind == LayerKind.TEXT; } catch (e) {}
        if (!isText) return;
        var sizes = textSizes(L, res);
        for (var s = 0; s < sizes.length; s++) {
            if (sizes[s] <= 0) continue;
            r.max = Math.max(r.max, sizes[s]);
            r.min = r.min ? Math.min(r.min, sizes[s]) : sizes[s];
        }
    }
    for (var i = 0; i < ls.length; i++) visit(ls[i]);
    return r;
}

function textSizes(L, res) {
    var out = [];
    try {
        var ref = new ActionReference();
        ref.putIdentifier(cTID("Lyr "), L.id);
        var tk = executeActionGet(ref).getObjectValue(sTID("textKey"));
        var yy = 1;
        if (tk.hasKey(sTID("transform"))) {
            var tr = tk.getObjectValue(sTID("transform"));
            yy = Math.sqrt(Math.pow(tr.getDouble(sTID("yy")), 2) + Math.pow(tr.getDouble(sTID("xy")), 2));
        }
        var rng = tk.getList(sTID("textStyleRange"));
        for (var i = 0; i < rng.count; i++) {
            var st = rng.getObjectValue(i).getObjectValue(sTID("textStyle")), v;
            if (st.hasKey(sTID("impliedFontSize"))) v = st.getUnitDoubleValue(sTID("impliedFontSize"));
            else v = st.getUnitDoubleValue(sTID("size")) * yy;
            out.push(v * res / 72);
        }
    } catch (e) {}
    if (!out.length) {
        try {
            var b = bounds(L), lines = String(L.textItem.contents).split(/\r|\n|\u0003/).length;
            out.push((b[3] - b[1]) / Math.max(1, lines) * 0.85);
        } catch (e2) {}
    }
    return out;
}

// uma camada visível qualquer para detectar se o conteúdo se moveu
function refLayer(c) {
    for (var i = 0; i < c.layers.length; i++) {
        var L = c.layers[i];
        if (L.typename == "LayerSet") { var r = refLayer(L); if (r) return r; continue; }
        if (!canTransform(L)) continue;
        var b = bounds(L);
        if (b[2] - b[0] >= 1 && b[3] - b[1] >= 1) return L;
    }
    return null;
}

// ---------------------------------------------------------------------
// LEITURA DAS CAMADAS
// ---------------------------------------------------------------------
function normTag(name) {
    var m = /^#(\S+)/.exec(name);
    if (!m) return null;
    var t = m[1].toLowerCase()
        .replace(/[áàâã]/g, "a").replace(/[éê]/g, "e").replace(/[í]/g, "i")
        .replace(/[óôõ]/g, "o").replace(/[ú]/g, "u").replace(/[ç]/g, "c")
        .replace(/[^a-z0-9\-]/g, "");
    return ALIASES[t] || t;
}

function scan(container, O) {
    var res = { roles: {}, bg: null, free: [] }, taken = {}, k, i;
    var found = {};
    for (i = 0; i < ROLE_KEYS.length; i++) found[ROLE_KEYS[i]] = [];

    (function rec(c) {
        for (var i = 0; i < c.layers.length; i++) {
            var L = c.layers[i], tag = normTag(L.name);
            if (tag == "bg") { if (!res.bg) res.bg = L; continue; }
            if (tag && found[tag]) { found[tag].push(L); continue; }
            if (L.typename == "LayerSet") rec(L);
        }
    })(container);

    // dicas de nome do perfil do cliente (expressões regulares)
    var hints = CLIENTE.nomes || {};
    for (k in found) {
        if (found[k].length || !hints[k]) continue;
        for (i = 0; i < hints[k].length; i++) {
            var Lh = findByRegex(container, hints[k][i]);
            if (Lh) { found[k].push(Lh); break; }          // primeira dica que encontrar
        }
    }
    var bgHints = (hints.bg || []).concat(["^(bg|fundo|background)$"]);
    for (i = 0; i < bgHints.length && !res.bg; i++) res.bg = findByRegex(container, bgHints[i]);
    if (!res.bg) res.bg = guessBg(container, O);
    if (res.bg) taken[res.bg.id] = true;
    // camadas que o perfil manda deixar como estão
    if (CLIENTE.ignorar && CLIENTE.ignorar.length) (function ig(c) {
        for (var a = 0; a < c.layers.length; a++) {
            var Li = c.layers[a];
            for (var b = 0; b < CLIENTE.ignorar.length; b++)
                if (new RegExp(CLIENTE.ignorar[b], "i").test(Li.name)) { taken[Li.id] = true; break; }
            if (Li.typename == "LayerSet" && !taken[Li.id]) ig(Li);
        }
    })(container);

    // não deixa a mesma camada entrar duas vezes (grupo + camada dentro dele)
    for (k in found) {
        var clean = [];
        for (i = 0; i < found[k].length; i++) {
            var dup = false;
            for (var q = 0; q < found[k].length; q++)
                if (q != i && isAncestor(found[k][q], found[k][i])) dup = true;
            if (!dup) clean.push(found[k][i]);
        }
        found[k] = clean;
    }
    for (k in found) {
        var ls = [], vis = false;
        for (i = 0; i < found[k].length; i++) {
            var withC = withClipped(found[k][i]);
            for (var j = 0; j < withC.length; j++) if (!taken[withC[j].id]) { ls.push(withC[j]); taken[withC[j].id] = true; }
            if (found[k][i].visible) vis = true;
        }
        if (ls.length && vis) res.roles[k] = ls;
    }

    // elementos soltos: tudo que é visível e não pertence a um papel/fundo
    (function rec2(c) {
        for (var i = 0; i < c.layers.length; i++) {
            var L = c.layers[i];
            if (taken[L.id] || !L.visible) continue;
            if (L.typename == "ArtLayer" && L.grouped) continue; // segue a base
            if (!canTransform(L)) continue;                       // ajuste solto vale para tudo
            if (L.typename == "LayerSet" && (containsTaken(L, taken) || mixesHeroAndText(L, O))) { rec2(L); continue; }
            var b = bounds(L);
            if (b[2] - b[0] < 1 || b[3] - b[1] < 1) continue;
            var unit = withClipped(L);
            for (var j = 0; j < unit.length; j++) taken[unit[j].id] = true;
            res.free.push(unit);
        }
    })(container);
    return res;
}

// camada + camadas com máscara de corte logo acima dela
function withClipped(L) {
    var out = [L];
    if (L.typename != "ArtLayer") return out;
    var sib = L.parent.layers, idx = -1;
    for (var i = 0; i < sib.length; i++) if (sib[i] == L) { idx = i; break; }
    for (var j = idx - 1; j >= 0; j--) {
        if (sib[j].typename == "ArtLayer" && sib[j].grouped) out.push(sib[j]); else break;
    }
    return out;
}

// grupo grande que mistura imagem grande e texto: analisa por dentro
function mixesHeroAndText(S, O) {
    var hasText = false, hasBig = false;
    (function v(G) {
        for (var i = 0; i < G.layers.length; i++) {
            var L = G.layers[i];
            if (!L.visible) continue;
            if (L.typename == "LayerSet") { v(L); continue; }
            var isT = false;
            try { isT = L.kind == LayerKind.TEXT; } catch (e) {}
            if (isT) { hasText = true; continue; }
            var b = bounds(L);
            if ((b[2] - b[0]) * (b[3] - b[1]) >= 0.06 * O.w * O.h && (b[2] - b[0]) < 0.9 * O.w) hasBig = true;
        }
    })(S);
    return hasText && hasBig;
}

function containsTaken(S, taken) {
    for (var i = 0; i < S.layers.length; i++) {
        var L = S.layers[i];
        if (taken[L.id]) return true;
        if (L.typename == "LayerSet" && containsTaken(L, taken)) return true;
    }
    return false;
}

function guessBg(container, O) {
    for (var i = container.layers.length - 1; i >= 0; i--) {
        var L = container.layers[i];
        if (!L.visible || !canTransform(L)) continue;
        var b = bounds(L);
        var cover = (Math.min(b[2], O.l + O.w) - Math.max(b[0], O.l)) * (Math.min(b[3], O.t + O.h) - Math.max(b[1], O.t));
        if (cover >= 0.9 * O.w * O.h) return L;
    }
    return null;
}

function findByRegex(container, pattern) {
    var re = new RegExp(pattern, "i");
    for (var i = 0; i < container.layers.length; i++) {
        var L = container.layers[i];
        if (re.test(L.name)) return L;
        if (L.typename == "LayerSet") { var r = findByRegex(L, pattern); if (r) return r; }
    }
    return null;
}

function isAncestor(A, L) {
    var p = L.parent;
    while (p && p.typename == "LayerSet") { if (p == A) return true; p = p.parent; }
    return false;
}

function inList(a, v) { for (var i = 0; i < a.length; i++) if (a[i] == v) return true; return false; }

function findByName(container, name) {
    for (var i = 0; i < container.layers.length; i++) {
        var L = container.layers[i];
        if (L.name == name) return L;
        if (L.typename == "LayerSet") { var r = findByName(L, name); if (r) return r; }
    }
    return null;
}

// ---------------------------------------------------------------------
// TRANSFORMAÇÕES
// ---------------------------------------------------------------------
function px(v) { return Number(v.as ? v.as("px") : v); }

function bounds(L) {
    var b;
    try { b = L.boundsNoEffects; } catch (e) {}
    if (!b) b = L.bounds;
    return [px(b[0]), px(b[1]), px(b[2]), px(b[3])];
}

function unionBounds(ls) {
    var u = null, any = false;
    for (var pass = 0; pass < 2 && !any; pass++) {
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i];
            if (pass == 0 && L.typename == "ArtLayer" && L.grouped) continue; // clipping não conta na medida
            var b = bounds(L);
            if (b[2] - b[0] < 1) continue;
            any = true;
            u = u ? [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] : b;
        }
    }
    return u || [0, 0, 0, 0];
}

function canTransform(L) {
    if (L.typename == "LayerSet") return true;
    if (!ADJ) {
        ADJ = {};
        var names = ["BLACKANDWHITE", "BRIGHTNESSCONTRAST", "CHANNELMIXER", "COLORBALANCE", "CURVES", "EXPOSURE",
                     "GRADIENTMAP", "HUESATURATION", "INVERSION", "LEVELS", "PHOTOFILTER", "POSTERIZE",
                     "SELECTIVECOLOR", "THRESHOLD", "VIBRANCE", "COLORLOOKUP"];
        for (var i = 0; i < names.length; i++) try { ADJ[String(LayerKind[names[i]])] = true; } catch (e) {}
    }
    try { return !ADJ[String(L.kind)]; } catch (e) { return true; }
}

function coverage(b, O) {
    var w = Math.min(b[2], O.l + O.w) - Math.max(b[0], O.l), h = Math.min(b[3], O.t + O.h) - Math.max(b[1], O.t);
    return (w > 0 && h > 0) ? (w * h) / (O.w * O.h) : 0;
}

function warn(msg) { if (!WARN) WARN = {}; if (!WARN[msg]) { WARN[msg] = true; LOG.push("Aviso: " + msg); } }

function setVisible(ls, v) { for (var i = 0; i < ls.length; i++) ls[i].visible = v; }

// escala cada camada a partir do ponto (ax,ay) e leva esse ponto até (tx,ty)
function placeLayers(ls, ax, ay, tx, ty, s) {
    for (var i = 0; i < ls.length; i++) {
        transformSafe(ls[i], ax, ay, s, tx - ax, ty - ay);
    }
}

// Transforma e move uma camada/grupo. Se o Photoshop recusar (camada de
// preenchimento sem máscara, ajuste, grupo que contém uma delas...), tenta
// camada por camada dentro do grupo e simplesmente pula o que não aceita.
function transformSafe(L, ax, ay, s, dx, dy) {
    if (!canTransform(L) || isInfiniteFill(L)) return;      // valem para a peça toda
    var scale = Math.abs(s - 1) > 0.0001;
    try {
        if (scale) { transformAround(L, ax, ay, s); scaleEffects(L, s); }
        moveBy(L, dx, dy);
        return;
    } catch (e) {}
    if (L.typename == "LayerSet") {
        for (var i = 0; i < L.layers.length; i++) transformSafe(L.layers[i], ax, ay, s, dx, dy);
    } else warn("\"" + L.name + "\" ficou na posição original (o Photoshop não permitiu transformar)");
}

// camada de preenchimento (cor/degradê/padrão) sem máscara: já cobre tudo
function isInfiniteFill(L) {
    if (L.typename != "ArtLayer") return false;
    var k;
    try { k = L.kind; } catch (e) { return false; }
    if (k != LayerKind.SOLIDFILL && k != LayerKind.GRADIENTFILL && k != LayerKind.PATTERNFILL) return false;
    try { return !layerDesc(L).getBoolean(sTID("hasVectorMask")) && !layerDesc(L).getBoolean(sTID("hasUserMask")); }
    catch (e) { return false; }
}

function moveBy(L, dx, dy) {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    var lk = unlockTree(L, []);
    try { L.translate(UnitValue(dx, "px"), UnitValue(dy, "px")); } finally { relock(lk); }
}

function unlockTree(L, saved) {
    var st = {};
    try { st.all = L.allLocked; } catch (e) {}
    try { st.pos = L.positionLocked; } catch (e) {}
    try { st.pix = L.pixelsLocked; } catch (e) {}
    try { st.tr = L.transparentPixelsLocked; } catch (e) {}
    saved.push({ L: L, st: st });
    try { if (L.allLocked) L.allLocked = false; } catch (e) {}
    try { if (L.positionLocked) L.positionLocked = false; } catch (e) {}
    try { if (L.pixelsLocked) L.pixelsLocked = false; } catch (e) {}
    if (L.typename == "LayerSet")
        for (var i = 0; i < L.layers.length; i++) unlockTree(L.layers[i], saved);
    return saved;
}

function relock(saved) {
    for (var i = saved.length - 1; i >= 0; i--) {
        var L = saved[i].L, st = saved[i].st;
        try { if (st.pix) L.pixelsLocked = true; } catch (e) {}
        try { if (st.pos) L.positionLocked = true; } catch (e) {}
        try { if (st.tr) L.transparentPixelsLocked = true; } catch (e) {}
        try { if (st.all) L.allLocked = true; } catch (e) {}
    }
}

function transformAround(L, x, y, s) {
    var locks = unlockTree(L, []);
    try { transformCore(L, x, y, s); } finally { relock(locks); }
}

function transformCore(L, x, y, s) {
    app.activeDocument.activeLayer = L;
    try {
        var desc = new ActionDescriptor(), ref = new ActionReference();
        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), ref);
        desc.putEnumerated(cTID("FTcs"), cTID("QCSt"), cTID("Qcsi"));
        var p = new ActionDescriptor();
        p.putUnitDouble(cTID("Hrzn"), cTID("#Pxl"), x);
        p.putUnitDouble(cTID("Vrtc"), cTID("#Pxl"), y);
        desc.putObject(cTID("Pstn"), cTID("Pnt "), p);
        var o = new ActionDescriptor();
        o.putUnitDouble(cTID("Hrzn"), cTID("#Pxl"), 0);
        o.putUnitDouble(cTID("Vrtc"), cTID("#Pxl"), 0);
        desc.putObject(cTID("Ofst"), cTID("Ofst"), o);
        desc.putUnitDouble(cTID("Wdth"), cTID("#Prc"), s * 100);
        desc.putUnitDouble(cTID("Hght"), cTID("#Prc"), s * 100);
        desc.putEnumerated(cTID("Intr"), cTID("Intp"), cTID("Bcbc"));
        executeAction(cTID("Trnf"), desc, DialogModes.NO);
    } catch (e) {
        var b0 = bounds(L);
        L.resize(s * 100, s * 100, AnchorPosition.TOPLEFT);
        var b1 = bounds(L);
        L.translate(UnitValue(x + (b0[0] - x) * s - b1[0], "px"), UnitValue(y + (b0[1] - y) * s - b1[1], "px"));
    }
}

function scaleEffects(L, s) {
    app.activeDocument.activeLayer = L;
    try {
        var d = new ActionDescriptor();
        d.putUnitDouble(cTID("Scl "), cTID("#Prc"), s * 100);
        executeAction(sTID("scaleEffectsEvent"), d, DialogModes.NO);
    } catch (e) { /* sem estilos */ }
}

// ---------------------------------------------------------------------
// ARTBOARD
// ---------------------------------------------------------------------
function layerDesc(L) {
    var ref = new ActionReference();
    ref.putIdentifier(cTID("Lyr "), L.id);
    return executeActionGet(ref);
}

function findArtboards(doc) {
    var out = [];
    for (var i = 0; i < doc.layers.length; i++) {
        var L = doc.layers[i];
        if (L.typename != "LayerSet" || !L.visible) continue;
        try { if (layerDesc(L).getBoolean(sTID("artboardEnabled"))) out.push(L); } catch (e) {}
    }
    return out;
}

function artboardRect(L) {
    var r = layerDesc(L).getObjectValue(sTID("artboard")).getObjectValue(sTID("artboardRect"));
    return { l: r.getDouble(sTID("left")), t: r.getDouble(sTID("top")),
             r: r.getDouble(sTID("right")), b: r.getDouble(sTID("bottom")) };
}

function setArtboardRect(L, l, t, r, b) {
    app.activeDocument.activeLayer = L;
    var desc = new ActionDescriptor(), ref = new ActionReference();
    ref.putEnumerated(sTID("layer"), sTID("ordinal"), sTID("targetEnum"));
    desc.putReference(sTID("null"), ref);
    var ab = new ActionDescriptor(), rect = new ActionDescriptor();
    rect.putDouble(sTID("top"), t); rect.putDouble(sTID("left"), l);
    rect.putDouble(sTID("bottom"), b); rect.putDouble(sTID("right"), r);
    ab.putObject(sTID("artboardRect"), sTID("classFloatRect"), rect);
    desc.putObject(sTID("artboard"), sTID("artboard"), ab);
    desc.putInteger(sTID("changeSizes"), 1);
    executeAction(sTID("editArtboardEvent"), desc, DialogModes.NO);
}

// ---------------------------------------------------------------------
// PRESETS
// ---------------------------------------------------------------------
function loadPresets() {
    try {
        if (PRESET_FILE.exists) {
            PRESET_FILE.encoding = "UTF-8";
            PRESET_FILE.open("r"); var s = PRESET_FILE.read(); PRESET_FILE.close();
            var p = eval(s);
            if (p && p.length) return p;
        }
    } catch (e) {}
    return eval(DEFAULT_PRESETS.toSource());
}

function savePresets(p) {
    var fo = PRESET_FILE.parent;
    if (!fo.exists) fo.create();
    PRESET_FILE.encoding = "UTF-8";
    PRESET_FILE.open("w"); PRESET_FILE.write(p.toSource()); PRESET_FILE.close();
}

function parseSizes(txt) {
    var out = [], re = /(\d{2,5})\s*[xX×\*]\s*(\d{2,5})/g, m;
    while ((m = re.exec(txt)) !== null) out.push({ label: "Personalizado", w: parseInt(m[1], 10), h: parseInt(m[2], 10) });
    return out;
}

function slug(s) {
    return String(s).toLowerCase()
        .replace(/[áàâã]/g, "a").replace(/[éê]/g, "e").replace(/[í]/g, "i")
        .replace(/[óôõ]/g, "o").replace(/[ú]/g, "u").replace(/[ç]/g, "c")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------
// JANELA
// ---------------------------------------------------------------------
function showDialog(presets) {
    var w = new Window("dialog", "Derivar Formatos - " + CLIENTE.nome + "  (" + VERSION + ")");
    w.orientation = "column"; w.alignChildren = "fill";

    var gp = w.add("group");
    gp.add("statictext", undefined, "Cliente / preset:");
    var dd = gp.add("dropdownlist", undefined, []);
    dd.preferredSize.width = 250;
    var bSave = gp.add("button", undefined, "Salvar como...");
    var bDel = gp.add("button", undefined, "Excluir");

    var pf = w.add("panel", undefined, "Formatos do preset");
    pf.alignChildren = "fill"; pf.margins = 14;
    var list = pf.add("group");
    list.orientation = "column"; list.alignChildren = "left";
    var gsel = pf.add("group");
    var bAll = gsel.add("button", undefined, "Marcar todos");
    var bNone = gsel.add("button", undefined, "Desmarcar todos");

    var pc = w.add("panel", undefined, "Tamanhos personalizados (px)");
    pc.alignChildren = "fill"; pc.margins = 14;
    var et = pc.add("edittext", undefined, "");
    et.preferredSize.width = 420;
    pc.add("statictext", undefined, "Largura x altura, separados por vírgula. Ex.: 1080x1920, 970x250, 160x600");

    var pa = w.add("panel", undefined, "Ajustes");
    pa.orientation = "row"; pa.margins = 14;
    pa.add("statictext", undefined, "Layout:");
    var LM = ["auto", "reorganizar"];
    var ddL = pa.add("dropdownlist", undefined, ["Automático", "Sempre reorganizar"]); ddL.selection = 0;
    ddL.helpTip = "Automático: mantém a composição original quando a proporção permite; quando não, reorganiza mantendo a hierarquia (imagem principal, título, marca).";
    pa.add("statictext", undefined, "   Texto:");
    var TS = [0.8, 0.9, 1, 1.1, 1.2];
    var ddT = pa.add("dropdownlist", undefined, ["80%", "90%", "100%", "110%", "120%"]); ddT.selection = 2;
    pa.add("statictext", undefined, "   Fundo:");
    var BA = ["auto", "topo", "centro", "base"];
    var ddB = pa.add("dropdownlist", undefined, ["Automático", "Topo", "Centro", "Base"]); ddB.selection = 0;

    var ps = w.add("panel", undefined, "Arquivos");
    ps.orientation = "row"; ps.margins = 14;
    var r1 = ps.add("radiobutton", undefined, "Documento aberto");
    var r2 = ps.add("radiobutton", undefined, "Todos os PSDs de uma pasta");
    if (app.documents.length) r1.value = true; else { r1.enabled = false; r2.value = true; }

    w.add("statictext", undefined, "Os arquivos são salvos na pasta \"derivados\", ao lado do original.");
    var gb = w.add("group"); gb.alignment = "right";
    gb.add("button", undefined, "Cancelar", { name: "cancel" });
    var bOk = gb.add("button", undefined, "Gerar", { name: "ok" });

    var cbs = [], current = 0;

    function fillList() {
        while (list.children.length) list.remove(list.children[0]);
        cbs = [];
        var fm = presets[current].formats;
        for (var i = 0; i < fm.length; i++) {
            var cb = list.add("checkbox", undefined, fm[i].label + "   " + fm[i].w + " x " + fm[i].h);
            cb.value = true; cbs.push(cb);
        }
        w.layout.layout(true);
    }
    function fillDD(sel) {
        dd.onChange = null;
        dd.removeAll();
        for (var i = 0; i < presets.length; i++) dd.add("item", presets[i].name);
        current = Math.min(sel || 0, presets.length - 1);
        dd.selection = current;
        dd.onChange = function () { if (dd.selection) { current = dd.selection.index; fillList(); } };
        fillList();
    }
    function collect() {
        var out = [], fm = presets[current].formats;
        for (var i = 0; i < cbs.length; i++) if (cbs[i].value) out.push({ label: fm[i].label, w: fm[i].w, h: fm[i].h });
        return out.concat(parseSizes(et.text));
    }

    bAll.onClick = function () { for (var i = 0; i < cbs.length; i++) cbs[i].value = true; };
    bNone.onClick = function () { for (var i = 0; i < cbs.length; i++) cbs[i].value = false; };
    bSave.onClick = function () {
        var fm = collect();
        if (!fm.length) { alert("Marque ou digite pelo menos um formato."); return; }
        var name = prompt("Nome do preset (ex.: nome do cliente).\nVai conter os formatos marcados + os personalizados digitados.", presets[current].name);
        if (!name) return;
        var idx = -1;
        for (var i = 0; i < presets.length; i++) if (presets[i].name == name) idx = i;
        if (idx >= 0 && !confirm("Já existe um preset \"" + name + "\". Substituir?")) return;
        var np = { name: name, formats: fm };
        if (idx >= 0) presets[idx] = np; else { presets.push(np); idx = presets.length - 1; }
        savePresets(presets);
        et.text = "";
        fillDD(idx);
    };
    bDel.onClick = function () {
        if (presets.length <= 1) { alert("Mantenha pelo menos um preset."); return; }
        if (!confirm("Excluir o preset \"" + presets[current].name + "\"?")) return;
        presets.splice(current, 1);
        savePresets(presets);
        fillDD(0);
    };

    var result = null;
    bOk.onClick = function () {
        result = { formats: collect(), layout: LM[ddL.selection.index], textScale: TS[ddT.selection.index], bgAlign: BA[ddB.selection.index], folderMode: r2.value };
        w.close(1);
    };
    fillDD(0);
    if (w.show() != 1) return null;
    return result;
}

})();
