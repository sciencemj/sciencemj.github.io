(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminEditorView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CATEGORY_LABELS = {
    "data-analysis": "Data analysis",
    "ml-nlp": "ML & NLP",
    "visualization": "Visualization",
    "developer-tools": "Developer tools",
    "apps": "Apps"
  };
  var KIND_LABELS = {
    image: "IMAGE PREVIEW",
    chart: "CHART PREVIEW",
    app: "APP PREVIEW",
    terminal: "TERMINAL PREVIEW",
    workflow: "WORKFLOW PREVIEW"
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function humanize(value) {
    return String(value || "Untitled project")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function imageSource(project, upload) {
    if (upload && upload.url) return upload.url;
    var src = project && project.preview && project.preview.src;
    return src ? "/" + src.replace(/^\//, "") : "";
  }

  function previewVisual(project, upload, compact) {
    var preview = project.preview || { kind: "workflow" };
    var src = imageSource(project, upload);
    if (src) {
      return '<img src="' + esc(src) + '" alt="' + esc(preview.alt || "") + '">';
    }
    var kind = preview.kind || "workflow";
    if (compact) return '<span class="mini-fallback">' + esc(kind.slice(0, 2).toUpperCase()) + '</span>';
    if (kind === "terminal") {
      return '<div class="fallback terminal-fallback"><span>$ analyze --portfolio</span><span>✓ signal extracted</span><span>▌</span></div>';
    }
    if (kind === "app") {
      return '<div class="fallback app-fallback"><span></span><span></span><span></span><strong>Live interface</strong></div>';
    }
    return '<div class="fallback workflow-fallback"><i></i><b></b><i></i><b></b><i></i></div>';
  }

  function renderList(projects, options) {
    options = options || {};
    var query = String(options.query || "").trim().toLowerCase();
    var uploads = options.uploads instanceof Map ? options.uploads : new Map();
    var rows = [];
    (projects || []).forEach(function (project, index) {
      if (query && String(project.repo || "").toLowerCase().indexOf(query) === -1) return;
      var selected = index === options.selectedIndex;
      var invalid = options.errors && options.errors[index];
      var dirty = options.dirtyIndexes && options.dirtyIndexes.indexOf(index) > -1;
      rows.push(
        '<article class="project-row' + (selected ? " is-selected" : "") + (invalid ? " is-invalid" : "") + '" data-project-index="' + index + '" draggable="true"' + (selected ? ' aria-current="true"' : "") + '>' +
          '<button class="project-select" type="button" data-action="select-project" aria-label="Edit ' + esc(project.repo) + '">' +
            '<span class="project-thumb">' + previewVisual(project, uploads.get(project.repo), true) + '</span>' +
            '<span class="project-row-copy"><strong>' + esc(project.repo) + '</strong><small>' +
              (project.featured ? '<span class="featured-mark">Featured</span>' : "Not featured") +
              (dirty ? '<span class="row-state">Edited</span>' : "") +
              (invalid ? '<span class="row-error">Needs attention</span>' : "") +
            '</small></span>' +
          '</button>' +
          '<span class="row-order"><button type="button" data-action="move-up" aria-label="Move ' + esc(project.repo) + ' up" title="Move up"' + (index === 0 ? " disabled" : "") + '>↑</button>' +
          '<button type="button" data-action="move-down" aria-label="Move ' + esc(project.repo) + ' down" title="Move down"' + (index === projects.length - 1 ? " disabled" : "") + '>↓</button></span>' +
        '</article>'
      );
    });
    if (!rows.length) return '<div class="empty-state">No projects match this search.</div>';
    return rows.join("");
  }

  function errorMarkup(errors, key) {
    if (!errors || !errors[key]) return "";
    return '<p class="field-error" id="error-' + esc(key.replace(/\./g, "-")) + '">' + esc(errors[key]) + '</p>';
  }

  function describedBy(errors, key) {
    return errors && errors[key] ? ' aria-describedby="error-' + esc(key.replace(/\./g, "-")) + '" aria-invalid="true"' : "";
  }

  function renderCardPreview(project, upload) {
    project = project || {};
    var categories = (project.categories || []).map(function (key) {
      return '<span>' + esc(CATEGORY_LABELS[key] || key) + '</span>';
    }).join("");
    var kind = project.preview && project.preview.kind || "workflow";
    return '<article class="portfolio-proof">' +
      '<div class="proof-visual">' + previewVisual(project, upload, false) + '<span class="proof-kind">' + esc(KIND_LABELS[kind] || KIND_LABELS.workflow) + '</span></div>' +
      '<div class="proof-copy"><div class="proof-categories">' + categories + '</div><h3>' + esc(humanize(project.repo)) + '</h3>' +
      '<p>' + esc(project.highlight || "Add a concrete outcome to explain why this project matters.") + '</p></div>' +
    '</article>';
  }

  function renderInspector(project, options) {
    options = options || {};
    if (!project) return '<div class="empty-state inspector-empty">Select a project to edit it.</div>';
    var preview = project.preview || { kind: "workflow" };
    var errors = options.errors || {};
    var mode = options.sourceMode === "existing" ? "existing" : "upload";
    var categories = Object.keys(CATEGORY_LABELS).map(function (key) {
      var checked = (project.categories || []).indexOf(key) > -1;
      return '<label class="check-chip"><input type="checkbox" data-category="' + key + '"' + (checked ? " checked" : "") + '><span>' + esc(CATEGORY_LABELS[key]) + '</span></label>';
    }).join("");
    var kinds = Object.keys(KIND_LABELS).map(function (kind) {
      return '<option value="' + kind + '"' + (preview.kind === kind ? " selected" : "") + '>' + esc(kind) + '</option>';
    }).join("");
    var assets = (options.assets || []).map(function (asset) {
      return '<option value="' + esc(asset.path) + '">' + esc(asset.width + "×" + asset.height + " · " + (asset.size / 1024).toFixed(1) + "KB") + '</option>';
    }).join("");
    var upload = options.upload;
    var metrics = upload
      ? '<div class="asset-metrics"><span>' + upload.width + ' × ' + upload.height + '</span><span>' + (upload.size / 1024).toFixed(1) + ' KB</span><span class="mono">' + esc(upload.target) + '</span></div>'
      : '<p class="field-note">PNG, JPEG, or WebP. Center-cropped to 1280 × 800 WebP, max 180KB.</p>';

    return '<div class="inspector-stack">' +
      '<section class="proof-section" aria-labelledby="proof-title"><div class="section-kicker"><span>LIVE PROOF</span><span>16:10 / PUBLIC CARD</span></div>' +
      '<h2 id="proof-title" class="sr-only">Live project card preview</h2>' + renderCardPreview(project, upload) + '</section>' +
      '<section class="form-section" aria-labelledby="details-title"><div class="section-heading"><div><span class="eyebrow">PROJECT ' + String((options.index || 0) + 1).padStart(2, "0") + '</span><h2 id="details-title">' + esc(project.repo) + '</h2></div>' +
      '<label class="featured-toggle"><input type="checkbox" data-field="featured"' + (project.featured ? " checked" : "") + '><span>Featured</span></label></div>' +
      (errors.featured ? '<p class="section-error">' + esc(errors.featured) + '</p>' : "") +
      '<div class="field-grid"><label class="field"><span>Report path</span><input type="text" data-field="report" value="' + esc(project.report || "") + '" placeholder="report.html"' + describedBy(errors, "report") + '>' + errorMarkup(errors, "report") + '</label>' +
      '<label class="field field-wide"><span>Highlight</span><textarea data-field="highlight" rows="3" placeholder="Concrete outcome, finding, or capability">' + esc(project.highlight || "") + '</textarea></label></div>' +
      '<fieldset class="field fieldset-wide"' + describedBy(errors, "categories") + '><legend>Categories</legend><div class="check-grid">' + categories + '</div>' + errorMarkup(errors, "categories") + '</fieldset>' +
      '<label class="field"><span>Preview kind</span><select data-field="preview.kind"' + describedBy(errors, "preview.kind") + '>' + kinds + '</select>' + errorMarkup(errors, "preview.kind") + '</label>' +
      '<div class="source-editor"><div class="source-tabs" role="tablist" aria-label="Preview source"><button type="button" role="tab" data-source-mode="upload" aria-selected="' + (mode === "upload") + '">Upload</button><button type="button" role="tab" data-source-mode="existing" aria-selected="' + (mode === "existing") + '">Existing path</button></div>' +
      '<div class="source-panel" role="tabpanel"' + (mode !== "upload" ? " hidden" : "") + '><label class="dropzone" data-dropzone><strong>Drop an image here</strong><span>or choose a local file</span><input type="file" data-field="upload" accept="image/png,image/jpeg,image/webp"></label>' + metrics + '</div>' +
      '<div class="source-panel" role="tabpanel"' + (mode !== "existing" ? " hidden" : "") + '><label class="field"><span>Existing path</span><input type="text" data-field="preview.src" list="asset-paths" value="' + esc(preview.src || "") + '" placeholder="assets/img/projects/example.webp"' + describedBy(errors, "preview.src") + '><datalist id="asset-paths">' + assets + '</datalist>' + errorMarkup(errors, "preview.src") + '</label></div></div>' +
      '<label class="field"><span>Alt text</span><input type="text" data-field="preview.alt" value="' + esc(preview.alt || "") + '" placeholder="Describe the visible chart or interface"' + describedBy(errors, "preview.alt") + '>' + errorMarkup(errors, "preview.alt") + '</label>' +
      '</section></div>';
  }

  function renderChangeSummary(summary) {
    summary = summary || {};
    return '<span><strong>' + (summary.changedProjects || 0) + ' projects</strong></span>' +
      '<span><strong>' + (summary.newImages || 0) + ' new images</strong></span>' +
      '<span><strong>' + (summary.archivedCandidates || 0) + ' archive candidates</strong></span>';
  }

  return {
    esc: esc,
    renderList: renderList,
    renderInspector: renderInspector,
    renderCardPreview: renderCardPreview,
    renderChangeSummary: renderChangeSummary
  };
});
