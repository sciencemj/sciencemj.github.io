(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PortfolioProjectModel = api;
})(typeof window !== "undefined" ? window : null, function () {
  var CATEGORIES = [
    { key: "data-analysis", label: "Data Analysis" },
    { key: "ml-nlp", label: "ML & NLP" },
    { key: "visualization", label: "Visualization" },
    { key: "developer-tools", label: "Developer Tools" },
    { key: "apps", label: "Apps" },
  ];
  var KEYS = CATEGORIES.map(function (item) { return item.key; });
  var KINDS = ["image", "chart", "app", "terminal", "workflow"];
  var ASSET_KINDS = ["image", "chart", "app"];

  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function normalizePreview(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var kind = KINDS.indexOf(raw.kind) > -1 ? raw.kind : "workflow";
    var src = text(raw.src), alt = text(raw.alt);
    var needsAsset = ASSET_KINDS.indexOf(kind) > -1;
    var valid = !needsAsset || (src.indexOf("assets/img/projects/") === 0 && alt);
    return { kind: kind, src: valid && needsAsset ? src : "", alt: valid && needsAsset ? alt : "", fallback: !valid || !needsAsset };
  }
  function normalizeProject(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var categories = Array.isArray(raw.categories) ? raw.categories : [];
    categories = categories.filter(function (key, index) { return KEYS.indexOf(key) > -1 && categories.indexOf(key) === index; });
    return { repo: text(raw.repo), report: text(raw.report), featured: raw.featured === true, highlight: text(raw.highlight), categories: categories, preview: normalizePreview(raw.preview) };
  }
  function splitProjects(projects) {
    var featured = [], compact = [];
    (projects || []).map(normalizeProject).forEach(function (project) {
      if (project.featured && featured.length < 3) featured.push(project); else compact.push(project);
    });
    return { featured: featured, compact: compact };
  }
  function matchesAnyCategory(project, active) {
    return !active || active.length === 0 || active.some(function (key) { return project.categories.indexOf(key) > -1; });
  }
  return { CATEGORIES: CATEGORIES, normalizePreview: normalizePreview, normalizeProject: normalizeProject, splitProjects: splitProjects, matchesAnyCategory: matchesAnyCategory };
});
