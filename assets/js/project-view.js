(function (root, factory) {
  var Model = typeof module === "object" && module.exports
    ? require("./project-model.js")
    : root && root.PortfolioProjectModel;
  var api = factory(Model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PortfolioProjectView = api;
})(typeof window !== "undefined" ? window : null, function (Model) {
  var OWNER = "sciencemj";
  var ACRONYMS = { nlp: "NLP", ml: "ML", ai: "AI", eda: "EDA", api: "API", llm: "LLM", umap: "UMAP", cv: "CV", sql: "SQL", ocr: "OCR" };

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

  function prettyTag(topic) {
    return String(topic).split("-").map(function (word) {
      return ACRONYMS[word.toLowerCase()] || (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(" ");
  }

  function tagsFor(data) {
    var tags = [], seen = {};
    ((data && data.topics) || []).forEach(function (topic) {
      var tag = prettyTag(topic), key = tag.toLowerCase();
      if (key && !seen[key]) { seen[key] = true; tags.push(tag); }
    });
    return tags.slice(0, 2);
  }

  function relTime(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(diff)) return "";
    var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var index = 0; index < units.length; index += 1) {
      var value = Math.floor(diff / units[index][1]);
      if (value >= 1) return value + " " + units[index][0] + (value > 1 ? "s" : "") + " ago";
    }
    return "just now";
  }

  function linkFor(project, data) {
    if (project.report && data && data.has_pages) {
      return "https://" + OWNER + ".github.io/" + project.repo + "/" + project.report;
    }
    if (data && data.homepage && /^https?:\/\//i.test(data.homepage)) return data.homepage;
    return data && data.html_url ? data.html_url : "https://github.com/" + OWNER + "/" + project.repo;
  }

  function renderPreview(project, title, lazy) {
    var preview = project.preview || { kind: "workflow", fallback: true };
    if (!preview.fallback && preview.src) {
      return '<figure class="pc-preview pc-preview--' + esc(preview.kind) + '"><img src="' + esc(preview.src) + '" alt="' + esc(preview.alt) + '" width="1280" height="800"' + (lazy ? ' loading="lazy"' : "") + '><span class="preview-kind">' + esc(preview.kind) + "</span></figure>";
    }
    if (preview.kind === "terminal") return '<div class="pc-preview pc-preview--fallback preview-terminal" aria-hidden="true"><span>$ whisper-transcribe ./interview.wav</span><span>detecting language...</span><span class="ok">transcript ready</span></div>';
    if (preview.kind === "app") return '<div class="pc-preview pc-preview--fallback preview-app" aria-hidden="true"><span class="app-sidebar"></span><span class="app-row wide"></span><span class="app-row"></span><span class="app-row short"></span></div>';
    return '<div class="pc-preview pc-preview--fallback preview-workflow" aria-hidden="true"><span>Raw</span><i></i><span>Reframe</span><i></i><span>Ship</span></div>';
  }

  function renderCard(project, data, variant, index) {
    var classes = "project-card project-card--" + variant;
    var categories = project.categories.join("|");
    var description = project.highlight || (data && data.description) || "Open the project repository on GitHub.";
    var title = humanize(project.repo);
    var hasReport = !!(project.report && data && data.has_pages);
    var status = hasReport
      ? '<span class="pc-status live">Report</span>'
      : '<span class="pc-status code">Code</span>';
    var statusText = hasReport ? "report available" : "view code";
    var tags = tagsFor(data).map(function (tag) {
      return '<span class="tag">' + esc(tag) + "</span>";
    }).join("");
    var meta = [];
    if (data && data.language) meta.push('<span class="pc-lang"><i class="dot"></i>' + esc(data.language) + "</span>");
    if (data && data.pushed_at) meta.push('<span class="pc-updated">Updated ' + esc(relTime(data.pushed_at)) + "</span>");
    var href = linkFor(project, data);
    var external = hasReport ? "" : ' target="_blank" rel="noopener"';

    return '<a class="' + classes + '" href="' + esc(href) + '"' + external +
      ' data-categories="' + esc(categories) + '" data-project-index="' + index +
      '" aria-label="' + esc(title + " — " + statusText) + '">' +
      renderPreview(project, title, variant !== "lead") +
      '<div class="pc-body">' +
        '<div class="pc-titlerow"><h3 class="pc-title">' + esc(title) + "</h3>" + status + "</div>" +
        '<p class="pc-desc">' + esc(description) + "</p>" +
        '<div class="pc-row">' +
          (tags ? '<div class="pc-tags">' + tags + "</div>" : "") +
          '<div class="pc-meta">' + meta.join('<span class="pc-sep">·</span>') + '<span class="pc-arrow">→</span></div>' +
        "</div>" +
      "</div></a>";
  }

  function renderProjectSections(projects, githubData) {
    var normalized = (projects || []).map(function (project) { return Model.normalizeProject(project); });
    var split = Model.splitProjects(normalized);
    var byRepo = {};
    normalized.forEach(function (project, index) { byRepo[project.repo] = (githubData || [])[index] || null; });
    function indexFor(project) {
      for (var index = 0; index < normalized.length; index += 1) {
        if (normalized[index].repo === project.repo) return index;
      }
      return -1;
    }
    var lead = split.featured.slice(0, 1).map(function (project) {
      return renderCard(project, byRepo[project.repo], "lead", indexFor(project));
    }).join("");
    var pair = split.featured.slice(1).map(function (project) {
      return renderCard(project, byRepo[project.repo], "featured", indexFor(project));
    }).join("");
    var compact = split.compact.map(function (project) {
      return renderCard(project, byRepo[project.repo], "compact", indexFor(project));
    }).join("");
    return '<div class="featured-projects">' + lead + '<div class="featured-projects__pair">' + pair + "</div></div>" +
      '<div class="compact-projects">' + compact + "</div>";
  }

  function renderFilters(active) {
    active = active || [];
    var any = active.length > 0;
    return '<button type="button" class="filter-chip' + (any ? "" : " active") + '" data-all="1" aria-pressed="' + (!any) + '">All</button>' +
      Model.CATEGORIES.map(function (category) {
        var selected = active.indexOf(category.key) > -1;
        return '<button type="button" class="filter-chip' + (selected ? " active" : "") + '" data-category="' + esc(category.key) + '" aria-pressed="' + selected + '">' + esc(category.label) + "</button>";
      }).join("");
  }

  return {
    renderPreview: renderPreview,
    renderCard: renderCard,
    renderProjectSections: renderProjectSections,
    renderFilters: renderFilters,
  };
});
