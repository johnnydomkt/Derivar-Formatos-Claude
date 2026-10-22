// =====================================================================
// MOTOR DE LAYOUT v3 (funções puras - sem Photoshop)
// Cada unidade U[i] = {l,t,w,h, kind, font, minFont, role}
//   medidas relativas ao quadro original O = {w,h}
//   kind: "text" | "image" | "shape" | "group"
//   font/minFont: maior/menor tamanho de letra em px (0 se não tem texto)
//   role: tag opcional (#titulo, #logo...) -> "headline", "logo", ...
// Resultado: para cada unidade {x, y, s, hidden} no novo quadro W x H
// =====================================================================
// Parâmetros ajustáveis por cliente (CLIENTE.ajustes) e por formato
var TUNE_DEFAULT = {
    fielMaxAspect: 1.7,      // até quanto a proporção pode mudar para tentar manter a composição
    minHeadlinePx: 14,       // título mínimo (px) para aceitar o layout fiel...
    minHeadlineFrac: 0.045,  // ...ou esta fração do menor lado, o que for maior
    minFont: 8,              // abaixo disso um texto secundário é ilegível
    heroMinArea: 0.06,       // área mínima (fração do quadro) para ser "imagem principal"
    heroZone: 0.42,          // fração do espaço reservada à imagem principal ao reorganizar
    heroSide: "auto",        // "auto" | "left" | "right" | "top" | "bottom"
    stripAspect: 3,          // a partir desta proporção vira faixa (logo | título | botão)
    strongTextRatio: 0.6,    // nas faixas só ficam textos >= esta fração do título
    marginFrac: 0.06,        // margem ao reorganizar (fração do menor lado)
    storySafeTop: 0.13,      // áreas seguras do Story (fração da altura)
    storySafeBottom: 0.18,
    scaleExp: 0.35,          // 0 = escala pelo encaixe, 1 = pelo preenchimento
    clusterGap: 0.03         // distância para agrupar elementos num mesmo bloco
};
var TUNE = TUNE_DEFAULT;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function bgAlignAuto(W, H, pref) {
    if (pref == "topo") return 0; if (pref == "centro") return 0.5; if (pref == "base") return 1;
    var a = W / H;
    return a > 1.15 ? 0.72 : (a >= 0.95 ? 0.6 : 0.5);
}

function isTextual(u) { return (u.font || 0) > 0; }

function isBand(u, O) {
    if (isTextual(u) || u.role == "logo") return false;
    var horiz = u.w >= 0.9 * O.w && (u.t <= 0.03 * O.h || u.t + u.h >= 0.97 * O.h);
    var vert = u.h >= 0.9 * O.h && (u.l <= 0.03 * O.w || u.l + u.w >= 0.97 * O.w);
    return horiz || vert;
}

// faixas/formas que ocupam a largura (ou altura) toda: acompanham o fundo,
// presas à borda em que estavam
function placeBand(u, O, W, H) {
    var s = Math.max(W / O.w, H / O.h), x, y;
    if (u.w >= 0.9 * O.w) {
        x = W / 2 - (O.w / 2 - u.l) * s;
        y = (u.t + u.h >= 0.97 * O.h) ? H - (O.h - u.t) * s : u.t * s;
    } else {
        y = H / 2 - (O.h / 2 - u.t) * s;
        x = (u.l + u.w >= 0.97 * O.w) ? W - (O.w - u.l) * s : u.l * s;
    }
    return { x: x, y: y, s: s, hidden: false };
}

// título precisa ficar pelo menos deste tamanho para manter o layout fiel
function minHeadline(W, H) { return Math.max(TUNE.minHeadlinePx, TUNE.minHeadlineFrac * Math.min(W, H)); }
// abaixo disso um texto secundário é considerado ilegível

function baseScale(W, H, O, ts) {
    var fit = Math.min(W / O.w, H / O.h), fill = Math.max(W / O.w, H / O.h);
    return fit * Math.pow(fill / fit, TUNE.scaleExp) * ts;
}

