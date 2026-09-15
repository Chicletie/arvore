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
  function slugifyAnchor(s, i) { return "sec-" + i + "-" + String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30); }

  // /arvore/wiki/leonel-bianchi and /arvore/wiki.html and /arvore/404.html all need to agree
  // on where "the site root" is, so every internal link is absolute and correct regardless of
  // which physical file the server actually returned for the current URL.
  function siteRoot() {
    var path = location.pathname;
    path = path.replace(/\/wiki\/[^/]*$/, "/").replace(/\/wiki\/?$/, "/").replace(/\/(wiki|404)\.html$/, "/");
    if (path.charAt(path.length - 1) !== "/") path += "/";
    return path;
  }
  var ROOT = siteRoot();
  function wikiHref(id) { return ROOT + "wiki/" + encodeURIComponent(id); }

  function resolveSlug() {
    var m = location.pathname.match(/\/wiki\/([^/?#]+)\/?$/);
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
    var btn = el("button", { class: "spoiler-reveal", type: "button", text: "🙈 spoiler — toque para revelar" });
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

  // Login only matters for "restrito" content — público/spoiler never need it. A signed-in
  // session persists across page loads (Firebase's own local persistence), so a player who logs
  // in once stays in on later visits until they sign out.
  function mountLoginBar(host) {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    var bar = el("div", { class: "login-bar" });
    function paint() {
      bar.textContent = "";
      var u = firebase.auth().currentUser;
      if (u) {
        bar.appendChild(el("span", { text: "logado como " + u.email + " · " }));
        var out = el("button", { class: "linklike", type: "button", text: "sair" });
        out.addEventListener("click", function () { firebase.auth().signOut(); });
        bar.appendChild(out);
      } else {
        var inBtn = el("button", { class: "linklike", type: "button", text: "entrar (pra ver conteúdo restrito)" });
        inBtn.addEventListener("click", openLoginModal);
        bar.appendChild(inBtn);
      }
    }
    paint();
    firebase.auth().onAuthStateChanged(paint);
    host.appendChild(bar);
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
        err.textContent = "Não consegui entrar — confira email e senha.";
      });
    }
    submitBtn.addEventListener("click", doSubmit);
    passInp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") doSubmit(); });
    box.appendChild(submitBtn);
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
          if (it.kind === "campo") {
            slot.appendChild(el("div", { class: "cathead", style: "font-size:11px;margin-top:14px", text: it.key }));
            slot.appendChild(renderMarkdown(it.value));
          } else if (it.kind === "secao") {
            slot.appendChild(el("div", { class: "cathead", style: "font-size:11px;margin-top:14px", text: it.title || "Seção" }));
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
          }
        });
      }).catch(function () { /* not signed in as anyone with access to this item — nothing to show */ });
    }
    refresh();
    firebase.auth().onAuthStateChanged(refresh);
  }

  function renderEntry(data, wikiId) {
    var page = document.getElementById("page");
    page.textContent = "";
    document.title = data.title || "wiki";
    mountLoginBar(page);
    var topbar = el("div", { class: "topbar" }, [el("a", { href: ROOT + "wiki.html", text: "🌿 Herbário do Multiverso" })]);
    if (data.universe) { topbar.appendChild(el("span", { class: "sep", text: "·" })); topbar.appendChild(el("span", { text: data.universe })); }
    page.appendChild(topbar);
    var card = el("div", { class: "card" });

    var eyebrowBits = [data.type, data.universe].filter(Boolean);
    if (eyebrowBits.length) card.appendChild(el("div", { class: "eyebrow" }, [el("span", { text: eyebrowBits.join(" · ") })]));
    card.appendChild(el("h1", { text: data.title || "(sem título)" }));
    if (data.aliases && data.aliases.length) {
      var aliasLine = el("div", { class: "aliases" }, [el("span", { text: "também: " })]);
      data.aliases.forEach(function (a, i) {
        if (i) aliasLine.appendChild(document.createTextNode(", "));
        if (a.vis === "spoiler") aliasLine.appendChild(spoilerSpan(a.text));
        else aliasLine.appendChild(document.createTextNode(a.text));
      });
      card.appendChild(aliasLine);
    }

    var shortFields = (data.fields || []).filter(function (f) { return f.type !== "nota"; });
    var longFields = (data.fields || []).filter(function (f) { return f.type === "nota"; });
    var galGroups = [];
    (data.gallery || []).forEach(function (g) { if (galGroups.indexOf(g.group) === -1) galGroups.push(g.group); });

    // infobox — cover + short facts, floats beside the article on wide screens. When there's a
    // gallery, the portrait becomes switchable: one tab per group (ex: "Primeira Temporada",
    // "Segunda Temporada"), each showing that group's first image — same idea as a fandom
    // infobox's season-switcher, tabs sit right above the picture.
    if (data.cover || shortFields.length || galGroups.length) {
      var info = el("div", { class: "infobox" });
      var portraitOptions = [];
      if (data.cover) portraitOptions.push({ label: "Capa", url: data.cover, vis: data.coverVis || "publico" });
      galGroups.forEach(function (grp) {
        var first = data.gallery.filter(function (g) { return g.group === grp; })[0];
        if (first) portraitOptions.push({ label: grp || "Geral", url: first.url, vis: first.vis });
      });
      if (portraitOptions.length) {
        var portraitSlot = el("div", { class: "infobox-portrait" });
        function paintPortrait(opt) {
          portraitSlot.textContent = "";
          if (opt.vis === "spoiler") portraitSlot.appendChild(spoilerCover(function () { return el("img", { class: "cover", src: opt.url, alt: "" }); }));
          else portraitSlot.appendChild(el("img", { class: "cover", src: opt.url, alt: "" }));
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
      if (shortFields.length) {
        var itable = el("table", { class: "infobox-facts" });
        shortFields.forEach(function (f) {
          var td = el("td");
          if (f.vis === "spoiler") td.appendChild(spoilerCover(function () { var s = el("span"); mdInline(s, f.value); return s; }));
          else mdInline(td, f.value);
          itable.appendChild(el("tr", {}, [el("th", { text: f.key + (f.vis === "spoiler" ? " 🙈" : "") }), td]));
        });
        info.appendChild(itable);
      }
      card.appendChild(info);
    }

    var article = el("div", { class: "article" });
    if (data.summary) { var sp = el("p", { class: "summary" }); mdInline(sp, data.summary); article.appendChild(sp); }
    if (data.body) article.appendChild(renderMarkdown(data.body));

    // índice — pula pra cada seção/campo longo/galeria, só aparece se houver o que listar
    var tocEntries = [];
    longFields.forEach(function (f, i) { var id = slugifyAnchor(f.key, "lf" + i); f._anchor = id; tocEntries.push({ id: id, label: f.key }); });
    (data.sections || []).forEach(function (s, i) { var id = slugifyAnchor(s.title || "Seção", "sc" + i); s._anchor = id; tocEntries.push({ id: id, label: s.title || "Seção" }); });
    if (data.gallery && data.gallery.length) tocEntries.push({ id: "galeria", label: "Galeria" });
    var hasLinks = (data.links && data.links.length) || (data.backlinks && data.backlinks.length);
    if (hasLinks) tocEntries.push({ id: "ligacoes", label: "Ligações" });
    if (tocEntries.length > 1) {
      var toc = el("div", { class: "toc" });
      toc.appendChild(el("div", { class: "toc-head", text: "Índice" }));
      var ol = el("ol");
      tocEntries.forEach(function (t) { ol.appendChild(el("li", {}, [el("a", { href: "#" + t.id, text: t.label })])); });
      toc.appendChild(ol);
      article.appendChild(toc);
    }

    longFields.forEach(function (f) {
      article.appendChild(el("div", { class: "cathead", id: f._anchor, text: f.key + (f.vis === "spoiler" ? " 🙈" : "") }));
      if (f.vis === "spoiler") article.appendChild(spoilerCover(function () { return renderMarkdown(f.value); }));
      else article.appendChild(renderMarkdown(f.value));
    });
    (data.sections || []).forEach(function (s) {
      article.appendChild(el("div", { class: "cathead", id: s._anchor, text: (s.title || "Seção") + (s.vis === "spoiler" ? " 🙈" : "") }));
      if (s.vis === "spoiler") article.appendChild(spoilerCover(function () { return renderMarkdown(s.body); }));
      else article.appendChild(renderMarkdown(s.body));
    });
    card.appendChild(article);

    // galeria — agrupada por rótulo livre (ex: "Primeira Temporada", "Segunda Temporada")
    if (data.gallery && data.gallery.length) {
      var gwrap = el("div", { class: "gallery-wrap" });
      gwrap.appendChild(el("div", { class: "cathead", id: "galeria", text: "Galeria" }));
      galGroups.forEach(function (grp) {
        var items = data.gallery.filter(function (g) { return g.group === grp; });
        gwrap.appendChild(el("div", { class: "gal-grouphead", text: grp || "Geral" }));
        var grid = el("div", { class: "gal-grid" });
        items.forEach(function (g) {
          var fig = el("figure", { class: "gal-item" });
          if (g.vis === "spoiler") fig.appendChild(spoilerCover(function () { return el("img", { src: g.url, alt: g.caption || "" }); }));
          else fig.appendChild(el("img", { src: g.url, alt: g.caption || "" }));
          if (g.caption) fig.appendChild(el("figcaption", { text: g.caption }));
          grid.appendChild(fig);
        });
        gwrap.appendChild(grid);
      });
      card.appendChild(gwrap);
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
        tagWrap.appendChild(el("a", { class: "tag", href: ROOT + "wiki.html?q=" + encodeURIComponent(t.text), text: "#" + t.text }));
      });
      card.appendChild(tagWrap);
    }

    mountRestrito(card, wikiId);
    page.appendChild(card);
    page.appendChild(el("div", { class: "foot", text: "página isolada, gerada a partir de uma entrada do tree" + (data.publishedAt ? " · " + data.publishedAt : "") }));
  }

  function renderHome(indexData) {
    var page = document.getElementById("page");
    page.textContent = "";
    document.title = "Herbário do Multiverso — Wiki";
    mountLoginBar(page);
    var wrap = el("div", { class: "card" });
    wrap.appendChild(el("div", { class: "home-title", text: "🌿 Herbário do Multiverso" }));
    wrap.appendChild(el("div", { class: "home-sub", text: "Wiki pública — navegue pelas páginas publicadas." }));
    var searchBox = el("input", { class: "home-search", type: "search", placeholder: "Buscar personagens, locais, facções…", "aria-label": "Buscar" });
    wrap.appendChild(searchBox);

    var entries = Object.keys(indexData.entries || {}).map(function (id) {
      return Object.assign({ id: id }, indexData.entries[id]);
    });

    if (!entries.length) {
      wrap.appendChild(el("div", { class: "empty", text: "Nenhuma página publicada ainda." }));
      page.appendChild(wrap);
      return;
    }

    var randomBtn = el("button", { class: "home-random", type: "button", text: "🎲 página aleatória" });
    randomBtn.addEventListener("click", function () {
      var pick = entries[Math.floor(Math.random() * entries.length)];
      location.href = wikiHref(pick.id);
    });
    wrap.appendChild(randomBtn);

    var listWrap = el("div", { class: "home-groups" });
    wrap.appendChild(listWrap);

    function renderList(filterText) {
      listWrap.textContent = "";
      var q = (filterText || "").toLowerCase().trim();
      var filtered = entries.filter(function (e) {
        return !q || (e.title + " " + e.type + " " + e.universe + " " + (e.tags || []).join(" ")).toLowerCase().indexOf(q) !== -1;
      });
      if (!filtered.length) { listWrap.appendChild(el("div", { class: "empty", text: "Nada encontrado." })); return; }
      var byUni = {};
      filtered.forEach(function (e) { var k = e.universe || "—"; (byUni[k] = byUni[k] || []).push(e); });
      Object.keys(byUni).sort().forEach(function (uni) {
        listWrap.appendChild(el("div", { class: "home-unihead", text: uni }));
        var grid = el("div", { class: "home-grid" });
        byUni[uni].sort(function (a, b) { return (a.title || "").localeCompare(b.title || ""); }).forEach(function (e) {
          var card = el("a", { class: "home-card", href: wikiHref(e.id) });
          card.appendChild(el("div", { class: "home-card-title", text: e.title || "(sem título)" }));
          card.appendChild(el("div", { class: "home-card-meta", text: e.type || "" }));
          grid.appendChild(card);
        });
        listWrap.appendChild(grid);
      });
    }
    var initialQ = new URLSearchParams(location.search).get("q") || "";
    searchBox.value = initialQ;
    renderList(initialQ);
    searchBox.addEventListener("input", function () { renderList(searchBox.value); });
    page.appendChild(wrap);
  }

  function showMessage(msg) {
    var page = document.getElementById("page");
    page.innerHTML = "";
    page.appendChild(el("div", { class: "empty", text: msg }));
  }

  function wikiCoreBoot() {
    if (typeof firebase === "undefined") { showMessage("Não consegui carregar a conexão com a nuvem."); return; }
    try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) {}
    var fs = firebase.firestore();
    var slug = resolveSlug();
    if (!slug || slug === "_index") {
      fs.collection("wikiPublic").doc("_index").get().then(function (snap) {
        renderHome(snap.exists ? snap.data() : { entries: {} });
      }).catch(function () { showMessage("Não consegui carregar a wiki agora. Tente de novo mais tarde."); });
    } else {
      fs.collection("wikiPublic").doc(slug).get().then(function (snap) {
        if (!snap.exists) { showMessage("Essa página não existe mais (o link pode ter sido despublicado)."); return; }
        renderEntry(snap.data(), slug);
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
