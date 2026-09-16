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
  function homeLabel() { return isParadiseGateMode() ? "🌸 Paradise Gate" : "🌿 Herbário do Multiverso"; }
  function homeHref() { return ROOT + (isParadiseGateMode() ? "wiki.html" : "ursprung.html"); }

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

  function renderEntry(data, wikiId) {
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

    var eyebrowBits = [data.type, data.universe].filter(Boolean);
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
    if (data.cover || shortFields.length || galGroups.length || hasAliases) {
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
      if (hasAliases || shortFields.length) {
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
    var sharedToc = [];
    if (data.posts && data.posts.length) sharedToc.push({ id: "posts", label: "Posts" });
    if (data.gallery && data.gallery.length) sharedToc.push({ id: "galeria", label: "Galeria" });
    if (hasLinks) sharedToc.push({ id: "ligacoes", label: "Ligações" });

    if (data.variants && data.variants.length) {
      var tabsWrap = el("div", { class: "work-tabs" });
      var articles = [buildArticle(data, "geral-", sharedToc)];
      data.variants.forEach(function (variant, vi) { articles.push(buildArticle(variant, "v" + vi + "-", [])); });
      function selectTab(idx) {
        tabsWrap.querySelectorAll(".work-tab").forEach(function (b, i) { b.classList.toggle("on", i === idx); });
        articles.forEach(function (a, i) { a.hidden = i !== idx; });
        currentTabLabel = idx === 0 ? "Geral" : (data.variants[idx - 1].label || "Versão");
      }
      var geralTab = el("button", { type: "button", class: "work-tab on", text: "Geral" });
      geralTab.addEventListener("click", function () { selectTab(0); });
      tabsWrap.appendChild(geralTab);
      data.variants.forEach(function (variant, vi) {
        var tb = el("button", { type: "button", class: "work-tab", text: variant.label || "Versão" });
        tb.addEventListener("click", function () { selectTab(vi + 1); });
        tabsWrap.appendChild(tb);
      });
      card.appendChild(tabsWrap);
      articles.forEach(function (a, i) { a.hidden = i !== 0; card.appendChild(a); });
    } else {
      card.appendChild(buildArticle(data, "geral-", sharedToc));
    }

    // posts — diário datado da própria entrada (mais recente primeiro; já vem ordenado do
    // snapshot). É sobre a entrada inteira, não de uma variante de obra específica, então mora
    // aqui fora do buildArticle, igual Galeria/Ligações.
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
    card.appendChild(el("div", { class: "eyebrow" }, [el("span", { text: "TEMPORADA · " + (data.universe || "") })]));
    card.appendChild(el("h1", { text: data.title || "(sem título)" }));

    var sessions = data.sessions || [];
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
    var header = el("div", { class: "site-header" });
    mountLoginBar(header);
    page.appendChild(header);
    var wrap = el("div", { class: "card" });
    wrap.appendChild(el("div", { class: "home-title", text: homeLabel() }));
    wrap.appendChild(el("div", { class: "home-sub", text: "Wiki pública. Navegue pelas páginas publicadas." }));
    var searchBox = el("input", { class: "home-search", type: "search", placeholder: "Buscar nome, tipo ou tag…", "aria-label": "Buscar" });
    wrap.appendChild(searchBox);

    var entries = Object.keys(indexData.entries || {}).map(function (id) {
      return Object.assign({ id: id }, indexData.entries[id]);
    });

    if (!entries.length) {
      wrap.appendChild(el("div", { class: "empty", text: "Nenhuma página publicada ainda." }));
      page.appendChild(wrap);
      return;
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
        newsGrid.appendChild(el("a", { class: "link-card", href: wikiHref(e.id) }, [
          el("span", { class: "link-card-label", text: (e.updatedAt || "") + (e.type ? " · " + e.type : "") }),
          el("span", { class: "link-card-title", text: e.title || "(sem título)" })
        ]));
      });
      newsSection.appendChild(newsGrid);
      if (recentAll.length > newsShown) {
        var moreBtn = el("button", { class: "home-random", type: "button", style: "margin-top:10px", text: "ver mais novidades" });
        moreBtn.addEventListener("click", function () { newsShown += NEWS_PAGE; paintNews(); });
        newsSection.appendChild(moreBtn);
      }
    }
    paintNews();

    var randomBtn = el("button", { class: "home-random", type: "button", text: "🎲 página aleatória" });
    randomBtn.addEventListener("click", function () {
      var pick = entries[Math.floor(Math.random() * entries.length)];
      location.href = wikiHref(pick.id);
    });
    wrap.appendChild(randomBtn);

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
      var filtered = entries.filter(function (e) {
        return !q || (e.title + " " + e.type + " " + e.universe + " " + (e.tags || []).join(" ") + " " + (e.search || "")).toLowerCase().indexOf(q) !== -1;
      });
      if (!filtered.length) { listWrap.appendChild(el("div", { class: "empty", text: "Nada encontrado." })); return; }
      var byUni = {};
      filtered.forEach(function (e) { var k = e.universe || "Sem universo"; (byUni[k] = byUni[k] || []).push(e); });
      Object.keys(byUni).sort().forEach(function (uni) {
        listWrap.appendChild(el("div", { class: "home-unihead", text: uni }));
        var grid = el("div", { class: "home-grid" });
        byUni[uni].sort(function (a, b) { return (a.title || "").localeCompare(b.title || ""); }).forEach(function (e) {
          var card = el("a", { class: "home-card", href: wikiHref(e.id) });
          card.appendChild(el("div", { class: "home-card-title", text: e.title || "(sem título)" }));
          card.appendChild(el("div", { class: "home-card-meta", text: e.type || "" }));
          var snip = q ? snippetFor(e, q) : null;
          if (snip) card.appendChild(el("div", { class: "home-card-snippet", text: snip }));
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

  // Every universe id tree's own index.html knows about (see FLOWERS there) — the geral wiki's
  // home merges whichever of these the visitor is actually allowed to read (see the Firestore
  // rule on wikiIndex/{universeId}); denied ones just come back empty, no error shown, so an
  // account with access to everything-but-Cravo never even learns Cravo has entries.
  var WB_UNIVERSE_IDS = ["raiz", "rosa", "crisantemo", "girassol", "cravo", "miosotis", "violeta", "lotus"];
  function wikiCoreBoot() {
    if (typeof firebase === "undefined") { showMessage("Não consegui carregar a conexão com a nuvem."); return; }
    try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) {}
    var fs = firebase.firestore();
    var slug = resolveSlug();
    var pgMode = isParadiseGateMode();
    if (!slug || slug === "_index") {
      if (pgMode) {
        fs.collection("wikiIndex").doc("lotus").get().then(function (snap) {
          renderHome(snap.exists ? snap.data() : { entries: {} });
        }).catch(function () { showMessage("Não consegui carregar a wiki agora. Tente de novo mais tarde."); });
      } else {
        Promise.all(WB_UNIVERSE_IDS.map(function (uid) {
          return fs.collection("wikiIndex").doc(uid).get()
            .then(function (snap) { return (snap.exists && snap.data().entries) || {}; })
            .catch(function () { return {}; });
        })).then(function (parts) {
          var merged = {};
          parts.forEach(function (p) { Object.assign(merged, p); });
          renderHome({ entries: merged });
        });
      }
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
