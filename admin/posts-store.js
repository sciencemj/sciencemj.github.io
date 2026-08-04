/* Post metadata and page rendering.

   Pure string work, no node imports — the admin server and the browser editor
   both import this module, so the live preview and the saved file come out of
   the same renderPostPage() call and cannot drift apart. */

const HEADER = `/* Writing entries — the source of truth for writing.html and the landing page.

   Fields
     date   YYYY-MM-DD, used for the "Mon YYYY" label and the sort order (newest first)
     kind   Post | Report | Talk — shown as a small label
     lang   "ko" | "en" — shown as a KO/EN badge; omit to hide it
     title  plain text
     url    "posts/<slug>.html" for a post in this repo, or a full https:// URL for a
            report on another repo's Pages site. External URLs open in a new tab.
     tags   0-3 short labels

   Edited by the local admin tool (\`bun admin/server.js\`) or by hand.
   Array body must stay valid JSON: pages.js and the admin server both parse it. */`;

export const KINDS = ["Post", "Report", "Talk"];
export const LANGS = ["ko", "en"];
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const MAX_TAGS = 3;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"]/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]
  ));
}

export function parsePosts(text) {
  const match = String(text).match(/window\.PORTFOLIO_POSTS\s*=\s*(\[[\s\S]*?\]);/);
  return match ? JSON.parse(match[1]) : [];
}

export function serializePosts(posts) {
  const rows = posts.map((post) => "  " + JSON.stringify(post)).join(",\n");
  return HEADER + "\nwindow.PORTFOLIO_POSTS = [\n" + rows + "\n];\n";
}

export function slugError(slug) {
  if (typeof slug !== "string" || !slug) return "A slug is required.";
  if (slug.length > 60) return "Slug must be 60 characters or fewer.";
  if (!SLUG_RE.test(slug)) return "Slug may only use lowercase letters, digits and hyphens.";
  return null;
}

/* Returns null when the metadata is usable, otherwise a message for the editor. */
export function metaError(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "Post metadata is missing.";
  const slug = slugError(meta.slug);
  if (slug) return slug;
  if (typeof meta.title !== "string" || !meta.title.trim()) return "A title is required.";
  if (typeof meta.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) return "Date must be YYYY-MM-DD.";
  if (Number.isNaN(Date.parse(meta.date + "T00:00:00Z"))) return "That date does not exist.";
  if (!KINDS.includes(meta.kind)) return "Kind must be one of: " + KINDS.join(", ") + ".";
  if (!LANGS.includes(meta.lang)) return "Language must be ko or en.";
  if (hasOwn(meta, "lead") && typeof meta.lead !== "string") return "Invalid lead.";
  if (hasOwn(meta, "description") && typeof meta.description !== "string") return "Invalid description.";
  if (hasOwn(meta, "tags")) {
    if (!Array.isArray(meta.tags)) return "Tags must be a list.";
    if (meta.tags.length > MAX_TAGS) return `Use at most ${MAX_TAGS} tags.`;
    for (const tag of meta.tags) {
      if (typeof tag !== "string" || !tag.trim()) return "Tags must be non-empty text.";
    }
  }
  return null;
}

export function cleanMeta(meta) {
  const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => tag.trim()).filter(Boolean) : [];
  return {
    slug: meta.slug.trim(),
    title: meta.title.trim(),
    date: meta.date,
    kind: meta.kind,
    lang: meta.lang,
    lead: typeof meta.lead === "string" ? meta.lead.trim() : "",
    description: typeof meta.description === "string" ? meta.description.trim() : "",
    tags,
  };
}

export function postUrl(slug) { return "posts/" + slug + ".html"; }

export function monthYear(date) {
  const parts = String(date || "").split("-");
  const month = MONTHS[Number(parts[1]) - 1];
  return month ? month + " " + parts[0] : "";
}

/* The exact day, written the way the post's own language writes it. */
export function fullDate(date, lang) {
  const parts = String(date || "").split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day || !MONTHS[month - 1]) return "";
  if (lang === "ko") return `${year}년 ${month}월 ${day}일`;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/* Upserts the entry for this slug and keeps the list newest-first. */
export function upsertPost(posts, meta) {
  const url = postUrl(meta.slug);
  const entry = { date: meta.date, kind: meta.kind, lang: meta.lang, title: meta.title, url };
  if (meta.tags.length) entry.tags = meta.tags;
  const next = (Array.isArray(posts) ? posts : []).filter((post) => post?.url !== url);
  next.push(entry);
  next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return next;
}

export function renderPostPage(template, meta, bodyHtml) {
  /* The day itself sits under the title, so the strip above it only carries the
     kind and the tags. */
  const metaLine = [meta.kind, meta.tags.join(", ")]
    .filter(Boolean)
    .map((part) => "<span>" + escapeHtml(part) + "</span>")
    .join('<span aria-hidden="true">·</span>');
  const description = meta.description || meta.lead || meta.title;
  const values = {
    LANG: escapeHtml(meta.lang),
    TITLE: escapeHtml(meta.title),
    DESCRIPTION: escapeHtml(description),
    META: metaLine,
    DATE_ISO: escapeHtml(meta.date),
    DATE_FULL: escapeHtml(fullDate(meta.date, meta.lang)),
    LEAD: escapeHtml(meta.lead),
    BODY: bodyHtml,
  };
  let page = String(template)
    /* The shell's own instructions must not ship inside a published post. */
    .replace(/<!--\s*Post shell\.[\s\S]*?-->\n?/, "")
    .replace(/\{\{([A-Z_]+)\}\}/g, (token, name) => (hasOwn(values, name) ? values[name] : token));
  if (!values.LEAD) page = page.replace(/\s*<p class="post-lead"><\/p>/, "");
  return page;
}
