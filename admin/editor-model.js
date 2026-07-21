(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminEditorModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CATEGORY_KEYS = ["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"];
  var PREVIEW_KINDS = ["image", "chart", "app", "terminal", "workflow"];

  function clone(project) {
    project = project || {};
    return Object.assign({
      repo: "", report: "", featured: false, highlight: "", categories: [], preview: { kind: "workflow" }
    }, project, {
      report: typeof project.report === "string" ? project.report : "",
      highlight: typeof project.highlight === "string" ? project.highlight : "",
      featured: project.featured === true,
      categories: Array.isArray(project.categories) ? project.categories.slice() : [],
      preview: Object.assign({ kind: "workflow" }, project.preview || {})
    });
  }

  function normalizeDrafts(projects) {
    return (Array.isArray(projects) ? projects : []).map(clone);
  }

  function draftFromRepository(repo) {
    return {
      repo: repo && typeof repo.name === "string" ? repo.name : "",
      report: repo && repo.has_pages ? "report.html" : "",
      featured: false,
      highlight: "",
      categories: [],
      preview: { kind: "workflow" }
    };
  }

  function updateProject(projects, index, patch) {
    return normalizeDrafts(projects).map(function (project, current) {
      if (current !== index) return project;
      var next = Object.assign({}, project, patch || {});
      if (patch && patch.preview) next.preview = Object.assign({}, project.preview, patch.preview);
      if (patch && patch.categories) next.categories = patch.categories.slice();
      return next;
    });
  }

  function setFeatured(projects, index, nextValue) {
    var drafts = normalizeDrafts(projects);
    if (nextValue && drafts.filter(function (project) { return project.featured; }).length >= 3 && !drafts[index].featured) {
      return { projects: drafts, error: "Only three projects can be featured." };
    }
    drafts[index].featured = Boolean(nextValue);
    return { projects: drafts, error: null };
  }

  function moveProject(projects, from, to) {
    var drafts = normalizeDrafts(projects);
    if (from < 0 || to < 0 || from >= drafts.length || to >= drafts.length || from === to) return drafts;
    var item = drafts.splice(from, 1)[0];
    drafts.splice(to, 0, item);
    return drafts;
  }

  function cropRect(width, height) {
    var ratio = 16 / 10;
    var current = width / height;
    if (current > ratio) {
      var sw = height * ratio;
      return { sx: (width - sw) / 2, sy: 0, sw: sw, sh: height };
    }
    var sh = width / ratio;
    return { sx: 0, sy: (height - sh) / 2, sw: width, sh: sh };
  }

  function slug(value) {
    return String(value || "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  }

  function targetPathFor(project) {
    var src = project && project.preview && typeof project.preview.src === "string" ? project.preview.src.trim() : "";
    if (/^assets\/img\/projects\/[A-Za-z0-9._-]+\.webp$/i.test(src)) return src;
    return "assets/img/projects/" + slug(project && project.repo) + ".webp";
  }

  function buildPayload(projects) {
    return normalizeDrafts(projects).map(function (project) {
      var clean = {
        repo: String(project.repo || "").trim(),
        featured: Boolean(project.featured),
        categories: project.categories.slice(),
        preview: { kind: PREVIEW_KINDS.indexOf(project.preview.kind) > -1 ? project.preview.kind : "workflow" }
      };
      var report = project.report.trim();
      var highlight = project.highlight.trim();
      var src = typeof project.preview.src === "string" ? project.preview.src.trim() : "";
      var alt = typeof project.preview.alt === "string" ? project.preview.alt.trim() : "";
      if (report) clean.report = report;
      if (highlight) clean.highlight = highlight;
      if (src) clean.preview.src = src;
      if (alt) clean.preview.alt = alt;
      return clean;
    });
  }

  function validateDrafts(projects) {
    var errors = {};
    normalizeDrafts(projects).forEach(function (project, index) {
      var item = {};
      if (!project.repo.trim()) item.repo = "Repository name is required.";
      if (!project.categories.length) item.categories = "Choose at least one category.";
      if (project.categories.some(function (key) { return CATEGORY_KEYS.indexOf(key) === -1; })) item.categories = "Choose valid categories.";
      if (PREVIEW_KINDS.indexOf(project.preview.kind) === -1) item["preview.kind"] = "Choose a valid preview kind.";
      var src = typeof project.preview.src === "string" ? project.preview.src.trim() : "";
      var alt = typeof project.preview.alt === "string" ? project.preview.alt.trim() : "";
      if (src && !alt) item["preview.alt"] = "Describe the preview image.";
      if (Object.keys(item).length) errors[index] = item;
    });
    return errors;
  }

  function stable(project) {
    return JSON.stringify(buildPayload([project])[0]);
  }

  function summarizeChanges(original, drafts, pendingUploads) {
    var before = normalizeDrafts(original);
    var after = normalizeDrafts(drafts);
    var changed = 0;
    after.forEach(function (project, index) {
      if (!before[index] || stable(before[index]) !== stable(project)) changed += 1;
    });
    changed += Math.max(0, before.length - after.length);
    var uploads = pendingUploads instanceof Map ? pendingUploads : new Map();
    var archived = 0;
    uploads.forEach(function (_, repo) {
      var old = before.find(function (project) { return project.repo === repo; });
      if (old && old.preview && old.preview.src) archived += 1;
    });
    return { changedProjects: changed, newImages: uploads.size, archivedCandidates: archived };
  }

  return {
    CATEGORY_KEYS: CATEGORY_KEYS,
    PREVIEW_KINDS: PREVIEW_KINDS,
    normalizeDrafts: normalizeDrafts,
    draftFromRepository: draftFromRepository,
    updateProject: updateProject,
    setFeatured: setFeatured,
    moveProject: moveProject,
    buildPayload: buildPayload,
    cropRect: cropRect,
    targetPathFor: targetPathFor,
    summarizeChanges: summarizeChanges,
    validateDrafts: validateDrafts
  };
});
