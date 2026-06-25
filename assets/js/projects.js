/* Project preview cards — pulls live repo metadata from the GitHub REST API
   so cards reflect repo changes automatically. No build, no auth.
   Configure which repos appear (and their report link) in PROJECTS below. */
(function () {
  var OWNER = 'sciencemj';

  // Local config: which repos to feature + per-repo report link.
  //   report: a path under the repo's GitHub Pages site (used only if has_pages).
  // `tags` are merged with the repo's live GitHub topics (deduped) — they seed
  // the filter and card chips, and any topics you add on GitHub flow in too.
  var PROJECTS = [
    { repo: 'seoul-bike-analysis', report: 'report.html', tags: ['Data analysis', 'Forecasting', 'Geospatial'] },
    { repo: 'LCC_Review_Sentiment_Cluster', tags: ['NLP', 'Clustering', 'Sentiment'] }
  ];

  // Cover gradient pairs (natural viz palette), cycled per card.
  var COVERS = [
    ['#F6BE91', '#E8682B'],
    ['#A7C4A0', '#4E8A7E'],
    ['#E7C77B', '#C2613F'],
    ['#9FB0CC', '#5E6E8A']
  ];

  var grid = document.getElementById('project-grid');
  if (!grid) return;
  var filterBar = document.getElementById('project-filter');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function humanize(name) {
    return name.split(/[-_]/).filter(Boolean).map(function (w) {
      return /^[A-Z0-9]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // Merge live GitHub topics with configured tags, deduped case-insensitively.
  function tagsFor(p, data) {
    var out = [], seen = {};
    var src = ((data && data.topics) || []).concat(p.tags || []);
    src.forEach(function (t) {
      var k = String(t).toLowerCase();
      if (k && !seen[k]) { seen[k] = 1; out.push(t); }
    });
    return out;
  }

  function relTime(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(diff)) return '';
    var units = [['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (var i = 0; i < units.length; i++) {
      var v = Math.floor(diff / units[i][1]);
      if (v >= 1) return v + ' ' + units[i][0] + (v > 1 ? 's' : '') + ' ago';
    }
    return 'just now';
  }

  function bars() {
    var h = [45, 70, 55, 90, 78, 100, 62], out = '';
    for (var i = 0; i < h.length; i++) {
      var ht = h[i] * 0.6;
      out += '<rect x="' + (8 + i * 16) + '" y="' + (70 - ht).toFixed(1) +
        '" width="10" height="' + ht.toFixed(1) + '" rx="2" fill="rgba(255,255,255,' +
        (0.45 + 0.06 * i).toFixed(2) + ')"/>';
    }
    return out;
  }

  function fetchRepo(p) {
    var ck = 'gh:' + OWNER + '/' + p.repo;
    try {
      var cached = sessionStorage.getItem(ck);
      if (cached) return Promise.resolve(JSON.parse(cached));
    } catch (e) {}
    return fetch('https://api.github.com/repos/' + OWNER + '/' + p.repo,
      { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        try { sessionStorage.setItem(ck, JSON.stringify(data)); } catch (e) {}
        return data;
      });
  }

  function linkFor(p, data) {
    if (p.report && data && data.has_pages) {
      return 'https://' + OWNER + '.github.io/' + p.repo + '/' + p.report;
    }
    // Only trust homepage if it's an absolute http(s) URL — a scheme-less value
    // resolves as a relative link, and javascript:/data: would be an href sink.
    if (data && data.homepage && /^https?:\/\//i.test(data.homepage)) return data.homepage;
    return data && data.html_url ? data.html_url
      : 'https://github.com/' + OWNER + '/' + p.repo;
  }

  function card(p, data, i) {
    var cov = COVERS[i % COVERS.length];
    var title = humanize(p.repo);
    var hasReport = !!(p.report && data && data.has_pages);
    var status = hasReport
      ? '<span class="pc-status live">Report</span>'
      : '<span class="pc-status soon">Code · report soon</span>';
    var desc = data && data.description ? esc(data.description)
      : 'Open the project repository on GitHub.';
    var tagList = tagsFor(p, data);
    var topics = tagList.slice(0, 6).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    var dataTags = tagList.map(function (t) { return t.toLowerCase(); }).join('|');
    var lang = data && data.language
      ? '<span class="pc-lang"><i class="dot"></i>' + esc(data.language) + '</span>' : '';
    var updated = data && data.pushed_at
      ? '<span class="pc-updated mono">Updated ' + relTime(data.pushed_at) + '</span>' : '';
    var yr = data && data.pushed_at ? new Date(data.pushed_at).getFullYear() : '';
    var link = linkFor(p, data);
    var external = hasReport ? '' : ' target="_blank" rel="noopener"';
    var statusText = hasReport ? 'report available' : 'code, report soon';

    return '<a class="project-card" href="' + esc(link) + '"' + external +
      ' data-tags="' + esc(dataTags) + '"' +
      ' aria-label="' + esc(title + ' — ' + statusText) + '">' +
      '<div class="pc-cover" style="--c1:' + cov[0] + ';--c2:' + cov[1] + '">' +
        '<svg class="pc-bars" viewBox="0 0 120 70" aria-hidden="true">' + bars() + '</svg>' +
        (yr ? '<span class="pc-year mono">' + yr + '</span>' : '') +
      '</div>' +
      '<div class="pc-body">' +
        '<div class="pc-titlerow"><h3 class="pc-title">' + esc(title) + '</h3>' + status + '</div>' +
        '<p class="pc-desc">' + desc + '</p>' +
        (topics ? '<div class="pc-tags">' + topics + '</div>' : '') +
        '<div class="pc-meta">' + lang + updated + '<span class="pc-arrow">→</span></div>' +
      '</div></a>';
  }

  function skeletons() {
    grid.innerHTML = PROJECTS.map(function () {
      return '<div class="project-card skeleton"><div class="pc-cover"></div>' +
        '<div class="pc-body"><div class="sk-line w60"></div><div class="sk-line w90"></div>' +
        '<div class="sk-line w40"></div></div></div>';
    }).join('');
  }

  // Build the tag filter from the union of all cards' tags. Hidden if < 2 tags.
  function buildFilter(perCardTags) {
    if (!filterBar) return;
    var seen = {}, tags = [];
    perCardTags.forEach(function (arr) {
      arr.forEach(function (t) { var k = t.toLowerCase(); if (!seen[k]) { seen[k] = 1; tags.push(t); } });
    });
    if (tags.length < 2) { filterBar.hidden = true; return; }

    var active = {};
    function draw() {
      var any = Object.keys(active).length > 0;
      filterBar.innerHTML =
        '<button type="button" class="filter-chip' + (any ? '' : ' active') + '" data-all="1" aria-pressed="' + (!any) + '">All</button>' +
        tags.map(function (t) {
          var k = t.toLowerCase(), on = !!active[k];
          return '<button type="button" class="filter-chip' + (on ? ' active' : '') + '" data-tag="' + esc(k) + '" aria-pressed="' + on + '">' + esc(t) + '</button>';
        }).join('');
    }
    function apply() {
      var keys = Object.keys(active);
      [].slice.call(grid.querySelectorAll('.project-card')).forEach(function (c) {
        if (keys.length === 0) { c.style.display = ''; return; }
        var ctags = (c.getAttribute('data-tags') || '').split('|');
        var show = keys.some(function (k) { return ctags.indexOf(k) > -1; });
        c.style.display = show ? '' : 'none';
      });
    }
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-chip');
      if (!btn) return;
      if (btn.getAttribute('data-all')) active = {};
      else { var k = btn.getAttribute('data-tag'); if (active[k]) delete active[k]; else active[k] = 1; }
      draw(); apply();
    });
    filterBar.hidden = false;
    draw();
  }

  function render() {
    skeletons();
    Promise.all(PROJECTS.map(function (p) {
      return fetchRepo(p).then(function (d) { return d; }, function () { return null; });
    })).then(function (results) {
      grid.innerHTML = PROJECTS.map(function (p, i) { return card(p, results[i], i); }).join('');
      grid.setAttribute('aria-busy', 'false');
      buildFilter(PROJECTS.map(function (p, i) { return tagsFor(p, results[i]); }));
    });
  }

  render();
})();
