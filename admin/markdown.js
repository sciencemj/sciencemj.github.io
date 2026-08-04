/* Markdown -> post body HTML.

   The markdown itself is parsed by marked (loaded from a CDN in posts.html).
   Everything here exists because of one problem: `$L_i = w_{ij}$` is valid
   maths and valid markdown at the same time, and markdown wins — the
   underscores become emphasis and the equation is destroyed before KaTeX ever
   sees it. So maths spans are lifted out first, parsed around, and put back. */

const PLACEHOLDER = (index) => `MATHPLACEHOLDER${index}ENDMATH`;

/* Order matters: $$…$$ must be matched before $…$, and fenced/inline code is
   lifted too so that a `$` inside a code sample is left alone. */
const PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /\$\$[\s\S]+?\$\$/g,
  /(?<![\\$])\$(?![\s$])(?:[^$\n\\]|\\.)+?\$(?!\$)/g,
];

export function protect(markdown) {
  const spans = [];
  let text = String(markdown == null ? "" : markdown);
  for (const pattern of PATTERNS) {
    text = text.replace(pattern, (match) => {
      spans.push({ raw: match, code: match.startsWith("`") });
      return PLACEHOLDER(spans.length - 1);
    });
  }
  return { text, spans };
}

function put(input, spans, wanted) {
  return String(input).replace(/MATHPLACEHOLDER(\d+)ENDMATH/g, (token, index) => {
    const span = spans[Number(index)];
    return span && span.code === wanted ? span.raw : token;
  });
}

/* Code is lifted only so the maths patterns cannot reach inside it. It has to go
   back before the parser runs, or the fences are never turned into <pre><code>
   and KaTeX ends up rendering the `$` in a shell snippet. */
export const restoreCode = (text, spans) => put(text, spans, true);

/* Maths goes back after parsing, untouched. KaTeX ignores pre/code by default,
   so a dollar sign left inside a code block stays a dollar sign. */
export const restore = (html, spans) => put(html, spans, false);

/* Rewrites the image sources the author types (relative to posts/<slug>.html)
   into whatever the caller needs — object URLs for the live preview. */
export function rewriteImages(html, resolveSrc) {
  if (typeof resolveSrc !== "function") return html;
  return String(html).replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (whole, before, src, after) => {
    const next = resolveSrc(src);
    return before + (next == null ? src : next) + after;
  });
}

/* Wraps bare tables so a wide one scrolls inside the article instead of
   stretching the page — post.css styles .post-table-wrap. */
export function wrapTables(html) {
  return String(html).replace(/<table>/g, '<div class="post-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
}

/* Figures: an image alone in a paragraph becomes <figure>, using its alt as the
   caption, which is what the post stylesheet is built around. */
export function promoteFigures(html) {
  return String(html).replace(
    /<p>(<img\b[^>]*>)<\/p>/g,
    (whole, img) => {
      const alt = /\balt="([^"]*)"/.exec(img);
      const caption = alt && alt[1] ? `\n<figcaption>${alt[1]}</figcaption>` : "";
      return `<figure>${img}${caption}\n</figure>`;
    },
  );
}

/* `parse` is injected so this module can be exercised without marked present. */
export function render(markdown, options = {}) {
  const parse = options.parse || (typeof globalThis.marked === "object" && globalThis.marked.parse);
  if (typeof parse !== "function") {
    throw new Error("markdown parser unavailable — check the marked script tag");
  }
  const { text, spans } = protect(markdown);
  let html = parse(restoreCode(text, spans));
  html = restore(html, spans);
  html = promoteFigures(html);
  html = wrapTables(html);
  html = rewriteImages(html, options.resolveSrc);
  return html.trim();
}