function safeZones(W, H) {
    var story = H / W >= 1.7;
    return { t: story ? TUNE.storySafeTop * H : 0, b: story ? TUNE.storySafeBottom * H : 0 };
}

// agrupa unidades próximas (union-find)
function clusterUnits(U, idx, O, gf) {
    var g = (gf === undefined ? TUNE.clusterGap : gf) * Math.min(O.w, O.h), par = {}, i, j;
    for (i = 0; i < idx.length; i++) par[idx[i]] = idx[i];
    function root(a) { while (par[a] != a) a = par[a] = par[par[a]]; return a; }
    for (i = 0; i < idx.length; i++) for (j = i + 1; j < idx.length; j++) {
        var a = U[idx[i]], b = U[idx[j]];
        if (a.l - g < b.l + b.w && b.l - g < a.l + a.w && a.t - g < b.t + b.h && b.t - g < a.t + a.h)
            par[root(idx[i])] = root(idx[j]);
    }
    var map = {}, B = [];
    for (i = 0; i < idx.length; i++) {
        var r = root(idx[i]);
        if (map[r] === undefined) { map[r] = B.length; B.push({ m: [] }); }
        B[map[r]].m.push(idx[i]);
    }
    for (i = 0; i < B.length; i++) {
        var bk = B[i]; bk.l = 1e9; bk.t = 1e9; bk.r = -1e9; bk.b = -1e9; bk.maxLine = 0;
        for (j = 0; j < bk.m.length; j++) {
            var u = U[bk.m[j]];
            bk.l = Math.min(bk.l, u.l); bk.t = Math.min(bk.t, u.t);
            bk.r = Math.max(bk.r, u.l + u.w); bk.b = Math.max(bk.b, u.t + u.h);
            bk.maxLine = Math.max(bk.maxLine, u.font || 0);
            if (u.role == "headline") bk.headline = true;
            if (u.role == "logo") bk.logo = true;
        }
        bk.m.sort(function (a, b) { return U[a].t - U[b].t; });
    }
    return B;
}

// ---------------------------------------------------------------------
// 1) TENTATIVA FIEL: mesma composição, uma escala só
// ---------------------------------------------------------------------
function tryFiel(U, idx, O, W, H, ts) {
    var B = clusterUnits(U, idx, O), i, j;
    var k0 = baseScale(W, H, O, ts), k = k0, sz = safeZones(W, H);
    var g = TUNE.clusterGap * Math.min(O.w, O.h), res, ok = false;
    while (k >= 0.8 * k0) {
        ok = true; res = [];
        for (i = 0; i < B.length; i++) {
            var b = B[i], bw = (b.r - b.l) * k, bh = (b.b - b.t) * k;
            var cx = (b.l + b.r) / 2 / O.w, cy = (b.t + b.b) / 2 / O.h, x, y;
            if (cx < 0.34) x = b.l * k; else if (cx > 0.66) x = W - (O.w - b.r) * k - bw; else x = cx * W - bw / 2;
            if (cy < 0.34) y = Math.max(b.t * k, sz.t);
            else if (cy > 0.66) y = H - Math.max((O.h - b.b) * k, sz.b) - bh;
            else y = cy * H - bh / 2;
            if (bw > W + 1 || bh > H - sz.t - sz.b + 1) ok = false;
            res.push({ x: clamp(x, 0, Math.max(0, W - bw)), y: clamp(y, 0, Math.max(0, H - bh)), w: bw, h: bh });
        }
        for (i = 0; i < res.length && ok; i++) for (j = i + 1; j < res.length; j++) {
            var a = res[i], c = res[j], pad = g * k * 0.5;
            if (a.x - pad < c.x + c.w && c.x - pad < a.x + a.w && a.y - pad < c.y + c.h && c.y - pad < a.y + a.h) { ok = false; break; }
        }
        if (ok) break;
        k *= 0.95;
    }
    if (!ok) return null;
    var maxF = 0;
    for (i = 0; i < idx.length; i++) maxF = Math.max(maxF, U[idx[i]].font || 0);
    if (maxF && maxF * k < minHeadline(W, H)) return null;   // título ficaria pequeno demais
    var out = {};
    for (i = 0; i < B.length; i++)
        for (j = 0; j < B[i].m.length; j++) {
            var ui = B[i].m[j];
            out[ui] = { x: res[i].x + (U[ui].l - B[i].l) * k, y: res[i].y + (U[ui].t - B[i].t) * k, s: k, hidden: false };
        }
    return out;
}

