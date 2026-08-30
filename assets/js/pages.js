/* Page renderer — CV-style rows for Writing and Projects.
   Reads the same data files as the live site (projects.data.js, posts.data.js)
   and reuses PortfolioProjectModel for normalization. View layer only. */
(function (root) {
  var OWNER = "sciencemj";
  var doc = root.document;
  var Model = root.PortfolioProjectModel;
  var I18n = root.PortfolioI18n;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character];
    });
  }

  function humanize(name) {
    return String(name || "").split(/[-_]/).filter(Boolean).map(function (word) {
      return /^[A-Z0-9]+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
  }

  /* Page copy lives in i18n.js. Dates stay here because they are formatting
     rather than translation — Korean puts the year first and takes no plural. */
  function lang() { return I18n && I18n.lang() === "ko" ? "ko" : "en"; }
  function label(key, english) { return I18n ? I18n.t(key) : english; }

  var MONTHS = {
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    ko: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
  };

  function monthYear(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length < 2) return "";
    var month = MONTHS[lang()][Number(parts[1]) - 1];
    if (!month) return "";
    return lang() === "ko" ? parts[0] + "년 " + month : month + " " + parts[0];
  }

  var UNITS = {
    en: [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400]],
    ko: [["년", 31536000], ["개월", 2592000], ["주", 604800], ["일", 86400]],
  };

  function relTime(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(diff)) return "";
    var ko = lang() === "ko";
    var units = UNITS[ko ? "ko" : "en"];
    for (var index = 0; index < units.length; index += 1) {
      var value = Math.floor(diff / units[index][1]);
      if (value >= 1) {
        return ko ? value + units[index][0] + " 전"
          : value + " " + units[index][0] + (value > 1 ? "s" : "") + " ago";
      }
    }
    return ko ? "오늘" : "today";
  }

  /* ---------- Writing ---------- */

  function isExternal(url) { return /^https?:\/\//i.test(String(url || "")); }

  /* kind is a fixed enum in posts.data.js, so it is a chrome label rather than
     the author's own words — it translates with the rest of the chrome. */
  var KINDS = { Post: "row.post", Report: "row.report", Talk: "row.talk" };

  function kindLabel(kind) {
    if (!kind) return label("row.post", "Post");
    return KINDS[kind] ? label(KINDS[kind], kind) : kind;
  }

  function renderPost(post) {
    var tags = (post.tags || []).map(function (tag) {
      return '<span class="tag">' + esc(tag) + "</span>";
    }).join("");
    /* Posts live either in posts/ or on another site; only the latter opens
       in a new tab. */
    var target = isExternal(post.url) ? ' target="_blank" rel="noopener"' : "";
    var lang = post.lang === "ko" || post.lang === "en" ? post.lang.toUpperCase() : "";
    return '<li class="row row--dated">' +
      '<span class="row-when">' + esc(monthYear(post.date)) + "</span>" +
      '<div class="row-body">' +
        '<a class="row-title" href="' + esc(post.url) + '"' + target + ">" + esc(post.title) + "</a>" +
        '<div class="row-foot">' +
          '<span class="row-kind">' + esc(kindLabel(post.kind)) + "</span>" +
          (lang ? '<span class="row-kind">' + lang + "</span>" : "") +
          (tags ? '<span class="row-tags">' + tags + "</span>" : "") +
        "</div>" +
      "</div></li>";
  }

  /* data-limit on the list caps how many entries render, so the landing page and
     the full archive page share one renderer. */
  function limitOf(list, items) {
    var limit = Number(list.getAttribute("data-limit"));
    return limit > 0 ? items.slice(0, limit) : items;
  }

  function drawPosts() {
    var list = doc.getElementById("writing-list");
    if (!list) return;
    list.innerHTML = limitOf(list, root.PORTFOLIO_POSTS || []).map(renderPost).join("");
  }

  /* ---------- Projects ---------- */

  function fetchRepo(project) {
    var cacheKey = "gh:" + OWNER + "/" + project.repo;
    try {
      var cached = root.sessionStorage.getItem(cacheKey);
      if (cached) return Promise.resolve(JSON.parse(cached));
    } catch (error) {}
    return root.fetch("https://api.github.com/repos/" + OWNER + "/" + project.repo, {
      headers: { Accept: "application/vnd.github+json" },
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).then(function (data) {
      try { root.sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (error) {}
      return data;
    });
  }

  function reportUrl(project, data) {
    if (!project.report || !data || !data.has_pages) return "";
    return "https://" + OWNER + ".github.io/" + project.repo + "/" + project.report;
  }

  function repoUrl(project, data) {
    return (data && data.html_url) || "https://github.com/" + OWNER + "/" + project.repo;
  }

  function renderThumb(project) {
    var preview = project.preview || {};
    if (!preview.fallback && preview.src) {
      return '<img class="proj-thumb" src="' + esc(preview.src) + '" alt="' + esc(preview.alt) +
        '" width="1280" height="800" loading="lazy">';
    }
    return '<span class="proj-thumb proj-thumb--none" aria-hidden="true">' +
      esc((preview.kind || "repo").slice(0, 1).toUpperCase() + (preview.kind || "repo").slice(1)) + "</span>";
  }

  function renderProject(project, data) {
    var title = humanize(project.repo);
    var report = reportUrl(project, data);
    var code = repoUrl(project, data);
    var description = project.highlight || (data && data.description) || "";
    var meta = [];
    if (data && data.language) meta.push(esc(data.language));
    if (data && data.pushed_at) {
      var updated = esc(relTime(data.pushed_at));
      meta.push(lang() === "ko" ? updated + " 업데이트" : "updated " + updated);
    }

    var links = "";
    if (report) links += '<a href="' + esc(report) + '">' + esc(label("row.report", "Report")) + "</a>";
    links += '<a href="' + esc(code) + '" target="_blank" rel="noopener">' +
      esc(label("row.code", "Code")) + "</a>";

    return '<li class="row row--proj">' +
      '<a class="proj-thumb-link" href="' + esc(report || code) + '"' + (report ? "" : ' target="_blank" rel="noopener"') +
        ' tabindex="-1" aria-hidden="true">' + renderThumb(project) + "</a>" +
      '<div class="row-body">' +
        '<a class="row-title" href="' + esc(report || code) + '"' + (report ? "" : ' target="_blank" rel="noopener"') + ">" +
          esc(title) + "</a>" +
        (description ? '<p class="row-desc">' + esc(description) + "</p>" : "") +
        '<div class="row-foot">' +
          (meta.length ? '<span class="row-meta">' + meta.join(" · ") + "</span>" : "") +
          '<span class="row-links">' + links + "</span>" +
        "</div>" +
      "</div></li>";
  }

  function drawProjects() {
    var list = doc.getElementById("projects-list");
    if (!list || !Model) return;
    /* Featured first, then the curated order; the landing page's data-limit
       shows the top slice of this order. */
    var projects = limitOf(list, (root.PORTFOLIO_PROJECTS || []).map(Model.normalizeProject).sort(function (a, b) {
      return (b.featured === true) - (a.featured === true);
    }));

    function paint(results) {
      list.innerHTML = projects.map(function (project, index) {
        return renderProject(project, (results || [])[index] || null);
      }).join("");
    }

    paint([]);
    Promise.all(projects.map(function (project) {
      return fetchRepo(project).then(function (data) { return data; }, function () { return null; });
    })).then(function (results) {
      paint(results);
      list.setAttribute("aria-busy", "false");
    });
  }

  /* ---------- Nav ambient glow ---------- */

  /* Writes the pointer position onto the nav as CSS custom properties; the glow
     itself is a ::after gradient in pages.css. Pointer-driven only — skipped
     where there is no hover, so touch devices never paint it. */
  function wireNavGlow() {
    var nav = doc.querySelector(".nav");
    if (!nav || !root.matchMedia || !root.matchMedia("(hover: hover)").matches) return;
    var queued = false, x = 0, y = 0;
    nav.addEventListener("pointermove", function (event) {
      var box = nav.getBoundingClientRect();
      x = event.clientX - box.left;
      y = event.clientY - box.top;
      if (queued) return;
      queued = true;
      root.requestAnimationFrame(function () {
        queued = false;
        nav.style.setProperty("--glow-x", x + "px");
        nav.style.setProperty("--glow-y", y + "px");
      });
    });
  }

  function init() {
    drawPosts();
    drawProjects();
    /* The rows carry no data-i18n of their own — they are rebuilt from scratch
       whenever the reader flips the language. */
    if (I18n) I18n.onChange(function () { drawPosts(); drawProjects(); });
    wireNavGlow();
    var year = doc.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
