const HEADER = "/* Portfolio projects list — single source of truth for which repos appear on the site.\n   Edited by the local admin tool (`bun admin/server.js`) or by hand.\n   Array body must stay valid JSON: projects.js and the admin server both parse it. */";
const REPO_RE = /^[A-Za-z0-9_.-]+$/;
const CATEGORY_KEYS = ["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"];
const PREVIEW_KINDS = ["image", "chart", "app", "terminal", "workflow"];

export function parseProjects(text) {
  const match = text.match(/window\.PORTFOLIO_PROJECTS\s*=\s*(\[[\s\S]*\]);/);
  return match ? JSON.parse(match[1]) : [];
}

export function validateProjects(projects) {
  if (!Array.isArray(projects)) return "projects must be an array";
  for (const p of projects) {
    if (!p || typeof p !== "object") return "each project must be an object";
    if (typeof p.repo !== "string" || !REPO_RE.test(p.repo)) return "invalid repo name: " + JSON.stringify(p.repo);
    const report = typeof p.report === "string" ? p.report.trim() : p.report;
    if (report && (typeof report !== "string" || report.startsWith("/") || report.split("/").includes(".."))) return "invalid report path";
    if (p.categories && (!Array.isArray(p.categories) || p.categories.some((key) => !CATEGORY_KEYS.includes(key)))) return "invalid project category";
    if (p.preview) {
      if (!PREVIEW_KINDS.includes(p.preview.kind)) return "invalid preview kind";
      const src = typeof p.preview.src === "string" ? p.preview.src.trim() : p.preview.src;
      const alt = typeof p.preview.alt === "string" ? p.preview.alt.trim() : p.preview.alt;
      if (src && (!src.startsWith("assets/img/projects/") || src.split("/").includes(".."))) return "preview src must be under assets/img/projects/";
      if (src && (!alt || typeof alt !== "string")) return "preview alt is required when src is set";
    }
  }
  return null;
}

export function cleanProjects(projects) {
  return projects.map((p) => {
    if (!p || typeof p !== "object") return p;
    const clean = { repo: p.repo };
    if (typeof p.report === "string" && p.report.trim()) clean.report = p.report.trim();
    if (p.featured === true) clean.featured = true;
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

export function serializeProjects(projects) {
  const rows = projects.map((project) => "  " + JSON.stringify(project)).join(",\n");
  return HEADER + "\nwindow.PORTFOLIO_PROJECTS = [\n" + rows + "\n];\n";
}