// ---------------------------------------------------------------------
// 2) REORGANIZAR: imagem principal numa área própria, blocos de texto
//    e marca empilhados com os mesmos alinhamentos; textos secundários
//    pequenos saem primeiro se faltar espaço.
// ---------------------------------------------------------------------
// texto em cima de outro elemento (ex.: rótulo de botão): não sai sozinho
function sitsOnSomething(U, idx, ti) {
    var u = U[ti];
    for (var i = 0; i < idx.length; i++) {
        if (idx[i] == ti) continue;
        var o = U[idx[i]];
        if (o.kind == "text") continue;
        var w = Math.min(u.l + u.w, o.l + o.w) - Math.max(u.l, o.l), h = Math.min(u.t + u.h, o.t + o.h) - Math.max(u.t, o.t);
        if (w > 0 && h > 0 && w * h >= 0.5 * u.w * u.h && o.w * o.h < 4 * u.w * u.h * 6) return true;
    }
    return false;
}

function findHero(U, idx, O) {
    for (var r = 0; r < idx.length; r++) if (U[idx[r]].role == "hero") return idx[r];
    var best = -1, bestA = TUNE.heroMinArea * O.w * O.h;
    for (var i = 0; i < idx.length; i++) {
        var u = U[idx[i]];
        if (isTextual(u) || u.role == "logo" || u.kind == "shape") continue;
        var vis = Math.max(0, Math.min(u.l + u.w, O.w) - Math.max(u.l, 0)) * Math.max(0, Math.min(u.t + u.h, O.h) - Math.max(u.t, 0));
        if (vis > bestA) { bestA = vis; best = idx[i]; }
    }
    return best;
}

// geometria de um bloco com membros escondidos (fecha o espaço deles)
function blockGeom(U, b, hidden) {
    var pos = {}, shift = 0, i, j, vis = [];
    for (i = 0; i < b.m.length; i++) {
        var mi = b.m[i], u = U[mi];
        if (hidden[mi]) {
            var side = false, nextTop = null;
            for (j = 0; j < b.m.length; j++) {
                var v = U[b.m[j]];
                if (b.m[j] == mi) continue;
                if (!hidden[b.m[j]] && v.t < u.t + u.h && v.t + v.h > u.t) side = true;
                if (v.t >= u.t + u.h - 1 && (nextTop === null || v.t < nextTop)) nextTop = v.t;
            }
            if (!side && nextTop !== null) shift += nextTop - u.t;
            continue;
        }
        pos[mi] = { x: u.l - b.l, y: u.t - b.t - shift };
        vis.push(mi);
    }
    if (!vis.length) return null;
    var l = 1e9, t = 1e9, r = -1e9, bt = -1e9;
    for (i = 0; i < vis.length; i++) {
        var p = pos[vis[i]], uu = U[vis[i]];
        l = Math.min(l, p.x); t = Math.min(t, p.y); r = Math.max(r, p.x + uu.w); bt = Math.max(bt, p.y + uu.h);
    }
    for (i = 0; i < vis.length; i++) { pos[vis[i]].x -= l; pos[vis[i]].y -= t; }
    return { pos: pos, w: r - l, h: bt - t, vis: vis };
}

