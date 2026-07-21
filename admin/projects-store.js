const HEADER = "/* Portfolio projects list — single source of truth for which repos appear on the site.\n   Edited by the local admin tool (`bun admin/server.js`) or by hand.\n   Array body must stay valid JSON: projects.js and the admin server both parse it. */";
const REPO_RE = /^[A-Za-z0-9_.-]+$/;
const CATEGORY_KEYS = ["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"];
const PREVIEW_KINDS = ["image", "chart", "app", "terminal", "workflow"];
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function parseProjects(text) {
  const match = text.match(/window\.PORTFOLIO_PROJECTS\s*=\s*(\[[\s\S]*\]);/);
  return match ? JSON.parse(match[1]) : [];
}

export function validateProjects(projects) {
  if (!Array.isArray(projects)) return "projects must be an array";
  let featuredCount = 0;
  for (const p of projects) {
    if (!p || typeof p !== "object" || Array.isArray(p)) return "each project must be an object";
    if (typeof p.repo !== "string" || !REPO_RE.test(p.repo)) return "invalid repo name: " + JSON.stringify(p.repo);
    if (hasOwn(p, "report")) {
      if (typeof p.report !== "string") return "invalid report path";
      const report = p.report.trim();
      if (report && (report.startsWith("/") || report.split("/").includes(".."))) return "invalid report path";
    }
    if (hasOwn(p, "featured") && typeof p.featured !== "boolean") return "invalid featured flag";
    if (p.featured === true && ++featuredCount > 3) return "only three projects can be featured";
    if (hasOwn(p, "highlight") && typeof p.highlight !== "string") return "invalid project highlight";
    if (!hasOwn(p, "categories") || !Array.isArray(p.categories)) return hasOwn(p, "categories") ? "invalid project category" : "at least one project category is required";
    if (!p.categories.length) return "at least one project category is required";
    for (const key of p.categories) {
      if (typeof key !== "string" || !CATEGORY_KEYS.includes(key)) return "invalid project category";
    }
    if (hasOwn(p, "preview")) {
      if (!p.preview || typeof p.preview !== "object" || Array.isArray(p.preview)) return "invalid project preview";
      if (typeof p.preview.kind !== "string" || !PREVIEW_KINDS.includes(p.preview.kind)) return "invalid preview kind";
      if (hasOwn(p.preview, "src") && typeof p.preview.src !== "string") return "invalid preview src";
      if (hasOwn(p.preview, "alt") && typeof p.preview.alt !== "string") return "invalid preview alt";
      const src = hasOwn(p.preview, "src") ? p.preview.src.trim() : "";
      const alt = hasOwn(p.preview, "alt") ? p.preview.alt.trim() : "";
      if (src && (!src.startsWith("assets/img/projects/") || src.split("/").includes(".."))) return "preview src must be under assets/img/projects/";
      if (src && !alt) return "preview alt is required when src is set";
    }
  }
  return null;
}

export function cleanProjects(projects) {
  return projects.map((p) => {
    if (!p || typeof p !== "object") return p;
    const clean = { repo: p.repo };
    if (typeof p.report === "string" && p.report.trim()) clean.report = p.report.trim();
    if (hasOwn(p, "featured")) clean.featured = p.featured;
    if (typeof p.highlight === "string" && p.highlight.trim()) clean.highlight = p.highlight.trim();
    if (Array.isArray(p.categories)) clean.categories = [...p.categories];
    if (p.preview && typeof p.preview === "object") {
      clean.preview = { kind: p.preview.kind };
      if (typeof p.preview.src === "string" && p.preview.src.trim()) clean.preview.src = p.preview.src.trim();
      if (typeof p.preview.alt === "string" && p.preview.alt.trim()) clean.preview.alt = p.preview.alt.trim();
    }
    return clean;
  });
}

export function prepareProjects(raw) {
  const error = validateProjects(raw);
  if (error) return { error };
  return { projects: cleanProjects(raw) };
}

export function serializeProjects(projects) {
  const rows = projects.map((project) => "  " + JSON.stringify(project)).join(",\n");
  return HEADER + "\nwindow.PORTFOLIO_PROJECTS = [\n" + rows + "\n];\n";
}
