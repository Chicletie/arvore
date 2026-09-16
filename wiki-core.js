/* Lógica compartilhada das páginas de wiki isoladas — carregada por wiki.html (acesso via
   ?id=) e por 404.html (que o GitHub Pages serve pra qualquer /wiki/<slug> que não exista
   como arquivo de verdade, dando o link bonito sem precisar de servidor). Nenhum dos dois
   arquivos carrega index.html ou depende do app principal — isolado de propósito.
   Ambos os arquivos HTML só chamam wikiCoreBoot() depois de carregar este script. */
(function () {
  "use strict";
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyC2nVLv97V6D1S6rZ7nwhhyQXgWeFxQLd0",
    authDomain: "rotina-555dd.firebaseapp.com",
    projectId: "rotina-555dd",
    storageBucket: "rotina-555dd.firebasestorage.app",
    messagingSenderId: "979165283716",
    appId: "1:979165283716:web:258160eb92ead2353e89d1"
  };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var val = attrs[k];
      if (k === "class") e.className = val;
      else if (k === "text") e.textContent = val == null ? "" : val;
      else if (k.slice(0, 2) === "on" && typeof val === "function") e.addEventListener(k.slice(2), val);
      else if (val != null && val !== false) e.setAttribute(k, val);
    }
    (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); }
    return e;
  }
  // Same palette as index.html's EDGE_STYLE (tree/index.html ~line 1197) — only the color/dash
  // pair is needed here since the snapshot already ships each link's `style` key precomputed.
  var EDGE_STYLE = {
    ally: { color: "#3f9d5f", dash: "" }, rival: { color: "#d05a45", dash: "" },
    family: { color: "#b58a2e", dash: "" }, romance: { color: "#c9527a", dash: "" },
    friend: { color: "#8a9d3f", dash: "" }, bond: { color: "#a67c3d", dash: "" },
    faction: { color: "#3f7d94", dash: "" }, location: { color: "#4a8f7d", dash: "" },
    narrative: { color: "#7d6a9d", dash: "4 3" }, multiversal: { color: "#8f5cc9", dash: "6 4" },
    neutral: { color: "var(--border-strong)", dash: "" }
  };
  // Ursprung only (never Paradise Gate — that has its own separate identity, see pg-theme in
  // wiki-style.css, and the two never apply at once since PG's index only ever has Lótus pages).
  // Each flower keeps the herbarium's bg/paper/ink untouched and just gets its own accent
  // (links, tags, active tab, hover borders — everything already driven by --gold/--gold-ink/
  // --accent-wash) tinted toward that universe's own color from tree/index.html's FLOWERS array.
  // Values here are deepened/muted from that raw hex, not copied verbatim — the raw brand colors
  // (esp. Girassol's yellow and Miosótis's light blue) are too light to read as text on the cream
  // --paper background or as a work-tab's active background under light text; --gold-ink in
  // particular has to hold its own as body text, so it needs real contrast, not just correct hue.
  // Set via inline custom properties on <body> per page load (not a CSS class per universe) since
  // that is the minimal-code way to reuse every existing --gold/--gold-ink/--accent-wash consumer
  // for free — deliberately the "simple" version asked for, vs. a bespoke per-universe redesign.
  var UNI_ACCENT = {
    "Rosa": { gold: "#c23848", ink: "#8f2231", wash: "#f6dde0" },
    "Crisântemo": { gold: "#c26a24", ink: "#8f4d15", wash: "#f7e3d0" },
    "Girassol": { gold: "#b8901f", ink: "#7d5f12", wash: "#f7ecd0" },
    "Cravo": { gold: "#3d8a4e", ink: "#276334", wash: "#dcefe1" },
    "Miosótis": { gold: "#3f86b8", ink: "#235f85", wash: "#dcedf7" },
    "Violeta": { gold: "#7a49ac", ink: "#562f82", wash: "#e9def5" },
    "Lótus": { gold: "#c2618c", ink: "#8f3d64", wash: "#f7dfeb" }
  };
  function applyUniAccent(uniName) {
    var b = document.body.style, c = UNI_ACCENT[uniName];
    if (c) { b.setProperty("--gold", c.gold); b.setProperty("--gold-ink", c.ink); b.setProperty("--accent-wash", c.wash); }
    else { b.removeProperty("--gold"); b.removeProperty("--gold-ink"); b.removeProperty("--accent-wash"); }
  }
  function slugifyAnchor(s, i) { return "sec-" + i + "-" + String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30); }

  // /wiki/leonel-bianchi and /wiki.html and /404.html all need to agree on where "the site
  // root" is, so every internal link is absolute and correct regardless of which physical file
  // the server actually returned for the current URL. "ursprung" is a second, parallel
  // pretty-URL prefix (see isParadiseGateMode below) for the GERAL wiki (all 7 universes) —
  // same 404.html catch-all trick, just a different top segment. Since paradisegate.com.br's
  // own root already IS the Paradise Gate/Lótus wiki (2026-09-16), /wiki/ was freed up to mean
  // exactly that, and the old "everything" wiki moved to /ursprung/ instead. The underlying
  // universe id in the data is still "lotus" either way, untouched by any of this renaming.
  function siteRoot() {
    var path = location.pathname;
    path = path.replace(/\/(wiki|ursprung)\/[^/]*$/, "/").replace(/\/(wiki|ursprung)\/?$/, "/").replace(/\/(wiki|ursprung|404)\.html$/, "/");
    if (path.charAt(path.length - 1) !== "/") path += "/";
    return path;
  }
  var ROOT = siteRoot();
  // A visitor on /wiki(.html)/... gets the Paradise Gate wiki that never lets on other
  // universes exist: its own home (only Lótus entries), its own topbar, and every link
  // generated while in this mode stays under /wiki/ too. Reaches the exact same
  // wikiPublic/<slug> documents as the geral wiki underneath — Lótus entries are always openly
  // readable either way (see the Firestore rule) — this is purely about which INDEX gets
  // fetched and how links are built. (Function name kept as isParadiseGateMode even though the
  // URL segment it checks changed from "paradisegate" to "wiki" — same concept, new address.)
  function isParadiseGateMode() { return /\/wiki(\.html)?(\/|$)/.test(location.pathname); }
  function wikiHref(id) { return ROOT + (isParadiseGateMode() ? "wiki/" : "ursprung/") + encodeURIComponent(id); }
  function homeLabel() { return isParadiseGateMode() ? "🪶 Paradise Gate" : "🌿 Herbário do Multiverso"; }
  function homeHref() { return ROOT + (isParadiseGateMode() ? "wiki" : "ursprung"); }

  function resolveSlug() {
    var m = location.pathname.match(/\/(?:wiki|ursprung)\/([^/?#]+)\/?$/);
    if (m) return decodeURIComponent(m[1]);
    var q = new URLSearchParams(location.search).get("id");
    return q || null;
  }

  /* ---- minimal isolated markdown (duplicated from index.html on purpose — this page
     never loads the app; [[links]] render as plain emphasized text since there's no
     guarantee the mentioned entry is also published) ---- */
  function mdInline(container, s) {
    var re = /(!\[[^\]]*\]\([^)\s]+\)|`[^`]+`|\[\[[^\]\[]+\]\]|\[[^\]]+\]\((?:https?:|mailto:)[^)\s]+\)|\|\|[^|]+\|\||\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|(?:^|\s)_[^_\n]+_(?=\s|$))/g;
    var last = 0, m;
    function txt(str) { if (str) container.appendChild(document.createTextNode(str)); }
    while ((m = re.exec(s))) {
      var tok = m[0], at = m.index, lead = "";
      if (/^\s_/.test(tok)) { lead = tok.charAt(0); tok = tok.slice(1); at += 1; }
      txt(s.slice(last, at)); if (lead) txt(lead);
      if (tok.charAt(0) === "!") {
        var im = tok.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        container.appendChild(el("img", { class: "wb-img", src: im[2], alt: im[1] || "", loading: "lazy" }));
      } else if (tok.charAt(0) === "`") {
        container.appendChild(el("code", { class: "wb-code", text: tok.slice(1, -1) }));
      } else if (tok.slice(0, 2) === "[[") {
        var raw = tok.slice(2, -2), disp = raw.trim();
        if (raw.indexOf("|") !== -1) disp = raw.split("|")[1].trim();
        container.appendChild(el("span", { class: "wl-plain", text: disp }));
      } else if (tok.charAt(0) === "[") {
        var lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        container.appendChild(el("a", { href: lm[2], target: "_blank", rel: "noopener noreferrer", text: lm[1] }));
      } else if (tok.slice(0, 2) === "**" || tok.slice(0, 2) === "__") {
        container.appendChild(el("strong", { text: tok.slice(2, -2) }));
      } else if (tok.slice(0, 2) === "~~") {
        container.appendChild(el("del", { text: tok.slice(2, -2) }));
      } else if (tok.slice(0, 2) === "||") {
        container.appendChild(el("span", { class: "md-spoiler", tabindex: "0", role: "button", "aria-label": "spoiler, toque para revelar", text: tok.slice(2, -2), onclick: function (ev) { ev.currentTarget.classList.toggle("on"); } }));
      } else {
        container.appendChild(el("em", { text: tok.slice(1, -1) }));
      }
      last = re.lastIndex;
    }
    txt(s.slice(last));
  }
  function renderMarkdown(text) {
    var wrap = el("div", { class: "prose" });
    var lines = String(text || "").split("\n");
    var listBuf = null, listOrdered = false, i = 0;
    function flush() { if (listBuf) { wrap.appendChild(listBuf); listBuf = null; } }
    for (; i < lines.length; i++) {
      var ln = lines[i];
      if (/^\s*```/.test(ln)) {
        flush(); var buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        wrap.appendChild(el("pre", {}, [el("code", { text: buf.join("\n") })]));
        continue;
      }
      if (/^\s*$/.test(ln)) { flush(); continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(ln)) { flush(); wrap.appendChild(el("hr")); continue; }
      var h = ln.match(/^(#{1,6})\s+(.*)/);
      if (h) { flush(); var hEl = el("h" + Math.min(6, h[1].length + 2)); mdInline(hEl, h[2]); wrap.appendChild(hEl); continue; }
      if (/^\s*>\s?/.test(ln)) { flush(); var q = el("blockquote"); mdInline(q, ln.replace(/^\s*>\s?/, "")); wrap.appendChild(q); continue; }
      var task = ln.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)/);
      var item = ln.match(/^\s*[-*+]\s+(.*)/);
      var oitem = ln.match(/^\s*\d+[.)]\s+(.*)/);
      if (task || item || oitem) {
        var ordered = !!oitem && !item;
        if (!listBuf || listOrdered !== ordered) { flush(); listBuf = el(ordered ? "ol" : "ul"); listOrdered = ordered; }
        var li = el("li");
        mdInline(li, task ? task[2] : (item ? item[1] : oitem[1]));
        listBuf.appendChild(li);
        continue;
      }
      flush();
      var p = el("p"); mdInline(p, ln); wrap.appendChild(p);
    }
    flush();
    return wrap;
  }

  function spoilerCover(buildInner) {
    var wrap = el("div", { class: "spoiler-block" });
    var btn = el("button", { class: "spoiler-reveal", type: "button", text: "🙈 spoiler, toque para revelar" });
    btn.addEventListener("click", function () { wrap.className = "spoiler-block revealed"; wrap.textContent = ""; wrap.appendChild(buildInner()); });
    wrap.appendChild(btn);
    return wrap;
  }
  function spoilerSpan(text) {
    return el("span", { class: "md-spoiler", tabindex: "0", role: "button", text: text, onclick: function (ev) { ev.currentTarget.classList.toggle("on"); } });
  }
  function chip(prefix, item) {
    if (item.vis === "spoiler") { var c = el("span", { class: "tag" }); c.appendChild(spoilerSpan(prefix + item.text)); return c; }
    return el("span", { class: "tag", text: prefix + item.text });
  }
  // Ponto de foco escolhido no editor (em vez de recorte fixo) — vira object-position aqui,
  // a mesma imagem original renderiza certo em qualquer proporção (infobox, miniatura, galeria).
  function objPos(focus) { return (focus && focus.x != null ? focus.x : 50) + "% " + (focus && focus.y != null ? focus.y : 50) + "%"; }
  function wbFmtCompact(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); }
  // Formato genérico (sem nome de mês do calendário do universo, que não é publicado) — só
  // números, mas ainda deixa claro a precisão (ano só / mês+ano / dia+mês+ano).
  function wbFmtEventDate(ev) {
    if (ev.d != null && ev.m != null) return ev.d + "/" + ev.m + "/" + ev.y;
    if (ev.m != null) return ev.m + "/" + ev.y;
    return "ano " + ev.y;
  }
  function wbEventSortKey(ev) { return ev.y * 100000 + (ev.m || 0) * 100 + (ev.d || 0); }
  // ---- sorteio diário determinístico (Citação/Personagem/Nota/Entrada/Ano do dia) ----
  // Sem servidor nem escrita nenhuma: o mesmo dia sempre produz a mesma escolha, pra qualquer
  // visitante, em qualquer navegador — só um hash+PRNG semeado (mulberry32) pela data+nome do
  // widget. O "cooldown contra repetição" pedido vira embutido no próprio esquema: embaralha o
  // pool inteiro uma vez por CICLO (ciclo = tamanho do pool) e percorre essa ordem dia a dia, o
  // que garante cada item aparecer exatamente uma vez antes de qualquer repetição, sem nunca
  // travar num acervo pequeno (pool de 1 sempre mostra esse 1; de 3, roda de 3 em 3 dias) — e
  // sem precisar lembrar "o que já foi mostrado" em lugar nenhum.
  function wbHashSeed(s) {
    var h = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }
  function wbSeededShuffle(arr, seed) {
    var rnd = wbHashSeed(seed), out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  // Dia LOCAL do visitante (não UTC): Date.now()/86400000 viraria o "dia" à meia-noite UTC, que
  // no Brasil é 21h — ficaria fora de sincronia com wbTodayMD (que usa getMonth()/getDate()
  // locais), fazendo a exclusão de aniversário e o próprio sorteio discordarem sobre "hoje"
  // bem na virada da noite.
  function wbDayIndex() { var d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
  function wbDailyPick(pool, seedName) {
    if (!pool || !pool.length) return null;
    var day = wbDayIndex(), n = pool.length, cycle = Math.floor(day / n), pos = day % n;
    return wbSeededShuffle(pool, seedName + ":" + cycle)[pos];
  }
  var WB_MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function wbMdToDoy(md) {
    var p = md.split("-"), m = +p[0], d = +p[1], doy = d;
    for (var i = 0; i < m - 1; i++) doy += WB_MONTH_DAYS[i];
    return doy;
  }
  function wbTodayMD() {
    var d = new Date();
    return (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1) + "-" + (d.getDate() < 10 ? "0" : "") + d.getDate();
  }
  // Um aniversariante não deve sortear como personagem-do-dia ALEATÓRIO num dia qualquer
  // dentro do próprio mês de aniversário — pareceria erro/coincidência estranha perto da data
  // real. Janela = o mês inteiro do aniversário, com folga de 15 dias pro mês vizinho quando o
  // aniversário cai perto da virada do mês (não só os 15 dias ao redor da data exata).
  function wbInBirthdayWindow(todayMD, birthdayMD) {
    var YLEN = 366;
    function norm(x) { return ((x - 1) % YLEN + YLEN) % YLEN + 1; }
    var bDoy = wbMdToDoy(birthdayMD), bm = +birthdayMD.split("-")[0];
    var monthStart = 1;
    for (var i = 0; i < bm - 1; i++) monthStart += WB_MONTH_DAYS[i];
    var monthEnd = monthStart + WB_MONTH_DAYS[bm - 1] - 1;
    var start = norm(Math.min(monthStart, bDoy - 15)), end = norm(Math.max(monthEnd, bDoy + 15));
    var t = wbMdToDoy(todayMD);
    return start <= end ? (t >= start && t <= end) : (t >= start || t <= end);
  }
  // Um [[Nome]] dentro de um texto normalmente vira só texto em negrito (.wl-plain) — a wiki
  // isolada não tem como saber se aquele nome é uma página publicada sem mais contexto. Mas
  // dentro da descrição de um evento, JÁ temos esse contexto: os links/backlinks reais desta
  // própria entrada. Se o texto de um [[Nome]] bate com o título de uma ligação real e
  // publicada, vira um link de verdade (.wl-live) — é assim que a descrição de um evento pode
  // apontar pra um "Evento histórico" com página própria, por exemplo.
  function wbUpgradeWikiLinks(container, allLinks) {
    var byTitle = {};
    allLinks.forEach(function (lk) { if (lk.targetId) byTitle[(lk.targetTitle || "").toLowerCase()] = lk.targetId; });
    container.querySelectorAll(".wl-plain").forEach(function (span) {
      var id = byTitle[(span.textContent || "").toLowerCase()];
      if (id) span.replaceWith(el("a", { class: "wl-live", href: wikiHref(id), text: span.textContent }));
    });
  }
  // Linha do tempo pessoal como elemento visual próprio (não uma lista de texto simples):
  // espinha vertical, cada evento é um nó clicável que expande pra revelar a descrição
  // completa (o "note", que pode conter [[links]] pra outras páginas — ver wbUpgradeWikiLinks
  // acima) — o rótulo do evento continua sendo só o resumo curto, a descrição é o "como e por
  // quê" mais longo.
  function buildTimelineViz(eventsSorted, data) {
    var allLinks = (data.links || []).concat(data.backlinks || []);
    var wrap = el("div", { class: "wb-tl" });
    eventsSorted.forEach(function (ev) {
      var body = el("div", { class: "wb-tl-body", hidden: "hidden" });
      if (ev.note) { var prose = renderMarkdown(ev.note); wbUpgradeWikiLinks(prose, allLinks); body.appendChild(prose); }
      else body.appendChild(el("div", { class: "wb-tl-empty", text: "Sem descrição adicional." }));
      var head = el("button", { type: "button", class: "wb-tl-head" }, [
        el("span", { class: "wb-tl-dot" }),
        el("span", { class: "wb-tl-date", text: wbFmtEventDate(ev) }),
        el("span", { class: "wb-tl-label", text: ev.label || "(evento)" })
      ]);
      head.addEventListener("click", function () { body.hidden = !body.hidden; head.classList.toggle("open", !body.hidden); });
      wrap.appendChild(el("div", { class: "wb-tl-item" + (ev.major ? " major" : "") }, [head, body]));
    });
    return wrap;
  }

  // Login only matters for "restrito" content — público/spoiler never need it. A signed-in
  // session persists across page loads (Firebase's own local persistence), so a player who logs
  // in once stays in on later visits until they sign out.
  function mountLoginBar(host) {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    var bar = el("div", { class: "login-bar" });
    // The auth UI lives in its own slot, separate from `bar` itself — mountSuggestBox appends a
    // sibling button straight into `bar`, and paint() used to `bar.textContent = ""` on every
    // auth change, silently deleting that sibling the first time a reader logged in or out.
    var authSlot = el("span");
    bar.appendChild(authSlot);
    function paint() {
      authSlot.textContent = "";
      var u = firebase.auth().currentUser;
      if (u) {
        authSlot.appendChild(el("span", { text: "logado como " + u.email + " · " }));
        var out = el("button", { class: "linklike", type: "button", text: "sair" });
        out.addEventListener("click", function () { firebase.auth().signOut(); });
        authSlot.appendChild(out);
      } else {
        var inBtn = el("button", { class: "linklike", type: "button", text: "entrar (pra ver conteúdo restrito)" });
        inBtn.addEventListener("click", openLoginModal);
        authSlot.appendChild(inBtn);
      }
    }
    paint();
    firebase.auth().onAuthStateChanged(paint);
    host.appendChild(bar);
    return bar;
  }
  // A small "💡 sugerir alteração" trigger appended into the SAME bar mountLoginBar returns, so
  // it inherits the bar's existing button styling for free and sits right next to entrar/sair.
  // Only shown to a signed-in reader (the wikiSuggestions Firestore rule requires auth anyway).
  // Records which page + which tab (Geral or a work variant) the reader was looking at
  // automatically — no extra field for them to fill in beyond the suggestion text itself.
  function mountSuggestBox(bar, wikiId, pageTitle, getTab, listHost) {
    if (typeof firebase === "undefined" || !firebase.auth || !bar) return;
    var btn = el("button", { class: "linklike", type: "button", style: "margin-left:10px", text: "💡 sugerir alteração" });
    btn.hidden = true;
    btn.addEventListener("click", function () { openSuggestModal(wikiId, pageTitle, getTab ? getTab() : ""); });
    bar.appendChild(btn);
    // "Minhas sugestões" — a signed-in reader can already read back their OWN suggestions per
    // the Firestore rule (authorEmail == their token email); this just gives them a way to see
    // it. Fetched fresh each time the panel is opened rather than kept live — a reader checking
    // right after submitting will already see it since the write has landed by then.
    var mineBtn = null, mineSlot = null, mineOpen = false;
    if (listHost) {
      mineBtn = el("button", { class: "linklike", type: "button", style: "margin-left:10px", text: "🗒 minhas sugestões" });
      mineBtn.hidden = true;
      bar.appendChild(mineBtn);
      mineSlot = el("div", { class: "restrito-wrap" });
      listHost.appendChild(mineSlot);
      mineBtn.addEventListener("click", function () {
        mineOpen = !mineOpen;
        mineSlot.textContent = "";
        if (!mineOpen) return;
        mineSlot.appendChild(el("div", { class: "empty", text: "carregando…" }));
        firebase.firestore().collection("wikiSuggestions")
          .where("wikiId", "==", wikiId).where("authorEmail", "==", firebase.auth().currentUser.email)
          .get().then(function (snap) {
            mineSlot.textContent = "";
            if (snap.empty) { mineSlot.appendChild(el("div", { class: "empty", text: "Você ainda não enviou nenhuma sugestão nesta página." })); return; }
            mineSlot.appendChild(el("div", { class: "cathead", text: "🗒 Suas sugestões nesta página" }));
            snap.docs.map(function (d) { return d.data(); })
              .sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); })
              .forEach(function (s) {
                var statusLabel = s.status === "aceita" ? "✅ aceita" : s.status === "rejeitada" ? "❌ rejeitada" : "⏳ pendente";
                var row = el("div", { style: "margin:8px 0;padding-bottom:8px;border-bottom:1px solid var(--border)" });
                row.appendChild(el("div", { style: "font-size:11px;color:var(--faint)", text: (s.tab && s.tab !== "Geral" ? s.tab + " · " : "") + statusLabel }));
                row.appendChild(el("div", { style: "white-space:pre-wrap", text: s.text || "" }));
                mineSlot.appendChild(row);
              });
          }).catch(function () {
            mineSlot.textContent = "";
            mineSlot.appendChild(el("div", { class: "empty", text: "Não consegui carregar suas sugestões agora." }));
          });
      });
    }
    function paint() {
      btn.hidden = !firebase.auth().currentUser;
      if (mineBtn) mineBtn.hidden = !firebase.auth().currentUser;
    }
    paint();
    firebase.auth().onAuthStateChanged(paint);
  }
  function openSuggestModal(wikiId, pageTitle, tab) {
    var wrap = el("div", { class: "login-modal" });
    var box = el("div", { class: "login-box" });
    box.appendChild(el("h3", { text: "Sugerir alteração" }));
    box.appendChild(el("div", { style: "font-size:12.5px;color:var(--faint);margin-bottom:8px", text: pageTitle + (tab && tab !== "Geral" ? " · " + tab : "") }));
    var ta = el("textarea", { placeholder: "O que você acha que devia mudar ou ser adicionado?" });
    var err = el("div", { class: "err" });
    box.appendChild(ta); box.appendChild(err);
    var submitBtn = el("button", { class: "submit", type: "button", text: "Enviar sugestão" });
    function doSubmit() {
      var text = ta.value.trim();
      if (!text) { err.textContent = "Escreve alguma coisa antes de enviar."; return; }
      err.textContent = ""; submitBtn.disabled = true; submitBtn.textContent = "enviando…";
      firebase.firestore().collection("wikiSuggestions").add({
        wikiId: wikiId, pageTitle: pageTitle || "", tab: tab || "", text: text,
        authorEmail: firebase.auth().currentUser.email, status: "pendente", createdAt: new Date().toISOString()
      }).then(function () {
        box.textContent = "";
        box.appendChild(el("h3", { text: "Enviado!" }));
        box.appendChild(el("div", { text: "Obrigado! Sua sugestão vai aparecer pro autor da wiki." }));
        var close = el("button", { class: "submit", type: "button", style: "margin-top:10px", text: "Fechar" });
        close.addEventListener("click", function () { wrap.remove(); });
        box.appendChild(close);
      }).catch(function () {
        submitBtn.disabled = false; submitBtn.textContent = "Enviar sugestão";
        err.textContent = "Não consegui enviar. Tenta de novo em instantes.";
      });
    }
    submitBtn.addEventListener("click", doSubmit);
    box.appendChild(submitBtn);
    var cancel = el("button", { class: "cancel", type: "button", text: "cancelar" });
    cancel.addEventListener("click", function () { wrap.remove(); });
    box.appendChild(cancel);
    wrap.appendChild(box);
    wrap.addEventListener("click", function (ev) { if (ev.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
    ta.focus();
  }
  function openLoginModal() {
    var wrap = el("div", { class: "login-modal" });
    var box = el("div", { class: "login-box" });
    box.appendChild(el("h3", { text: "Entrar" }));
    var err = el("div", { class: "err" });
    var emailInp = el("input", { type: "email", placeholder: "seu email", autocomplete: "username" });
    var passInp = el("input", { type: "password", placeholder: "sua senha", autocomplete: "current-password" });
    box.appendChild(emailInp); box.appendChild(passInp); box.appendChild(err);
    var submitBtn = el("button", { class: "submit", type: "button", text: "Entrar" });
    function doSubmit() {
      err.textContent = ""; submitBtn.disabled = true; submitBtn.textContent = "entrando…";
      firebase.auth().signInWithEmailAndPassword(emailInp.value.trim(), passInp.value).then(function () {
        wrap.remove();
      }).catch(function (e) {
        submitBtn.disabled = false; submitBtn.textContent = "Entrar";
        err.textContent = "Não consegui entrar. Confira email e senha.";
      });
    }
    submitBtn.addEventListener("click", doSubmit);
    passInp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") doSubmit(); });
    box.appendChild(submitBtn);
    var forgot = el("button", { class: "cancel", type: "button", style: "margin-top:6px", text: "esqueci minha senha" });
    forgot.addEventListener("click", function () {
      var email = emailInp.value.trim();
      if (!email) { err.textContent = "Digite seu email ali em cima primeiro."; return; }
      err.textContent = ""; forgot.disabled = true; forgot.textContent = "enviando…";
      firebase.auth().sendPasswordResetEmail(email).then(function () {
        forgot.textContent = "Email enviado! Confira sua caixa de entrada.";
      }).catch(function () {
        forgot.disabled = false; forgot.textContent = "esqueci minha senha";
        err.textContent = "Não consegui enviar. Confira o email digitado.";
      });
    });
    box.appendChild(forgot);
    var cancel = el("button", { class: "cancel", type: "button", text: "cancelar" });
    cancel.addEventListener("click", function () { wrap.remove(); });
    box.appendChild(cancel);
    wrap.appendChild(box);
    wrap.addEventListener("click", function (ev) { if (ev.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
    emailInp.focus();
  }
  // Renders whatever "restrito" items the signed-in viewer is allowed to see for this entry —
  // Firestore itself filters the list down to only the docs their email is on, nothing extra
  // ever reaches this code. Re-runs on every login/logout so the unlocked section appears or
  // clears live without a page reload.
  function mountRestrito(host, wikiId) {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    var slot = el("div", { class: "restrito-wrap" });
    host.appendChild(slot);
    function refresh() {
      slot.textContent = "";
      if (!firebase.auth().currentUser) return;
      firebase.firestore().collection("wikiRestrito").doc(wikiId).collection("itens").get().then(function (snap) {
        var items = snap.docs.map(function (d) { return d.data(); });
        if (!items.length) return;
        slot.appendChild(el("div", { class: "cathead", text: "🔐 Desbloqueado pra você" }));
        items.forEach(function (it) {
          var heading = (it.key || it.title || "Seção") + (it.variant ? " (" + it.variant + ")" : "");
          if (it.kind === "campo") {
            slot.appendChild(el("div", { class: "cathead", style: "font-size:11px;margin-top:14px", text: heading }));
            slot.appendChild(renderMarkdown(it.value));
          } else if (it.kind === "secao") {
            slot.appendChild(el("div", { class: "cathead", style: "font-size:11px;margin-top:14px", text: heading }));
            slot.appendChild(renderMarkdown(it.body));
          } else if (it.kind === "tag") {
            slot.appendChild(el("span", { class: "tag", style: "margin-right:6px", text: "#" + it.text }));
          } else if (it.kind === "alias") {
            slot.appendChild(el("div", { class: "aliases", text: "também: " + it.text }));
          } else if (it.kind === "galeria") {
            var fig = el("figure", { class: "gal-item", style: "display:inline-block;width:140px;margin:0 8px 8px 0" });
            fig.appendChild(el("img", { src: it.url, alt: it.caption || "" }));
            if (it.caption) fig.appendChild(el("figcaption", { text: it.caption }));
            slot.appendChild(fig);
          } else if (it.kind === "capa") {
            slot.appendChild(el("img", { class: "cover", style: "max-width:250px;display:block;margin-bottom:10px", src: it.url, alt: "" }));
          } else if (it.kind === "sessao") {
            slot.appendChild(el("div", { class: "cathead", style: "font-size:11px;margin-top:14px", text: (it.title || "Sessão") + (it.date ? " · " + it.date : "") }));
            slot.appendChild(renderMarkdown(it.recap));
          } else if (it.kind === "post") {
            slot.appendChild(el("div", { class: "cathead", style: "font-size:11px;margin-top:14px", text: (it.date ? it.date + " · " : "") + (it.title || "Post") }));
            slot.appendChild(renderMarkdown(it.body));
          }
        });
      }).catch(function () { /* not signed in as anyone with access to this item — nothing to show */ });
    }
    refresh();
    firebase.auth().onAuthStateChanged(refresh);
  }

  // Same bucketing rule as tree/index.html's wbFamily() — a link only lands here via one of
  // these exact labels, which the app itself always creates on BOTH sides (manual add or the
  // sibling/grandparent/family-extras auto-inference), so reading only `data.links` (never
  // backlinks) here mirrors the author's own view exactly.
  var FAMILY_LABEL_BUCKET = {
    "é filho(a) de": "parents", "é pai/mãe de": "children",
    "irmão/irmã de": "siblings", "meio-irmão/meia-irmã de": "halfSiblings",
    "casado(a) com": "spouses", "avô/avó de": "grandchildren", "neto(a) de": "grandparents"
  };
  function familyOf(links) {
    var fam = { parents: [], children: [], siblings: [], halfSiblings: [], spouses: [], grandparents: [], grandchildren: [] };
    (links || []).forEach(function (lk) { var b = FAMILY_LABEL_BUCKET[lk.label]; if (b) fam[b].push(lk); });
    return fam;
  }
  // Static port of wbFamilyTree (tree/index.html) — same 5-tier layout, but reading plain
  // {label,targetId,targetTitle} link objects from the snapshot instead of live entry refs, and
  // navigating via a real page load (wikiHref) instead of an in-app route change. A link only
  // ever reaches this snapshot if its target is ALSO published (see wbWikiLinks) — an unpublished
  // relative just doesn't show up, same "only what's public" rule as the rest of the wiki. The
  // one exception is the GM's own local "ver como wiki" preview, where an unpublished target can
  // carry a null targetId — rendered as a plain, non-clickable node rather than a dead link.
  function buildFamilyTree(data) {
    var fam = familyOf(data.links);
    var sibs = fam.siblings.concat(fam.halfSiblings);
    var hasAny = fam.parents.length || fam.children.length || fam.grandparents.length || fam.grandchildren.length || sibs.length || fam.spouses.length;
    if (!hasAny) return null;
    var selfRowN = 1 + sibs.length + fam.spouses.length;
    var maxRowN = Math.max(fam.grandparents.length, fam.parents.length, selfRowN, fam.children.length, fam.grandchildren.length, 1);
    var W = Math.max(460, maxRowN * 92), cx = W / 2;
    var GP_Y = 20, P_Y = 82, SELF_Y = 144, C_Y = 206, GC_Y = 264, H = 284;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "wb-famtree", width: "100%" });
    function nodeAt(x, y, lk, self) {
      var label = self ? data.title : lk.targetTitle;
      var g = svgEl("g", { transform: "translate(" + x + "," + y + ")" });
      var w2 = Math.max(60, label.length * 6.4 + 14);
      g.appendChild(svgEl("rect", { x: -w2 / 2, y: -13, width: w2, height: 26, rx: 7, fill: self ? "var(--accent-wash)" : "var(--surface)", stroke: self ? "var(--gold)" : "var(--border-strong)" }));
      var t = svgEl("text", { class: "wb-ft-label", y: 4 });
      t.textContent = label.length > 16 ? label.slice(0, 15) + "…" : label;
      g.appendChild(t);
      if (!self && lk.targetId) { g.style.cursor = "pointer"; g.addEventListener("click", function () { location.href = wikiHref(lk.targetId); }); }
      return g;
    }
    function rowXs(n) {
      if (n <= 0) return [];
      if (n === 1) return [cx];
      var span = Math.min(W * 0.86, (n - 1) * 92), x0 = cx - span / 2;
      return Array.from({ length: n }, function (_, i) { return x0 + i * (span / (n - 1)); });
    }
    function tier(links, y, lineFromY, toX, toY, dashed) {
      var xs = rowXs(links.length);
      links.forEach(function (lk, i) {
        var attrs = { x1: xs[i], y1: lineFromY, x2: toX, y2: toY, stroke: "var(--border-strong)" };
        if (dashed) attrs["stroke-dasharray"] = "2 3";
        svg.appendChild(svgEl("line", attrs));
        svg.appendChild(nodeAt(xs[i], y, lk, false));
      });
    }
    tier(fam.grandparents, GP_Y, GP_Y + 13, cx, P_Y - 13, true);
    tier(fam.parents, P_Y, P_Y + 13, cx, SELF_Y - 13, false);
    var GAP = 78;
    sibs.forEach(function (lk, i) {
      var x = cx - GAP * (sibs.length - i);
      svg.appendChild(svgEl("line", { x1: x, y1: SELF_Y, x2: cx - 26, y2: SELF_Y, stroke: "var(--border-strong)" }));
      svg.appendChild(nodeAt(x, SELF_Y, lk, false));
    });
    svg.appendChild(nodeAt(cx, SELF_Y, null, true));
    fam.spouses.forEach(function (lk, i) {
      var x = cx + GAP * (i + 1);
      svg.appendChild(svgEl("line", { x1: cx + 26, y1: SELF_Y, x2: x, y2: SELF_Y, stroke: "var(--border-strong)", "stroke-dasharray": "2 3" }));
      svg.appendChild(nodeAt(x, SELF_Y, lk, false));
    });
    tier(fam.children, C_Y, C_Y - 13, cx, SELF_Y + 13, false);
    tier(fam.grandchildren, GC_Y, GC_Y - 13, cx, C_Y + 13, true);
    return el("div", { class: "wb-famtree-wrap" }, [svg]);
  }
  // Mesmo princípio de FAMILY_LABEL_BUCKET acima, mas para as categorias "practice"/"nature"
  // (2026-09-16) — vínculos que, sem isso, se perderiam anônimos dentro da lista genérica de
  // Ligações: quem pratica/acredita/fala/caça uma entrada, e o que ela mesma afeta/pratica/etc.
  // Ordem fixa (não a ordem de criação dos links) pra sempre agrupar do mesmo jeito. Só lê
  // data.links, nunca backlinks, pelo mesmo motivo do family: o app sempre cria os dois lados.
  var AFFINITY_LABELS = [
    "pratica", "é praticado(a) por",
    "acredita em", "é uma crença de",
    "afeta", "é afetado(a) por",
    "fala", "é falado(a) por",
    "caça", "é caçado(a) por"
  ];
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function affinitiesOf(links) {
    var byLabel = {};
    (links || []).forEach(function (lk) { if (AFFINITY_LABELS.indexOf(lk.label) !== -1) (byLabel[lk.label] = byLabel[lk.label] || []).push(lk); });
    return AFFINITY_LABELS.filter(function (lbl) { return byLabel[lbl] && byLabel[lbl].length; })
      .map(function (lbl) { return { label: cap1(lbl), items: byLabel[lbl] }; });
  }
  // Star-topology relation graph, ported from wbEntryRelGraph but as a fixed radial layout
  // instead of the live force-sim/drag engine (createGraph) — that engine is ~250 lines of
  // physics+pan+zoom+persisted-position code built for an author actively arranging a map; a
  // read-only wiki page just needs to SHOW the relations, not let a visitor rearrange them, so a
  // static circle is the right amount of engineering here, not a cut corner. Neighbors come from
  // BOTH data.links (outgoing) and data.backlinks (incoming, deduped by target) — mirrors the
  // author's own dual-scan, since a hand-typed label with no LINK_TYPES inverse only ever creates
  // one direction.
  function relNeighbors(data) {
    var seen = {}, out = [];
    (data.links || []).forEach(function (lk) { var key = lk.targetId || ("t:" + lk.targetTitle); if (!seen[key]) { seen[key] = 1; out.push(lk); } });
    (data.backlinks || []).forEach(function (lk) { var key = lk.targetId || ("t:" + lk.targetTitle); if (!seen[key]) { seen[key] = 1; out.push(lk); } });
    return out;
  }
  function buildRelGraph(data) {
    var neighbors = relNeighbors(data);
    if (!neighbors.length) return null;
    var W = 460, cx = W / 2, cy = 150, n = neighbors.length;
    var R = Math.min(150, 60 + n * 12);
    var H = Math.round(cy + R + 40);
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "wb-relgraph", width: "100%" });
    neighbors.forEach(function (lk, i) {
      var angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      var x = cx + R * Math.cos(angle), y = cy + R * Math.sin(angle);
      var st = EDGE_STYLE[lk.style] || EDGE_STYLE.neutral;
      var lineAttrs = { x1: cx, y1: cy, x2: x, y2: y, stroke: st.color };
      if (st.dash) lineAttrs["stroke-dasharray"] = st.dash;
      svg.appendChild(svgEl("line", lineAttrs));
      if (lk.label) {
        var lt = svgEl("text", { class: "wb-rg-edge-label", x: cx + (x - cx) * 0.55, y: cy + (y - cy) * 0.55 });
        lt.textContent = lk.label;
        svg.appendChild(lt);
      }
      var g = svgEl("g", { transform: "translate(" + x + "," + y + ")" });
      var w2 = Math.max(50, Math.min(120, lk.targetTitle.length * 6.2 + 14));
      g.appendChild(svgEl("rect", { x: -w2 / 2, y: -12, width: w2, height: 24, rx: 12, fill: "var(--surface)", stroke: st.color }));
      var t = svgEl("text", { class: "wb-rg-node-label", y: 4 });
      t.textContent = lk.targetTitle.length > 15 ? lk.targetTitle.slice(0, 14) + "…" : lk.targetTitle;
      g.appendChild(t);
      if (lk.targetId) { g.style.cursor = "pointer"; g.addEventListener("click", function () { location.href = wikiHref(lk.targetId); }); }
      svg.appendChild(g);
    });
    var self = svgEl("g", { transform: "translate(" + cx + "," + cy + ")" });
    var sw = Math.max(60, Math.min(150, data.title.length * 6.6 + 18));
    self.appendChild(svgEl("rect", { x: -sw / 2, y: -15, width: sw, height: 30, rx: 8, fill: "var(--accent-wash)", stroke: "var(--gold)" }));
    var st2 = svgEl("text", { class: "wb-rg-node-label wb-rg-self", y: 5 });
    st2.textContent = data.title.length > 18 ? data.title.slice(0, 17) + "…" : data.title;
    self.appendChild(st2);
    svg.appendChild(self);
    return el("div", { class: "wb-relgraph-wrap" }, [svg]);
  }

  function renderEntry(data, wikiId) {
    if (!isParadiseGateMode()) applyUniAccent(data.universe);
    var page = document.getElementById("page");
    page.textContent = "";
    document.title = data.title || "wiki";
    var header = el("div", { class: "site-header" });
    var topbar = el("div", { class: "topbar" }, [el("a", { href: homeHref(), text: homeLabel() })]);
    if (data.universe && !isParadiseGateMode()) { topbar.appendChild(el("span", { class: "sep", text: "·" })); topbar.appendChild(el("span", { class: "topbar-uni", text: data.universe })); }
    header.appendChild(topbar);
    var loginBar = mountLoginBar(header);
    page.appendChild(header);
    var card = el("div", { class: "card" });
    var currentTabLabel = "Geral";

    // "Dentro de" (ex: uma cidade dentro de uma província dentro de um país) — cadeia de
    // ancestrais publicados, já resolvida no snapshot (wbWikiAncestors), do mais distante ao
    // mais próximo. Um ancestral sem página publicada não aparece, mas não quebra a cadeia.
    if (data.ancestors && data.ancestors.length) {
      var crumb = el("div", { class: "crumb" });
      data.ancestors.forEach(function (c, i) {
        if (i) crumb.appendChild(document.createTextNode(" › "));
        crumb.appendChild(el("a", { href: wikiHref(c.targetId), text: c.targetTitle }));
      });
      card.appendChild(crumb);
    }

    var eyebrowBits = [data.type, isParadiseGateMode() ? null : data.universe].filter(Boolean);
    if (eyebrowBits.length) card.appendChild(el("div", { class: "eyebrow" }, [el("span", { text: eyebrowBits.join(" · ") })]));
    card.appendChild(el("h1", { text: data.title || "(sem título)" }));

    var shortFields = (data.fields || []).filter(function (f) { return f.type !== "nota"; });
    var galGroups = [];
    (data.gallery || []).forEach(function (g) { if (galGroups.indexOf(g.group) === -1) galGroups.push(g.group); });

    // infobox — cover + short facts, floats beside the article on wide screens. When there's a
    // gallery, the portrait becomes switchable: one tab per group (ex: "Primeira Temporada",
    // "Segunda Temporada"), each showing that group's first image — same idea as a fandom
    // infobox's season-switcher, tabs sit right above the picture.
    var hasAliases = data.aliases && data.aliases.length;
    var hasChildren = data.children && data.children.length;
    if (data.cover || shortFields.length || galGroups.length || hasAliases || hasChildren) {
      var info = el("div", { class: "infobox" });
      var portraitOptions = [];
      if (data.cover) portraitOptions.push({ label: "Capa", url: data.cover, vis: data.coverVis || "publico", focus: data.coverFocus });
      galGroups.forEach(function (grp) {
        var first = data.gallery.filter(function (g) { return g.group === grp; })[0];
        if (first) portraitOptions.push({ label: grp || "Geral", url: first.url, vis: first.vis, focus: first.focus });
      });
      if (portraitOptions.length) {
        var portraitSlot = el("div", { class: "infobox-portrait" });
        function paintPortrait(opt) {
          portraitSlot.textContent = "";
          var posStyle = "object-position:" + objPos(opt.focus);
          if (opt.vis === "spoiler") portraitSlot.appendChild(spoilerCover(function () { return el("img", { class: "cover", style: posStyle, src: opt.url, alt: "" }); }));
          else portraitSlot.appendChild(el("img", { class: "cover", style: posStyle, src: opt.url, alt: "" }));
        }
        paintPortrait(portraitOptions[0]);
        if (portraitOptions.length > 1) {
          var tabsRow = el("div", { class: "infobox-tabs" });
          portraitOptions.forEach(function (opt, i) {
            var tabBtn = el("button", { type: "button", class: "infobox-tab" + (i === 0 ? " on" : ""), text: opt.label });
            tabBtn.addEventListener("click", function () {
              tabsRow.querySelectorAll(".infobox-tab").forEach(function (c) { c.classList.remove("on"); });
              tabBtn.classList.add("on");
              paintPortrait(opt);
            });
            tabsRow.appendChild(tabBtn);
          });
          info.appendChild(tabsRow);
        }
        info.appendChild(portraitSlot);
      }
      if (hasAliases || shortFields.length || hasChildren) {
        var itable = el("table", { class: "infobox-facts" });
        if (hasAliases) {
          var aliasTd = el("td");
          data.aliases.forEach(function (a) {
            var line = el("div", { class: "infobox-alias-line" });
            if (a.vis === "spoiler") line.appendChild(spoilerSpan(a.text));
            else line.appendChild(document.createTextNode(a.text));
            aliasTd.appendChild(line);
          });
          itable.appendChild(el("tr", {}, [el("th", { text: "Também conhecido(a) como" }), aliasTd]));
        }
        shortFields.forEach(function (f) {
          var td = el("td");
          if (f.vis === "spoiler") td.appendChild(spoilerCover(function () { var s = el("span"); mdInline(s, f.value); return s; }));
          else mdInline(td, f.value);
          itable.appendChild(el("tr", {}, [el("th", { text: f.key + (f.vis === "spoiler" ? " 🙈" : "") }), td]));
        });
        // Contém — o reverso do breadcrumb do topo (ex: uma província lista suas cidades),
        // mesma fonte (parentId) e mesma regra de só entrar quem também está publicado. Vira
        // fato da infobox, não seção própria — é um dado sobre a entrada, como população ou
        // governo, não um bloco de conteúdo.
        if (hasChildren) {
          var childTd = el("td");
          data.children.forEach(function (c, i) {
            if (i) childTd.appendChild(document.createTextNode(", "));
            childTd.appendChild(el("a", { href: wikiHref(c.targetId), text: c.targetTitle }));
          });
          itable.appendChild(el("tr", {}, [el("th", { text: "Contém" }), childTd]));
        }
        info.appendChild(itable);
      }
      card.appendChild(info);
    }

    // Uma "aba" (Geral, ou uma variante por obra/campanha) é seu próprio resumo+corpo+TOC+campos
    // longos+seções, montados aqui e trocados por visibilidade (não reconstruídos a cada clique).
    function buildArticle(bundle, anchorPrefix, extraToc) {
      var article = el("div", { class: "article" });
      if (bundle.summary) { var sp = el("p", { class: "summary" }); mdInline(sp, bundle.summary); article.appendChild(sp); }
      if (bundle.body) article.appendChild(renderMarkdown(bundle.body));

      var bLongFields = (bundle.fields || []).filter(function (f) { return f.type === "nota"; });
      var tocEntries = [];
      bLongFields.forEach(function (f, i) { var id = slugifyAnchor(f.key, anchorPrefix + "lf" + i); f._anchor = id; tocEntries.push({ id: id, label: f.key }); });
      (bundle.sections || []).forEach(function (s, i) { var id = slugifyAnchor(s.title || "Seção", anchorPrefix + "sc" + i); s._anchor = id; tocEntries.push({ id: id, label: s.title || "Seção" }); });
      (extraToc || []).forEach(function (t) { tocEntries.push(t); });
      if (tocEntries.length > 1) {
        var toc = el("div", { class: "toc" });
        toc.appendChild(el("div", { class: "toc-head", text: "Índice" }));
        var ol = el("ol");
        tocEntries.forEach(function (t) { ol.appendChild(el("li", {}, [el("a", { href: "#" + t.id, text: t.label })])); });
        toc.appendChild(ol);
        article.appendChild(toc);
      }

      bLongFields.forEach(function (f) {
        article.appendChild(el("div", { class: "cathead", id: f._anchor, text: f.key + (f.vis === "spoiler" ? " 🙈" : "") }));
        if (f.vis === "spoiler") article.appendChild(spoilerCover(function () { return renderMarkdown(f.value); }));
        else article.appendChild(renderMarkdown(f.value));
      });
      // <details> em vez de div — dá pro leitor recolher uma seção que não interessa (o autor já
      // podia fazer isso no próprio editor do tree; aqui era sempre tudo aberto, sem opção).
      // Aberta por padrão: colapsar é uma conveniência de quem está lendo, não um estado que o
      // autor "herda" pra decidir o que o visitante vê de cara.
      (bundle.sections || []).forEach(function (s) {
        var det = el("details", { class: "wiki-section", id: s._anchor, open: "open" });
        det.appendChild(el("summary", { class: "cathead", text: (s.title || "Seção") + (s.vis === "spoiler" ? " 🙈" : "") }));
        if (s.vis === "spoiler") det.appendChild(spoilerCover(function () { return renderMarkdown(s.body); }));
        else det.appendChild(renderMarkdown(s.body));
        article.appendChild(det);
      });
      return article;
    }
    var hasLinks = (data.links && data.links.length) || (data.backlinks && data.backlinks.length);
    var famTree = buildFamilyTree(data);
    var relGraph = buildRelGraph(data);
    var affinityGroups = affinitiesOf(data.links);
    var sharedToc = [];
    if (data.posts && data.posts.length) sharedToc.push({ id: "posts", label: "Posts" });
    var eventsSorted = (data.events || []).slice().sort(function (a, b) { return wbEventSortKey(a) - wbEventSortKey(b); });
    // Genealogia e Linha do tempo só existem como abas dentro desta seção combinada — o
    // rótulo do sumário/cabeçalho muda pra "Linha do tempo" quando a entrada tem eventos mas
    // nenhuma relação (linha do tempo é independente disso — uma entrada pode ter eventos sem
    // ter nenhuma relação registrada), senão fica "Relações" com as outras abas dentro.
    var relSectionLabel = relGraph ? "Relações" : (eventsSorted.length ? "Linha do tempo" : null);
    if (relSectionLabel) sharedToc.push({ id: "relacoes", label: relSectionLabel });
    if (affinityGroups.length) sharedToc.push({ id: "afinidades", label: "Afinidades" });
    if (hasLinks) sharedToc.push({ id: "ligacoes", label: "Ligações" });

    // Galeria e Citações entram como abas (mesmo seletor .work-tabs de Geral/variante de
    // obra), sempre por último, cada uma subdividida por "obra" (rótulo livre, mesmo esquema
    // já usado na própria Galeria) — um grupo sem nenhum item nunca aparece, porque a lista de
    // grupos só é construída a partir dos itens que de fato existem.
    function buildGalleryPanel() {
      var wrap = el("div", { class: "article" });
      galGroups.forEach(function (grp) {
        var items = data.gallery.filter(function (g) { return g.group === grp; });
        wrap.appendChild(el("div", { class: "gal-grouphead", text: grp || "Geral" }));
        var grid = el("div", { class: "gal-grid" });
        items.forEach(function (g) {
          var fig = el("figure", { class: "gal-item" });
          var galPos = "object-position:" + objPos(g.focus);
          if (g.vis === "spoiler") fig.appendChild(spoilerCover(function () { return el("img", { src: g.url, alt: g.caption || "", style: galPos }); }));
          else fig.appendChild(el("img", { src: g.url, alt: g.caption || "", style: galPos }));
          if (g.caption) fig.appendChild(el("figcaption", { text: g.caption }));
          grid.appendChild(fig);
        });
        wrap.appendChild(grid);
      });
      return wrap;
    }
    var citGroups = [];
    (data.citacoes || []).forEach(function (q) { if (citGroups.indexOf(q.group) === -1) citGroups.push(q.group); });
    function buildCitacoesPanel() {
      var wrap = el("div", { class: "article" });
      citGroups.forEach(function (grp) {
        var items = data.citacoes.filter(function (q) { return q.group === grp; });
        wrap.appendChild(el("div", { class: "gal-grouphead", text: grp || "Geral" }));
        var list = el("div", { class: "cit-list" });
        items.forEach(function (q) {
          var it = el("div", { class: "cit-item" });
          function paintText() { var t = el("div", { class: "cit-text", text: "“" + q.text + "”" }); return t; }
          if (q.vis === "spoiler") it.appendChild(spoilerCover(paintText)); else it.appendChild(paintText());
          var meta = el("div", { class: "cit-meta" });
          if (q.contextTitle) meta.appendChild(q.contextId ? el("a", { href: wikiHref(q.contextId), text: q.contextTitle }) : document.createTextNode(q.contextTitle));
          if (q.note) { if (meta.childNodes.length) meta.appendChild(document.createTextNode(" · ")); meta.appendChild(document.createTextNode(q.note)); }
          if (meta.childNodes.length) it.appendChild(meta);
          list.appendChild(it);
        });
        wrap.appendChild(list);
      });
      return wrap;
    }

    var tabPanels = [{ label: "Geral", el: buildArticle(data, "geral-", sharedToc) }];
    (data.variants || []).forEach(function (variant, vi) { tabPanels.push({ label: variant.label || "Versão", el: buildArticle(variant, "v" + vi + "-", []) }); });
    if (data.gallery && data.gallery.length) tabPanels.push({ label: "Galeria", el: buildGalleryPanel() });
    if (data.citacoes && data.citacoes.length) tabPanels.push({ label: "Citações", el: buildCitacoesPanel() });
    if (tabPanels.length > 1) {
      var tabsWrap = el("div", { class: "work-tabs" });
      tabPanels.forEach(function (p, i) {
        var tb = el("button", { type: "button", class: "work-tab" + (i === 0 ? " on" : ""), text: p.label });
        tb.addEventListener("click", function () {
          tabsWrap.querySelectorAll(".work-tab").forEach(function (b, j) { b.classList.toggle("on", j === i); });
          tabPanels.forEach(function (pp, j) { pp.el.hidden = j !== i; });
          currentTabLabel = p.label;
        });
        tabsWrap.appendChild(tb);
      });
      card.appendChild(tabsWrap);
    }
    tabPanels.forEach(function (p, i) { p.el.hidden = i !== 0; card.appendChild(p.el); });

    // posts — diário datado da própria entrada (mais recente primeiro; já vem ordenado do
    // snapshot). É sobre a entrada inteira, não de uma variante de obra específica, então mora
    // aqui fora do buildArticle, igual Ligações.
    if (data.posts && data.posts.length) {
      var pwrap = el("div", { class: "posts-wrap" });
      pwrap.appendChild(el("div", { class: "cathead", id: "posts", text: "Posts" }));
      data.posts.forEach(function (p) {
        var det = el("details", { class: "wiki-section post", open: "open" });
        det.appendChild(el("summary", { class: "post-summary", text: (p.date ? p.date + " · " : "") + (p.title || "(sem título)") + (p.vis === "spoiler" ? " 🙈" : "") }));
        if (p.vis === "spoiler") det.appendChild(spoilerCover(function () { return renderMarkdown(p.body); }));
        else det.appendChild(renderMarkdown(p.body));
        pwrap.appendChild(det);
      });
      card.appendChild(pwrap);
    }

    // Relações + Genealogia + Linha do tempo dividem uma seção, tabbed (reusa .work-tabs, o
    // mesmo visual do seletor de variante de obra) — Relações vem primeiro quando existe;
    // Genealogia só existe junto de Relações; Linha do tempo é independente das outras duas
    // (uma entrada pode ter eventos sem ter nenhuma relação registrada). Sem aba nenhuma
    // quando só existe UM dos três, pra não mostrar um seletor de uma opção só.
    if (relSectionLabel) {
      card.appendChild(el("div", { class: "cathead", id: "relacoes", text: relSectionLabel }));
      var relPanels = [];
      if (relGraph) relPanels.push({ label: "Relações", el: relGraph });
      if (famTree) relPanels.push({ label: "Genealogia", el: famTree });
      if (eventsSorted.length) relPanels.push({ label: "Linha do tempo", el: buildTimelineViz(eventsSorted, data) });
      if (relPanels.length > 1) {
        var relTabs = el("div", { class: "work-tabs" });
        relPanels.forEach(function (p, i) {
          var btn = el("button", { type: "button", class: "work-tab" + (i === 0 ? " on" : ""), text: p.label });
          btn.addEventListener("click", function () {
            relTabs.querySelectorAll(".work-tab").forEach(function (b, j) { b.classList.toggle("on", j === i); });
            relPanels.forEach(function (pp, j) { pp.el.hidden = j !== i; });
          });
          relTabs.appendChild(btn);
        });
        card.appendChild(relTabs);
      }
      relPanels.forEach(function (p, i) { p.el.hidden = i !== 0; card.appendChild(p.el); });
    }

    // Afinidades — destaque próprio pros vínculos de "practice"/"nature" (quem pratica/acredita/
    // fala/caça esta entrada, e o que ela mesma afeta/pratica/etc.), em vez de eles se perderem
    // anônimos dentro da lista genérica de Ligações logo abaixo (que ainda os lista também, de
    // propósito — mesma duplicação que já existe entre Genealogia e a lista de Ligações).
    if (affinityGroups.length) {
      var awrap = el("div", { class: "links-wrap" });
      awrap.appendChild(el("div", { class: "cathead", id: "afinidades", text: "Afinidades" }));
      affinityGroups.forEach(function (g, i) {
        if (i) awrap.appendChild(el("div", { class: "links-subhead", text: g.label }));
        else awrap.appendChild(el("div", { class: "links-subhead", text: g.label, style: "margin-top:0" }));
        var grow = el("div", { class: "links-grid" });
        g.items.forEach(function (lk) {
          var kids = [el("span", { class: "link-card-title", text: lk.targetTitle })];
          grow.appendChild(lk.targetId ? el("a", { class: "link-card", href: wikiHref(lk.targetId) }, kids) : el("div", { class: "link-card", style: "cursor:default", "aria-disabled": "true" }, kids));
        });
        awrap.appendChild(grow);
      });
      card.appendChild(awrap);
    }

    // ligações — só aparece pra quem também está publicado; o resto fica de fora de propósito
    // (a wiki é um grafo só do que é público, nunca uma menção morta a algo nunca publicado).
    // targetId ausente (ex: na prévia local de mestre) vira um cartão sem link, não um link morto.
    function linkCard(lk) {
      var kids = [el("span", { class: "link-card-label", text: lk.label || "ligação" }), el("span", { class: "link-card-title", text: lk.targetTitle })];
      return lk.targetId ? el("a", { class: "link-card", href: wikiHref(lk.targetId) }, kids) : el("div", { class: "link-card", style: "cursor:default", "aria-disabled": "true" }, kids);
    }
    if (hasLinks) {
      var lwrap = el("div", { class: "links-wrap" });
      lwrap.appendChild(el("div", { class: "cathead", id: "ligacoes", text: "Ligações" }));
      var lrow = el("div", { class: "links-grid" });
      (data.links || []).forEach(function (lk) { lrow.appendChild(linkCard(lk)); });
      card.appendChild(lwrap);
      lwrap.appendChild(lrow);
      if (data.backlinks && data.backlinks.length) {
        lwrap.appendChild(el("div", { class: "links-subhead", text: "Mencionado em" }));
        var browrap = el("div", { class: "links-grid" });
        data.backlinks.forEach(function (lk) { browrap.appendChild(linkCard(lk)); });
        lwrap.appendChild(browrap);
      }
    }

    if (data.tags && data.tags.length) {
      var tagWrap = el("div", { class: "tags" });
      data.tags.forEach(function (t) {
        if (t.vis === "spoiler") { tagWrap.appendChild(chip("#", t)); return; }
        tagWrap.appendChild(el("a", { class: "tag", href: homeHref() + "?q=" + encodeURIComponent(t.text), text: "#" + t.text }));
      });
      card.appendChild(tagWrap);
    }

    // Um índice que aponta pra uma seção recolhida precisa reabri-la antes de rolar até lá —
    // senão o clique "funciona" (rola) mas mostra só o título fechado, parecendo quebrado.
    card.querySelectorAll(".toc a[href^='#']").forEach(function (a) {
      a.addEventListener("click", function () {
        var t = document.getElementById(a.getAttribute("href").slice(1));
        if (t && t.tagName === "DETAILS") t.open = true;
      });
    });

    mountRestrito(card, wikiId);
    mountSuggestBox(loginBar, wikiId, data.title, function () { return currentTabLabel; }, card);
    page.appendChild(card);
    page.appendChild(el("div", { class: "foot", text: "página isolada, gerada a partir de uma entrada do tree" + (data.publishedAt ? " · " + data.publishedAt : "") }));
  }

  // Recaps de sessão de uma temporada de campanha — mesma casca (topbar, login, restrito), mas
  // o conteúdo é uma lista de sessões em vez de campos/seções de uma entrada.
  function renderSeason(data, wikiId) {
    if (!isParadiseGateMode()) applyUniAccent(data.universe);
    var page = document.getElementById("page");
    page.textContent = "";
    document.title = data.title || "wiki";
    var header = el("div", { class: "site-header" });
    var topbar = el("div", { class: "topbar" }, [el("a", { href: homeHref(), text: homeLabel() })]);
    if (data.universe && !isParadiseGateMode()) { topbar.appendChild(el("span", { class: "sep", text: "·" })); topbar.appendChild(el("span", { class: "topbar-uni", text: data.universe })); }
    header.appendChild(topbar);
    var loginBar = mountLoginBar(header);
    page.appendChild(header);
    var card = el("div", { class: "card" });
    card.appendChild(el("div", { class: "eyebrow" }, [el("span", { text: "TEMPORADA" + (isParadiseGateMode() || !data.universe ? "" : " · " + data.universe) })]));
    card.appendChild(el("h1", { text: data.title || "(sem título)" }));

    var sessions = data.sessions || [];
    // Sem capa/retrato (temporada não tem conceito de imagem própria) — só a tabela de fatos,
    // reaproveitando a mesma .infobox/.infobox-facts das páginas de entrada.
    var factRows = [];
    if (data.system) factRows.push(["Sistema", data.system]);
    if (data.status) factRows.push(["Status", data.status]);
    factRows.push(["Sessões", String(data.sessionCount != null ? data.sessionCount : sessions.length)]);
    if (data.cast && data.cast.length) factRows.push(["Elenco", data.cast.join(", ")]);
    if (factRows.length) {
      var info = el("div", { class: "infobox" });
      var itable = el("table", { class: "infobox-facts" });
      factRows.forEach(function (r) { itable.appendChild(el("tr", {}, [el("th", { text: r[0] }), el("td", { text: r[1] })])); });
      info.appendChild(itable);
      card.appendChild(info);
    }
    if (!sessions.length) {
      card.appendChild(el("div", { class: "empty", text: "Nenhum recap público ainda." }));
    } else {
      sessions.forEach(function (sx, i) {
        card.appendChild(el("div", { class: "cathead", id: "s" + i, text: (sx.title || "Sessão " + (i + 1)) + (sx.date ? " · " + sx.date : "") + (sx.vis === "spoiler" ? " 🙈" : "") }));
        if (sx.vis === "spoiler") card.appendChild(spoilerCover(function () { return renderMarkdown(sx.recap); }));
        else card.appendChild(renderMarkdown(sx.recap));
      });
    }
    mountRestrito(card, wikiId);
    mountSuggestBox(loginBar, wikiId, data.title, function () { return ""; }, card);
    page.appendChild(card);
    page.appendChild(el("div", { class: "foot", text: "página isolada, gerada a partir de uma temporada do tree" + (data.publishedAt ? " · " + data.publishedAt : "") }));
  }

  function renderHome(indexData) {
    var page = document.getElementById("page");
    page.textContent = "";
    document.title = homeLabel() + " · Wiki";
    var pg = isParadiseGateMode();
    var header = el("div", { class: "site-header" });
    var searchBox = el("input", { class: "home-search", type: "search", placeholder: "Buscar nome, tipo ou tag…", "aria-label": "Buscar" });
    // Paradise Gate: cabeçalho compacto (marca + busca + entrar numa linha só) — o antigo
    // bloco grande (título+subtítulo+busca centralizados) empurrava o feed de verdade pra
    // baixo da dobra sem motivo, já que a marca já aparece aqui. Ursprung mantém o layout
    // original (não foi pedido mexer ali, e o agrupamento por universo pede mais respiro).
    if (pg) {
      header.appendChild(el("div", { class: "brand" }, [el("a", { href: homeHref(), text: homeLabel() })]));
      searchBox.classList.add("header-search");
      header.appendChild(searchBox);
    }
    mountLoginBar(header);
    page.appendChild(header);
    var wrap = el("div", { class: "card" });
    if (!pg) {
      wrap.appendChild(el("div", { class: "home-title", text: homeLabel() }));
      wrap.appendChild(el("div", { class: "home-sub", text: "Wiki pública. Navegue pelas páginas publicadas." }));
      wrap.appendChild(searchBox);
    }

    var entries = Object.keys(indexData.entries || {}).map(function (id) {
      return Object.assign({ id: id }, indexData.entries[id]);
    });

    if (!entries.length) {
      wrap.appendChild(el("div", { class: "empty", text: "Nenhuma página publicada ainda." }));
      page.appendChild(wrap);
      return;
    }

    // Citação do dia / Personagem do dia (+ aniversariante) / Nota do dia / Entrada do dia /
    // Ano em foco — só no Paradise Gate (a wiki geral fica com o layout original). Sorteio
    // diário determinístico (ver wbDailyPick), então todo visitante vê a mesma escolha no
    // mesmo dia sem precisar de nenhum estado gravado em lugar nenhum.
    if (pg) {
      var todayMD = wbTodayMD();

      // Citação do dia
      var quotePool = [];
      entries.forEach(function (e) { (e.citacoes || []).forEach(function (q) { quotePool.push(Object.assign({ speakerId: e.id, speakerTitle: e.title }, q)); }); });
      var quotePick = wbDailyPick(quotePool, "citacao");
      var quoteWrap = el("div", { class: "spotlight-quote" });
      if (quotePick) {
        quoteWrap.appendChild(el("div", { class: "spotlight-quote-text", text: "“" + quotePick.text + "”" }));
        var attrBits = [el("a", { href: wikiHref(quotePick.speakerId), text: quotePick.speakerTitle })];
        var workName = quotePick.contextTitle || quotePick.group;
        if (workName) {
          attrBits.push(document.createTextNode(", em "));
          attrBits.push(quotePick.contextId ? el("a", { href: wikiHref(quotePick.contextId), text: workName }) : document.createTextNode(workName));
        }
        var attrEl = el("div", { class: "spotlight-quote-attr" }, [document.createTextNode("— ")].concat(attrBits));
        quoteWrap.appendChild(attrEl);
      } else {
        quoteWrap.appendChild(el("div", { class: "spotlight-quote-text spotlight-empty", text: "Nenhuma citação publicada ainda — o multiverso ainda está em silêncio." }));
      }
      wrap.appendChild(quoteWrap);

      // Personagem do dia — se alguém publicado faz aniversário hoje, ganha prioridade (com
      // tag de aniversariante); senão sorteia entre os Personagens, excluindo quem está na
      // própria janela de aniversário (pra não parecer coincidência estranha perto da data).
      var personagens = entries.filter(function (e) { return e.type === "Personagem"; });
      var birthdayFolks = personagens.filter(function (e) { return e.birthdayMD === todayMD; });
      var isAniversariante = birthdayFolks.length > 0;
      var charPool = isAniversariante ? birthdayFolks : personagens.filter(function (e) { return !e.birthdayMD || !wbInBirthdayWindow(todayMD, e.birthdayMD); });
      var charPick = wbDailyPick(charPool, "personagem");

      // Nota do dia
      var notePool = [];
      entries.forEach(function (e) { (e.posts || []).forEach(function (p) { notePool.push({ id: p.id, title: p.title, date: p.date, entryId: e.id, entryTitle: e.title }); }); });
      var notePick = wbDailyPick(notePool, "nota");

      // Entrada do dia — qualquer tipo menos Personagem (que já tem seu próprio destaque acima).
      var entradaPool = entries.filter(function (e) { return e.type !== "Personagem"; });
      var entradaPick = wbDailyPick(entradaPool, "entrada");

      // Ano em foco — sorteia entre os anos que têm ao menos um evento "principal", depois
      // lista TODOS os eventos principais daquele ano (de qualquer entrada).
      var yearEvents = {};
      entries.forEach(function (e) { (e.events || []).forEach(function (ev) { if (ev.major) { (yearEvents[ev.y] = yearEvents[ev.y] || []).push(Object.assign({ entryId: e.id, entryTitle: e.title }, ev)); } }); });
      var yearsPool = Object.keys(yearEvents).map(Number);
      var yearPick = wbDailyPick(yearsPool, "ano");

      var spotGrid = el("div", { class: "spotlight-grid" });
      var spotLeft = el("div");

      function charCard(e, badge) {
        var kids = [];
        if (e.cover) kids.push(el("img", { class: "spotlight-char-cover", src: e.cover, alt: "", loading: "lazy", style: "object-position:" + objPos(e.coverFocus) }));
        var body = el("div", { class: "spotlight-char-body" }, [
          el("div", { class: "spotlight-char-eyebrow", text: "Personagem do dia" }),
          el("div", { class: "spotlight-char-title", text: e.title || "(sem título)" })
        ]);
        kids.push(body);
        var a = el("a", { class: "spotlight-char", href: wikiHref(e.id) }, kids);
        if (badge) a.appendChild(el("div", { class: "spotlight-badge", text: "🎂 aniversariante" }));
        return a;
      }
      if (charPick) spotLeft.appendChild(charCard(charPick, isAniversariante));
      else spotLeft.appendChild(el("div", { class: "spotlight-char" }, [el("div", { class: "spotlight-char-body" }, [el("div", { class: "spotlight-char-eyebrow", text: "Personagem do dia" }), el("div", { class: "spotlight-empty", text: "Ainda sem personagens publicados." })])]));

      var pairWrap = el("div", { class: "spotlight-pair" });
      function miniCard(eyebrow, title, href, emptyText) {
        if (!title) return el("div", { class: "spotlight-mini" }, [el("div", { class: "spotlight-mini-eyebrow", text: eyebrow }), el("div", { class: "spotlight-empty", text: emptyText })]);
        return el("a", { class: "spotlight-mini", href: href }, [el("div", { class: "spotlight-mini-eyebrow", text: eyebrow }), el("div", { class: "spotlight-mini-title", text: title })]);
      }
      pairWrap.appendChild(notePick ? miniCard("Nota do dia", notePick.title || "(sem título)", wikiHref(notePick.entryId) + "#posts") : miniCard("Nota do dia", null, null, "Nenhuma nota ainda."));
      pairWrap.appendChild(entradaPick ? miniCard("Entrada do dia", entradaPick.title, wikiHref(entradaPick.id)) : miniCard("Entrada do dia", null, null, "Nenhuma entrada ainda."));
      spotLeft.appendChild(pairWrap);
      spotGrid.appendChild(spotLeft);

      var yearWrap = el("div", { class: "spotlight-year" });
      yearWrap.appendChild(el("div", { class: "spotlight-year-head", text: "Ano em foco" }));
      if (yearPick != null) {
        yearWrap.appendChild(el("a", { class: "spotlight-year-num", href: wikiHref("_timeline") + "?ano=" + yearPick, text: String(yearPick) }));
        var yList = el("div", { class: "spotlight-year-list" });
        yearEvents[yearPick].sort(function (a, b) { return wbEventSortKey(a) - wbEventSortKey(b); }).forEach(function (ev) {
          yList.appendChild(el("a", { class: "timeline-event major", href: wikiHref(ev.entryId) }, [
            el("span", { class: "ev-date", text: wbFmtEventDate(ev) }),
            el("span", { class: "ev-text", text: ev.label })
          ]));
        });
        yearWrap.appendChild(yList);
      } else {
        yearWrap.appendChild(el("div", { class: "spotlight-empty", text: "Nenhum evento principal marcado ainda." }));
      }
      spotGrid.appendChild(yearWrap);
      wrap.appendChild(spotGrid);
    }

    // Novidades — as páginas mais recentemente publicadas/atualizadas primeiro, pra quem não
    // fica checando toda hora ter como ver rápido o que mudou desde a última visita. Some
    // enquanto uma busca está ativa (não faz sentido mostrar "o que mudou" no meio de um
    // resultado de busca) e pagina de 8 em 8 em vez de cortar o resto fora sem aviso.
    var NEWS_PAGE = 8;
    var newsShown = NEWS_PAGE;
    var newsSection = el("div");
    wrap.appendChild(newsSection);
    var recentAll = entries.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });
    function paintNews() {
      newsSection.textContent = "";
      if (!recentAll.length) return;
      newsSection.appendChild(el("div", { class: "home-unihead", text: "🕓 Novidades" }));
      var newsGrid = el("div", { class: "links-grid" });
      recentAll.slice(0, newsShown).forEach(function (e) {
        var kids = [];
        if (e.cover) kids.push(el("img", { class: "link-card-cover", src: e.cover, alt: "", loading: "lazy", style: "object-position:" + objPos(e.coverFocus) }));
        kids.push(el("span", { class: "link-card-label", text: (e.updatedAt || "") + (e.type ? " · " + e.type : "") }));
        kids.push(el("span", { class: "link-card-title", text: e.title || "(sem título)" }));
        newsGrid.appendChild(el("a", { class: "link-card", href: wikiHref(e.id) }, kids));
      });
      newsSection.appendChild(newsGrid);
      if (recentAll.length > newsShown) {
        var moreBtn = el("button", { class: "home-random", type: "button", style: "margin-top:10px", text: "ver mais novidades" });
        moreBtn.addEventListener("click", function () { newsShown += NEWS_PAGE; paintNews(); });
        newsSection.appendChild(moreBtn);
      }
    }
    paintNews();

    // Notas recentes — distinto de Novidades de propósito: Novidades é sobre O QUE MUDOU na
    // wiki (páginas publicadas/atualizadas), isto aqui é conteúdo narrativo de verdade (o
    // texto de uma nota específica), reaproveitando o Posts que já existia por entrada. Mesma
    // paginação de 8 em 8, mesmo sumiço durante busca que Novidades já tinha.
    var NOTES_PAGE = 8;
    var notesShown = NOTES_PAGE;
    var notesSection = el("div");
    wrap.appendChild(notesSection);
    var allNotes = [];
    entries.forEach(function (e) { (e.posts || []).forEach(function (p) { allNotes.push({ id: p.id, title: p.title, date: p.date, entryId: e.id, entryTitle: e.title }); }); });
    allNotes.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    function paintNotes() {
      notesSection.textContent = "";
      if (!allNotes.length) return;
      notesSection.appendChild(el("div", { class: "home-unihead", text: "📝 Notas recentes" }));
      var notesGrid = el("div", { class: "links-grid" });
      allNotes.slice(0, notesShown).forEach(function (n) {
        notesGrid.appendChild(el("a", { class: "link-card", href: wikiHref(n.entryId) + "#posts" }, [
          el("span", { class: "link-card-label", text: (n.date || "") + " · " + n.entryTitle }),
          el("span", { class: "link-card-title", text: n.title || "(sem título)" })
        ]));
      });
      notesSection.appendChild(notesGrid);
      if (allNotes.length > notesShown) {
        var moreNotesBtn = el("button", { class: "home-random", type: "button", style: "margin-top:10px", text: "ver mais notas" });
        moreNotesBtn.addEventListener("click", function () { notesShown += NOTES_PAGE; paintNotes(); });
        notesSection.appendChild(moreNotesBtn);
      }
    }
    paintNotes();

    var randomBtn = el("button", { class: "home-random", type: "button", text: "🎲 página aleatória" });
    randomBtn.addEventListener("click", function () {
      var pick = entries[Math.floor(Math.random() * entries.length)];
      location.href = wikiHref(pick.id);
    });
    if (!pg) wrap.appendChild(randomBtn);

    // Paradise Gate only: tira de estatísticas (soma os campos que wbIndexEntry manda desde
    // 2026-09-16 — entradas publicadas antes disso simplesmente somam 0 até republicarem,
    // não quebra) + nuvem das tags mais usadas + o botão de página aleatória reposicionado
    // pra cá (antes ficava logo após Novidades; esse espaço fazia mais sentido pra ele já
    // que ambos são "descoberta", não "o que mudou").
    if (pg) {
      var totalWords = 0, totalLinks = 0, totalPosts = 0;
      var tagFreq = {};
      entries.forEach(function (e) {
        totalWords += e.wordCount || 0;
        totalLinks += e.linkCount || 0;
        totalPosts += e.postsCount || 0;
        (e.tags || []).forEach(function (t) { tagFreq[t] = (tagFreq[t] || 0) + 1; });
      });
      var statsStrip = el("div", { class: "stats-strip" });
      [["Páginas", entries.length], ["Palavras", wbFmtCompact(totalWords)], ["Conexões", totalLinks], ["Notas", totalPosts]].forEach(function (s) {
        statsStrip.appendChild(el("div", { class: "stat-item" }, [el("span", { class: "stat-num", text: String(s[1]) }), el("span", { class: "stat-lbl", text: s[0] })]));
      });
      wrap.appendChild(statsStrip);

      var topTags = Object.keys(tagFreq).sort(function (a, b) { return tagFreq[b] - tagFreq[a]; }).slice(0, 10);
      if (topTags.length) {
        wrap.appendChild(el("div", { class: "cathead", text: "🏷 Tags em destaque" }));
        var tagCloud = el("div", { class: "tag-cloud" });
        topTags.forEach(function (t) { tagCloud.appendChild(el("a", { class: "tag-chip", href: homeHref() + "?q=" + encodeURIComponent(t), text: "#" + t })); });
        wrap.appendChild(tagCloud);
      }
      var actionsRow = el("div", { style: "display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:12px" });
      randomBtn.style.margin = "0";
      actionsRow.appendChild(randomBtn);
      actionsRow.appendChild(el("a", { class: "home-random", style: "margin:0", href: wikiHref("_timeline"), text: "📜 linha do tempo completa" }));
      wrap.appendChild(actionsRow);
    }

    var listWrap = el("div", { class: "home-groups" });
    wrap.appendChild(listWrap);

    // Se a busca só bateu dentro do texto (não no título/tipo/universo/tags), mostra um
    // trechinho ao redor da palavra encontrada — senão a busca por corpo de texto acha a
    // página certa mas não dá nenhuma pista de POR QUE ela apareceu no resultado.
    function snippetFor(e, q) {
      var hay = (e.search || "").toLowerCase();
      var idx = hay.indexOf(q);
      if (idx === -1) return null;
      var start = Math.max(0, idx - 40), end = Math.min(e.search.length, idx + q.length + 40);
      return (start > 0 ? "…" : "") + e.search.slice(start, end).trim() + (end < e.search.length ? "…" : "");
    }
    function renderList(filterText) {
      listWrap.textContent = "";
      var q = (filterText || "").toLowerCase().trim();
      newsSection.hidden = !!q;
      notesSection.hidden = !!q;
      // Busca também bate no TÍTULO das notas (não no corpo — não está no índice, ver
      // wbIndexEntry) — assim uma nota chamada "A Noite do Duelo" aparece buscando "duelo",
      // ainda que a palavra não esteja em mais nenhum outro campo indexado da entrada.
      var filtered = entries.filter(function (e) {
        var postTitles = (e.posts || []).map(function (p) { return p.title; }).join(" ");
        return !q || (e.title + " " + e.type + " " + e.universe + " " + (e.tags || []).join(" ") + " " + postTitles + " " + (e.search || "")).toLowerCase().indexOf(q) !== -1;
      });
      if (!filtered.length) { listWrap.appendChild(el("div", { class: "empty", text: "Nada encontrado." })); return; }
      // No Paradise Gate a wiki nunca deixa entender que existem outros universos — como o
      // índice ali só tem o Lótus mesmo, o grupo "LÓTUS" apareceria sozinho sem servir pra
      // nada além de vazar o nome interno do universo. Agrupamento por universo só faz
      // sentido (e só aparece) na wiki geral.
      function cardFor(e) {
        var card = el("a", { class: "home-card", href: wikiHref(e.id) });
        if (e.cover) card.appendChild(el("img", { class: "home-card-cover", src: e.cover, alt: "", loading: "lazy", style: "object-position:" + objPos(e.coverFocus) }));
        card.appendChild(el("div", { class: "home-card-title", text: e.title || "(sem título)" }));
        card.appendChild(el("div", { class: "home-card-meta", text: e.type || "" }));
        var snip = q ? snippetFor(e, q) : null;
        if (snip) card.appendChild(el("div", { class: "home-card-snippet", text: snip }));
        return card;
      }
      if (isParadiseGateMode()) {
        var flatGrid = el("div", { class: "home-grid" });
        filtered.sort(function (a, b) { return (a.title || "").localeCompare(b.title || ""); }).forEach(function (e) { flatGrid.appendChild(cardFor(e)); });
        listWrap.appendChild(flatGrid);
        return;
      }
      var byUni = {};
      filtered.forEach(function (e) { var k = e.universe || "Sem universo"; (byUni[k] = byUni[k] || []).push(e); });
      Object.keys(byUni).sort().forEach(function (uni) {
        var c = UNI_ACCENT[uni];
        var headStyle = c ? "color:" + c.ink + ";border-bottom-color:" + c.gold : null;
        listWrap.appendChild(el("div", { class: "home-unihead", style: headStyle, text: uni }));
        var grid = el("div", { class: "home-grid" });
        byUni[uni].sort(function (a, b) { return (a.title || "").localeCompare(b.title || ""); }).forEach(function (e) { grid.appendChild(cardFor(e)); });
        listWrap.appendChild(grid);
      });
    }
    var initialQ = new URLSearchParams(location.search).get("q") || "";
    searchBox.value = initialQ;
    renderList(initialQ);
    searchBox.addEventListener("input", function () { renderList(searchBox.value); });
    page.appendChild(wrap);
  }

  // Linha do tempo geral — reúne os eventos de TODAS as entradas publicadas (já vêm só
  // "publico" desde o índice, ver wbIndexEntry) num só lugar, filtrável por tipo de entrada
  // e por ano. Cada evento linka de volta pra entrada que o originou. "major" (marcado no
  // editor) é o mesmo campo que o "ano em foco" da home usa pra sortear — aqui ele só regula
  // o filtro "só principais", o registro completo continua visível por padrão.
  function renderTimeline(indexData) {
    var page = document.getElementById("page");
    page.textContent = "";
    document.title = "Linha do tempo · " + homeLabel();
    var header = el("div", { class: "site-header" });
    header.appendChild(el("div", { class: "brand" }, [el("a", { href: homeHref(), text: homeLabel() })]));
    mountLoginBar(header);
    page.appendChild(header);

    var entries = Object.keys(indexData.entries || {}).map(function (id) { return Object.assign({ id: id }, indexData.entries[id]); });
    var allEvents = [];
    entries.forEach(function (e) {
      (e.events || []).forEach(function (ev) {
        allEvents.push({ label: ev.label, y: ev.y, m: ev.m, d: ev.d, note: ev.note, major: !!ev.major, entryId: e.id, entryTitle: e.title, entryType: e.type });
      });
    });
    allEvents.sort(function (a, b) { return wbEventSortKey(a) - wbEventSortKey(b); });

    var wrap = el("div", { class: "card" });
    wrap.appendChild(el("div", { class: "home-title", text: "Linha do tempo" }));
    wrap.appendChild(el("div", { class: "home-sub", text: homeLabel() + " · " + allEvents.length + " evento(s) publicado(s)" }));

    if (!allEvents.length) {
      wrap.appendChild(el("div", { class: "empty", text: "Nenhum evento publicado ainda." }));
      page.appendChild(wrap);
      return;
    }

    var types = [];
    entries.forEach(function (e) { if (e.type && types.indexOf(e.type) === -1) types.push(e.type); });
    types.sort();

    var filterBar = el("div", { class: "timeline-filters" });
    var typeSel = el("select", { class: "field" }, [el("option", { value: "", text: "todos os tipos" })].concat(types.map(function (t) { return el("option", { value: t, text: t }); })));
    var yearIn = el("input", { class: "field", type: "number", placeholder: "ano", style: "width:100px", value: new URLSearchParams(location.search).get("ano") || "" });
    var majorLbl = el("label", { class: "timeline-major-lbl" }, [el("input", { type: "checkbox" }), " só principais"]);
    var majorChk = majorLbl.querySelector("input");
    filterBar.appendChild(typeSel); filterBar.appendChild(yearIn); filterBar.appendChild(majorLbl);
    wrap.appendChild(filterBar);

    var listWrap = el("div", { class: "timeline-list" });
    wrap.appendChild(listWrap);

    function paint() {
      listWrap.textContent = "";
      var typeQ = typeSel.value, yearQ = yearIn.value.trim(), majorQ = majorChk.checked;
      var shown = allEvents.filter(function (ev) {
        if (typeQ && ev.entryType !== typeQ) return false;
        if (yearQ && String(ev.y) !== yearQ) return false;
        if (majorQ && !ev.major) return false;
        return true;
      });
      if (!shown.length) { listWrap.appendChild(el("div", { class: "empty", text: "Nada encontrado com esses filtros." })); return; }
      var curYear = null, yearGroup = null;
      shown.forEach(function (ev) {
        if (ev.y !== curYear) {
          curYear = ev.y;
          yearGroup = el("div", { class: "timeline-year", text: "Ano " + curYear });
          listWrap.appendChild(yearGroup);
        }
        var row = el("a", { class: "timeline-event" + (ev.major ? " major" : ""), href: wikiHref(ev.entryId) }, [
          el("span", { class: "ev-date", text: wbFmtEventDate(ev) }),
          el("span", { class: "ev-text", text: ev.label || "(evento)" }),
          el("span", { class: "ev-origin", text: ev.entryTitle })
        ]);
        listWrap.appendChild(row);
      });
    }
    typeSel.addEventListener("change", paint);
    yearIn.addEventListener("input", paint);
    majorChk.addEventListener("change", paint);
    paint();
    page.appendChild(wrap);
  }

  function showMessage(msg) {
    var page = document.getElementById("page");
    page.innerHTML = "";
    page.appendChild(el("div", { class: "empty", text: msg }));
  }

  // Every universe id tree's own index.html knows about (see FLOWERS there) — the geral wiki's
  // home merges whichever of these the visitor is actually allowed to read (see the Firestore
  // rule on wikiIndex/{universeId}); denied ones just come back empty, no error shown, so an
  // account with access to everything-but-Cravo never even learns Cravo has entries.
  var WB_UNIVERSE_IDS = ["raiz", "rosa", "crisantemo", "girassol", "cravo", "miosotis", "violeta", "lotus"];
  function wikiCoreBoot() {
    // Identidade visual "Academia Whitmore" (azul-royal + prata, mesma paleta do email de
    // convite) só no Paradise Gate — o Ursprung continua no herbário, já que ali entram as
    // outras 6 flores e o azul é especificamente da instituição fictícia do Lótus. Marcado
    // como classe (não media query) porque é fixo, independente do tema claro/escuro do sistema.
    document.body.classList.toggle("pg-theme", isParadiseGateMode());
    if (typeof firebase === "undefined") { showMessage("Não consegui carregar a conexão com a nuvem."); return; }
    try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) {}
    var fs = firebase.firestore();
    var slug = resolveSlug();
    var pgMode = isParadiseGateMode();
    function loadIndex() {
      if (pgMode) {
        return fs.collection("wikiIndex").doc("lotus").get().then(function (snap) { return { entries: (snap.exists && snap.data().entries) || {} }; });
      }
      return Promise.all(WB_UNIVERSE_IDS.map(function (uid) {
        return fs.collection("wikiIndex").doc(uid).get()
          .then(function (snap) { return (snap.exists && snap.data().entries) || {}; })
          .catch(function () { return {}; });
      })).then(function (parts) {
        var merged = {}; parts.forEach(function (p) { Object.assign(merged, p); });
        return { entries: merged };
      });
    }
    if (!slug || slug === "_index") {
      loadIndex().then(renderHome).catch(function () { showMessage("Não consegui carregar a wiki agora. Tente de novo mais tarde."); });
    } else if (slug === "_timeline") {
      loadIndex().then(renderTimeline).catch(function () { showMessage("Não consegui carregar a linha do tempo agora. Tente de novo mais tarde."); });
    } else {
      fs.collection("wikiPublic").doc(slug).get().then(function (snap) {
        if (!snap.exists || (pgMode && snap.data().universeId !== "lotus")) { showMessage("Essa página não existe mais (o link pode ter sido despublicado)."); return; }
        var data = snap.data();
        if (data.kind === "temporada") renderSeason(data, slug);
        else renderEntry(data, slug);
      }).catch(function () { showMessage("Não consegui carregar essa página agora. Tente de novo mais tarde."); });
    }
  }

  // Used by index.html's "ver como wiki" preview (an iframe with no Firebase scripts loaded at
  // all — mountLoginBar/mountRestrito both no-op harmlessly since `firebase` is undefined there):
  // renders already-complete local data with zero network fetch, for the owner's own reading.
  function wikiCoreRenderStatic(data) { renderEntry(data, null); }

  window.wikiCoreBoot = wikiCoreBoot;
  window.wikiCoreRenderStatic = wikiCoreRenderStatic;
})();