function reorganize(U, idx, O, W, H, ts, split) {
    var out = {}, i, j, aspect = W / H, sz = safeZones(W, H);
    var m = Math.round(TUNE.marginFrac * Math.min(W, H));
    var F = { l: m, t: m + sz.t, r: W - m, b: H - m - sz.b };
    var hero = findHero(U, idx, O), rest = [];
    for (i = 0; i < idx.length; i++) if (idx[i] != hero) rest.push(idx[i]);
    var Cz = { l: F.l, t: F.t, r: F.r, b: F.b };

    if (hero >= 0) {
        var hu = U[hero], hcx = (hu.l + hu.w / 2) / O.w, hcy = (hu.t + hu.h / 2) / O.h, Z;
        var side = TUNE.heroSide;
        if (side == "auto") side = aspect >= 1 ? (hcx >= 0.5 ? "right" : "left") : (hcy >= 0.5 ? "bottom" : "top");
        if (aspect >= TUNE.stripAspect && (side == "top" || side == "bottom")) side = hcx >= 0.5 ? "right" : "left";
        if (side == "left" || side == "right") {
            var hw = aspect >= TUNE.stripAspect ? Math.min((F.b - F.t) * hu.w / hu.h, 0.3 * W) : TUNE.heroZone * (F.r - F.l);
            if (side == "right") { Z = { l: F.r - hw, t: F.t, r: F.r, b: F.b }; Cz.r = Z.l - m * 0.5; }
            else { Z = { l: F.l, t: F.t, r: F.l + hw, b: F.b }; Cz.l = Z.r + m * 0.5; }
        } else {
            var hh = TUNE.heroZone * (F.b - F.t);
            if (side == "bottom") { Z = { l: F.l, t: F.b - hh, r: F.r, b: F.b }; Cz.b = Z.t - m * 0.5; }
            else { Z = { l: F.l, t: F.t, r: F.r, b: F.t + hh }; Cz.t = Z.b + m * 0.5; }
        }
        var hs = Math.min((Z.r - Z.l) / hu.w, (Z.b - Z.t) / hu.h);
        out[hero] = { x: (Z.l + Z.r) / 2 - hu.w * hs / 2, y: (Z.t + Z.b) / 2 - hu.h * hs / 2, s: hs, hidden: false };
    }
    if (!rest.length) return out;

    var B = clusterUnits(U, rest, O, split ? 0 : undefined), hidden = {}, minPx = TUNE.minFont;
    var primary = 0;
    for (i = 0; i < B.length; i++) {
        if (B[i].headline) { primary = i; break; }
        if (B[i].maxLine > B[primary].maxLine) primary = i;
    }
    var keepText = -1, pb = B[primary];
    for (j = 0; j < pb.m.length; j++) if (keepText < 0 || (U[pb.m[j]].font || 0) > (U[keepText].font || 0)) keepText = pb.m[j];

    var maxFont = 0;
    for (i = 0; i < rest.length; i++) maxFont = Math.max(maxFont, U[rest[i]].font || 0);
    var strip = aspect >= TUNE.stripAspect;
    // faixas: só ficam os textos fortes (>= 60% do título); o resto sai de início
    if (strip) for (i = 0; i < rest.length; i++) {
        var ru = U[rest[i]];
        if (ru.kind == "text" && rest[i] != keepText && ru.role != "headline" && (ru.font || 0) < TUNE.strongTextRatio * (U[keepText].font || 0)
            && !sitsOnSomething(U, rest, rest[i])) hidden[rest[i]] = true;
    }
    var cap = Math.max(baseScale(W, H, O, ts) * 1.15, maxFont ? 0.12 * Math.min(W, H) / maxFont : 0);
    var zw = Cz.r - Cz.l, zh = Cz.b - Cz.t;
    var plan;

    for (var guard = 0; guard < 40; guard++) {
        var G = [], overflow = false;
        for (i = 0; i < B.length; i++) { var gm = blockGeom(U, B[i], hidden); if (gm) { gm.b = B[i]; G.push(gm); } }
        plan = [];
        if (strip) {
            G.sort(function (a, b) { return Math.abs(a.b.t - b.b.t) > 0.02 * O.h ? a.b.t - b.b.t : a.b.l - b.b.l; });
            var sumW = 0, kText = 1e9;
            for (i = 0; i < G.length; i++) if (G[i].b.maxLine > 0) kText = Math.min(kText, 0.78 * zh / G[i].h);
            if (kText == 1e9) kText = cap;
            for (i = 0; i < G.length; i++) {
                var onlyText = true;
                for (j = 0; j < G[i].vis.length; j++) if (U[G[i].vis[j]].kind != "text") onlyText = false;
                G[i].s = (G[i].b.maxLine > 0 ? (onlyText ? kText : Math.min(0.78 * zh / G[i].h, kText * 1.6))
                                             : Math.min(clamp(kText, 0.3 * zh / G[i].h, 0.45 * zh / G[i].h), 0.9 * zw / G[i].w)) * ts;
                sumW += G[i].w * G[i].s;
            }
            var gapMin = m * 0.6, fac = Math.min(1, (zw - gapMin * (G.length - 1)) / sumW);
            overflow = fac < 0.999;
            sumW = 0;
            for (i = 0; i < G.length; i++) { G[i].s *= fac; sumW += G[i].w * G[i].s; }
            var gap = G.length > 1 ? Math.min((zw - sumW) / (G.length - 1), m * 3) : 0;
            var x = Cz.l + (G.length > 1 ? (zw - sumW - gap * (G.length - 1)) / 2 : (zw - sumW) / 2);
            for (i = 0; i < G.length; i++) {
                plan.push({ g: G[i], x: x, y: (Cz.t + Cz.b) / 2 - G[i].h * G[i].s / 2, s: G[i].s });
                x += G[i].w * G[i].s + gap;
            }
        } else {
            // linhas: blocos que dividiam a mesma altura no original ficam lado a lado
            G.sort(function (a, b) { return a.b.t - b.b.t; });
            var rows = [];
            for (i = 0; i < G.length; i++) {
                var placed = false;
                for (j = 0; j < rows.length && !placed; j++) {
                    var rr = rows[j];
                    if (G[i].b.t < rr.b && G[i].b.b > rr.t) { rr.g.push(G[i]); rr.t = Math.min(rr.t, G[i].b.t); rr.b = Math.max(rr.b, G[i].b.b); placed = true; }
                }
                if (!placed) rows.push({ g: [G[i]], t: G[i].b.t, b: G[i].b.b });
            }
            var totH = 0, maxW = 0, gaps = [];
            for (j = 0; j < rows.length; j++) {
                var rw = 0, rh = 0;
                for (i = 0; i < rows[j].g.length; i++) { rw += rows[j].g[i].w; rh = Math.max(rh, rows[j].g[i].h); }
                rw += 0.04 * O.w * (rows[j].g.length - 1);
                rows[j].w = rw; rows[j].h = rh; maxW = Math.max(maxW, rw); totH += rh;
                if (j) { var gg = clamp(rows[j].t - rows[j - 1].b, 0.02 * O.h, 0.08 * O.h); gaps.push(gg); totH += gg; }
            }
            var k = Math.min(cap, zw / maxW, zh / totH) * ts;
            k = Math.min(k, zw / maxW, zh / totH);
            // cada linha volta para a região em que estava: topo, meio ou base
            var grp = { top: [], mid: [], bot: [] };
            for (j = 0; j < rows.length; j++) {
                var rcy = (rows[j].t + rows[j].b) / 2 / O.h;
                rows[j].gap = j ? gaps[j - 1] : 0;
                (hero >= 0 ? grp.mid : (rcy < 0.34 ? grp.top : (rcy > 0.66 ? grp.bot : grp.mid))).push(rows[j]);
            }
            function hOf(list) { var s = 0; for (var a = 0; a < list.length; a++) s += list[a].h + (a ? list[a].gap : 0); return s * k; }
            function put(list, y0) {
                var yy = y0;
                for (var a = 0; a < list.length; a++) {
                    if (a) yy += list[a].gap * k;
                    for (var c = 0; c < list[a].g.length; c++) {
                        var gi = list[a].g[c], bcx = (gi.b.l + gi.b.r) / 2 / O.w, bw = gi.w * k, bx;
                        if (bcx < 0.34) bx = Cz.l; else if (bcx > 0.66) bx = Cz.r - bw; else bx = (Cz.l + Cz.r) / 2 - bw / 2;
                        plan.push({ g: gi, x: bx, y: yy, s: k });
                    }
                    yy += list[a].h * k;
                }
            }
            var hT = hOf(grp.top), hB = hOf(grp.bot), hM = hOf(grp.mid);
            put(grp.top, Cz.t);
            put(grp.bot, Cz.b - hB);
            var midT = Cz.t + hT + (grp.top.length ? 0.04 * O.h * k : 0), midB = Cz.b - hB - (grp.bot.length ? 0.04 * O.h * k : 0);
            put(grp.mid, Math.max(midT, (midT + midB) / 2 - hM / 2));
        }
        // legibilidade: esconde o menor texto secundário e tenta de novo
        var worst = -1, worstL = 1e9;
        for (i = 0; i < plan.length; i++) {
            var P = plan[i];
            for (j = 0; j < P.g.vis.length; j++) {
                var ui = P.g.vis[j], u = U[ui], lh = (u.minFont || u.font || 0);
                if (!lh || (!overflow && lh * P.s >= minPx)) continue;
                if (ui == keepText || u.role == "headline" || u.role == "logo" || u.kind != "text") continue; // grupos (botões, selos) ficam
                var over = false;
                for (var q = 0; q < P.g.b.m.length; q++) {
                    var o = U[P.g.b.m[q]];
                    if (P.g.b.m[q] != ui && !hidden[P.g.b.m[q]] && o.l < u.l + u.w && o.l + o.w > u.l && o.t < u.t + u.h && o.t + o.h > u.t) over = true;
                }
                if (over || sitsOnSomething(U, rest, ui)) continue;            // ex.: texto dentro de botão
                if (lh < worstL) { worstL = lh; worst = ui; }
            }
        }
        if (worst < 0) break;
        hidden[worst] = true;
    }
    for (i = 0; i < plan.length; i++) {
        var pl = plan[i];
        for (j = 0; j < pl.g.vis.length; j++) {
            var vi = pl.g.vis[j];
            out[vi] = { x: pl.x + pl.g.pos[vi].x * pl.s, y: pl.y + pl.g.pos[vi].y * pl.s, s: pl.s, hidden: false };
        }
    }
    out._head = 0;
    for (i = 0; i < plan.length; i++) if (plan[i].g.pos[keepText]) out._head = (U[keepText].font || 0) * plan[i].s;
    for (var hk in hidden) if (hidden[hk]) out[hk] = { x: 0, y: 0, s: 1, hidden: true };
    for (i = 0; i < rest.length; i++) if (!out[rest[i]]) out[rest[i]] = { x: 0, y: 0, s: 1, hidden: true };
    return out;
}

