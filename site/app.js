(function () {
  "use strict";

  var data = window.CPM_DATA;
  var providers = data.providers;
  var providerIds = providers.map(function (p) { return p.id; });

  var els = {
    subtitle: document.getElementById("subtitle"),
    providers: document.getElementById("providers"),
    legend: document.getElementById("legend"),
    search: document.getElementById("search"),
    matrix: document.getElementById("matrix"),
    crosswalk: document.getElementById("crosswalk"),
    viewbar: document.getElementById("viewbar"),
    tabs: document.getElementById("tabs"),
    statusFilters: document.getElementById("status-filters"),
    empty: document.getElementById("empty"),
    themeToggle: document.getElementById("theme-toggle"),
  };

  // ------------------------------------------------------------------ state

  function readStoredProviders() {
    try {
      var v = localStorage.getItem("cpm-providers");
      return v ? v.split(",") : null;
    } catch (e) { return null; }
  }

  var params = new URLSearchParams(location.search);
  var fromUrl = params.get("providers");
  var initial = (fromUrl ? fromUrl.split(",") : readStoredProviders()) || providerIds;
  var excludedFromUrl = (params.get("exclude") || "").split(",");

  var state = {
    visible: new Set(initial.filter(function (id) {
      return providerIds.indexOf(id) !== -1 && excludedFromUrl.indexOf(id) === -1;
    })),
    query: params.get("q") || "",
    view: params.get("view") || "matrix",
    statuses: new Set((params.get("status") || "").split(",").filter(Boolean)),
  };
  var crosswalks = data.crosswalks || [];
  if (state.visible.size === 0) providerIds.forEach(function (id) { state.visible.add(id); });

  function persist() {
    var visible = providerIds.filter(function (id) { return state.visible.has(id); });
    try { localStorage.setItem("cpm-providers", visible.join(",")); } catch (e) {}
    var p = new URLSearchParams(location.search);
    p.delete("exclude");
    if (visible.length === providerIds.length) p.delete("providers"); else p.set("providers", visible.join(","));
    if (state.query) p.set("q", state.query); else p.delete("q");
    if (state.view !== "matrix") p.set("view", state.view); else p.delete("view");
    if (state.statuses.size) p.set("status", Array.from(state.statuses).join(",")); else p.delete("status");
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  // ------------------------------------------------------------------ helpers

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k === "style") node.setAttribute("style", attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function count(providerId) {
    var m = data.mapping[providerId] || {};
    return Object.keys(m).reduce(function (n, k) { return n + m[k].length; }, 0);
  }

  function icon(provider, item) {
    var key = provider.iconBase && item.icon ? provider.iconBase + item.icon : null;
    var wrap = el("span", { class: "product__icon", "aria-hidden": "true" });
    if (key && data.icons[key]) {
      wrap.appendChild(el("img", { src: data.icons[key], alt: "" }));
    } else {
      wrap.classList.add("product__icon--dot");
    }
    return wrap;
  }

  function matches(text, q) {
    return text.toLowerCase().indexOf(q) !== -1;
  }

  function productItem(provider, item) {
    var kind = item.status || item.source;
    var name = item.url
      ? el("a", { href: item.url, class: "product__name", rel: "noopener", target: "_blank" })
      : el("span", { class: "product__name" });
    name.textContent = item.name;
    return el("li", { class: "product" + (kind ? " product--" + kind : "") }, [
      icon(provider, item),
      name,
      kind && data.badges[kind] ? el("span", { class: "badge badge--" + kind, text: data.badges[kind] }) : null,
    ]);
  }

  function providerById(id) {
    return providers.filter(function (p) { return p.id === id; })[0];
  }

  // ------------------------------------------------------------------ static chrome

  function renderSubtitle() {
    var names = providers.filter(function (p) { return state.visible.has(p.id); })
      .map(function (p) { return p.name; });
    els.subtitle.textContent = names.join(" vs ");
    document.title = "Cloud Product Mapping — " + names.join(" vs ");
  }

  function renderProviderToggles() {
    providers.forEach(function (p) {
      var input = el("input", { type: "checkbox", value: p.id, id: "provider-" + p.id });
      input.checked = state.visible.has(p.id);
      input.addEventListener("change", function () {
        if (input.checked) state.visible.add(p.id);
        else if (state.visible.size > 1) state.visible.delete(p.id);
        else { input.checked = true; return; } // keep at least one provider
        persist();
        render();
      });
      var label = el("label", {
        class: "chip",
        for: "provider-" + p.id,
        title: p.fullName,
        style: "--provider:" + p.color,
      }, [
        input,
        el("span", { class: "chip__dot", "aria-hidden": "true" }),
        el("span", { class: "chip__name", text: p.name }),
        el("span", { class: "chip__count", text: String(count(p.id)) }),
      ]);
      els.providers.appendChild(label);
    });
  }

  function renderLegend() {
    Object.keys(data.badges).forEach(function (kind) {
      els.legend.appendChild(el("span", { class: "badge badge--" + kind, text: data.badges[kind] }));
    });
  }

  // ------------------------------------------------------------------ matrix

  function activeCrosswalk() {
    var id = state.view.indexOf("crosswalk:") === 0 ? state.view.slice(10) : null;
    return crosswalks.filter(function (cw) {
      return cw.from + "-" + cw.to === id && state.visible.has(cw.from) && state.visible.has(cw.to);
    })[0] || null;
  }

  function renderTabs() {
    var available = crosswalks.filter(function (cw) { return state.visible.has(cw.from) && state.visible.has(cw.to); });
    els.viewbar.hidden = available.length === 0;
    if (!activeCrosswalk()) state.view = "matrix";
    els.tabs.textContent = "";
    var tabs = [{ id: "matrix", label: "By category" }].concat(available.map(function (cw) {
      return { id: "crosswalk:" + cw.from + "-" + cw.to, label: providerById(cw.from).name + " → " + providerById(cw.to).name + " crosswalk" };
    }));
    tabs.forEach(function (tab) {
      var button = el("button", {
        type: "button", role: "tab", class: "tab", "aria-selected": String(state.view === tab.id), text: tab.label,
      });
      button.addEventListener("click", function () {
        state.view = tab.id;
        persist();
        render();
      });
      els.tabs.appendChild(button);
    });
  }

  function crosswalkRowMatches(cw, row, q) {
    if (!q) return true;
    var names = row[cw.to].map(function (i) { return i.name; });
    return [row.category, row.service, row.note || ""].concat(names).some(function (s) { return matches(s, q); });
  }

  function renderCrosswalk(cw) {
    var q = state.query.trim().toLowerCase();
    var src = providerById(cw.from), dst = providerById(cw.to);
    var searched = cw.rows.filter(function (r) { return crosswalkRowMatches(cw, r, q); });

    // Status filter chips with counts for the current search.
    els.statusFilters.hidden = false;
    els.statusFilters.textContent = "";
    Object.keys(data.crosswalkStatus).forEach(function (status) {
      var n = searched.filter(function (r) { return r.status === status; }).length;
      var input = el("input", { type: "checkbox", value: status, id: "status-" + status });
      input.checked = state.statuses.has(status);
      input.addEventListener("change", function () {
        if (input.checked) state.statuses.add(status); else state.statuses.delete(status);
        persist();
        render();
      });
      els.statusFilters.appendChild(el("label", { class: "status-chip status-chip--" + status, for: "status-" + status }, [
        input,
        el("span", { class: "status-dot", "aria-hidden": "true" }),
        el("span", { text: data.crosswalkStatus[status] }),
        el("span", { class: "chip__count", text: String(n) }),
      ]));
    });

    var rows = searched.filter(function (r) { return !state.statuses.size || state.statuses.has(r.status); });
    els.crosswalk.textContent = "";
    els.crosswalk.setAttribute("aria-label", src.name + " to " + dst.name + " crosswalk");
    var head = el("div", { class: "crosswalk__row crosswalk__row--head", role: "row" });
    ["Category", src.name + " service", dst.name, "Status", "Notes"].forEach(function (label) {
      head.appendChild(el("div", { class: "crosswalk__cell", role: "columnheader", text: label }));
    });
    els.crosswalk.appendChild(head);

    rows.forEach(function (r) {
      var list = el("ul", { class: "products" });
      r[cw.to].forEach(function (item) { list.appendChild(productItem(dst, item)); });
      els.crosswalk.appendChild(el("div", { class: "crosswalk__row", role: "row" }, [
        el("div", { class: "crosswalk__cell crosswalk__cell--category", role: "cell", text: r.category }),
        el("div", { class: "crosswalk__cell crosswalk__cell--service", role: "cell", style: "--provider:" + src.color }, [
          el("a", { href: r.url, rel: "noopener", target: "_blank", text: r.service }),
        ]),
        el("div", { class: "crosswalk__cell", role: "cell", style: "--provider:" + dst.color }, [
          r[cw.to].length ? list : el("span", { class: "none", text: "—" }),
        ]),
        el("div", { class: "crosswalk__cell", role: "cell" }, [
          el("span", { class: "status status--" + r.status }, [
            el("span", { class: "status-dot", "aria-hidden": "true" }),
            el("span", { text: data.crosswalkStatus[r.status] }),
          ]),
        ]),
        el("div", { class: "crosswalk__cell crosswalk__cell--note", role: "cell", text: r.note || "" }),
      ]));
    });
    return rows.length;
  }

  function render() {
    renderSubtitle();
    renderTabs();
    var cw = activeCrosswalk();
    els.matrix.hidden = !!cw;
    els.crosswalk.hidden = !cw;
    els.statusFilters.hidden = !cw;
    if (cw) {
      els.empty.hidden = renderCrosswalk(cw) > 0;
      return;
    }
    renderMatrix();
  }

  function renderMatrix() {
    var visible = providers.filter(function (p) { return state.visible.has(p.id); });
    var q = state.query.trim().toLowerCase();

    els.matrix.style.setProperty("--columns", visible.length);
    els.matrix.textContent = "";

    var head = el("div", { class: "matrix__row matrix__row--head", role: "row" }, [
      el("div", { class: "matrix__cell matrix__cell--category", role: "columnheader", text: "Category" }),
    ]);
    visible.forEach(function (p) {
      head.appendChild(el("div", {
        class: "matrix__cell matrix__cell--provider", role: "columnheader", style: "--provider:" + p.color,
      }, [
        el("a", { href: p.homepage, class: "provider-head", rel: "noopener" }, [
          el("span", { class: "chip__dot", "aria-hidden": "true" }),
          el("span", { text: p.name }),
        ]),
      ]));
    });
    els.matrix.appendChild(head);

    var shown = 0;
    data.categories.forEach(function (cat) {
      var categoryHit = q && matches(cat.name, q);
      var cells = visible.map(function (p) {
        var items = (data.mapping[p.id] || {})[cat.id] || [];
        if (q && !categoryHit) {
          items = items.filter(function (i) { return matches(i.name, q); });
        }
        return { provider: p, items: items };
      });
      // Hide categories where no visible provider has a (matching) product.
      if (!cells.some(function (c) { return c.items.length; })) return;
      shown++;

      var row = el("div", { class: "matrix__row", role: "row" }, [
        el("div", { class: "matrix__cell matrix__cell--category", role: "rowheader", text: cat.name }),
      ]);
      cells.forEach(function (c) {
        var cell = el("div", {
          class: "matrix__cell" + (c.items.length ? "" : " matrix__cell--none"),
          role: "cell",
          style: "--provider:" + c.provider.color,
          "data-provider": c.provider.name,
        });
        if (!c.items.length) {
          cell.appendChild(el("span", { class: "none", text: "—", "aria-label": "No equivalent" }));
        }
        var list = el("ul", { class: "products" });
        c.items.forEach(function (item) { list.appendChild(productItem(c.provider, item)); });
        if (c.items.length) cell.appendChild(list);
        row.appendChild(cell);
      });
      els.matrix.appendChild(row);
    });

    els.empty.hidden = shown > 0;
  }

  // ------------------------------------------------------------------ theme

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("cpm-theme", theme); } catch (e) {}
  }

  els.themeToggle.addEventListener("click", function () {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  // ------------------------------------------------------------------ init

  els.search.value = state.query;
  var searchTimer;
  els.search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = els.search.value;
      persist();
      render();
    }, 80);
  });

  // Keep the matrix header pinned just below the sticky top bar.
  var topbar = document.querySelector(".topbar");
  function syncTopbarHeight() {
    document.documentElement.style.setProperty("--topbar-height", topbar.offsetHeight + "px");
  }
  if (window.ResizeObserver) new ResizeObserver(syncTopbarHeight).observe(topbar);
  syncTopbarHeight();

  renderProviderToggles();
  renderLegend();
  render();
})();