// ---------------------------------------------------------------------
// ENTRADA PRINCIPAL
// ---------------------------------------------------------------------
function autoLayout(U, O, W, H, opts) {
    TUNE = {};
    for (var tk in TUNE_DEFAULT) TUNE[tk] = (opts.tune && opts.tune[tk] !== undefined) ? opts.tune[tk] : TUNE_DEFAULT[tk];
    var ts = opts.textScale || 1, out = {}, idx = [], i;
    for (i = 0; i < U.length; i++) {
        if (isBand(U[i], O)) out[i] = placeBand(U[i], O, W, H);
        else idx.push(i);
    }
    var mode = "reorganizado", lay = null;
    // só tenta manter a composição quando a proporção é parecida com a original
    var ar = (W / H) / (O.w / O.h); ar = Math.max(ar, 1 / ar);
    if (opts.mode != "reorganizar" && ar <= TUNE.fielMaxAspect) lay = tryFiel(U, idx, O, W, H, ts);
    if (lay) mode = "fiel";
    else {
        lay = reorganize(U, idx, O, W, H, ts, false);
        // faixas: se o título ficou pequeno, separa os elementos do bloco em linha
        if (W / H >= TUNE.stripAspect && lay._head < Math.max(14, 0.18 * H)) {
            var lay2 = reorganize(U, idx, O, W, H, ts, true);
            if (lay2._head > lay._head) lay = lay2;
        }
    }
    for (var k in lay) if (k != "_head") out[k] = lay[k];
    return { mode: mode, items: out, bgAy: bgAlignAuto(W, H, opts.bgAlign) };
}
