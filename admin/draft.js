/* Draft bookkeeping for the post editor.

   Everything here is pure so it can be tested without a browser; posts.js owns
   the localStorage and DOM side. Drafts exist to survive a crash or a mis-click,
   not to replace saving — they never touch the repository. */

export const DRAFT_PREFIX = "post-draft:";
export const NEW_POST_KEY = "__new__";

/* Keyed by the slug the editor opened with, not the slug field, so typing a
   title does not scatter a new draft on every keystroke. */
export function draftKeyFor(openedSlug) {
  return DRAFT_PREFIX + (openedSlug || NEW_POST_KEY);
}

export function makeDraft(meta, markdown, savedAt) {
  return {
    title: meta.title || "",
    slug: meta.slug || "",
    date: meta.date || "",
    kind: meta.kind || "Post",
    lang: meta.lang || "ko",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    lead: meta.lead || "",
    markdown: String(markdown == null ? "" : markdown),
    savedAt: savedAt || "",
  };
}

/* Nothing worth keeping if the author has not written anything yet. */
export function worthKeeping(draft) {
  return Boolean(draft && (draft.markdown.trim() || draft.title.trim()));
}

/* Only interrupt when the draft actually says something the loaded post does
   not — otherwise every reopen would nag. */
export function shouldOffer(draft, current) {
  if (!worthKeeping(draft)) return false;
  if (!current) return true;
  return draft.markdown !== (current.markdown || "") || draft.title !== (current.title || "");
}

/* Image paths a restored draft refers to. They are only in the markdown — the
   bytes were never uploaded — so the editor can tell the author which ones it
   cannot bring back. */
export function imagePaths(markdown) {
  const found = String(markdown == null ? "" : markdown).match(/assets\/[A-Za-z0-9._-]+\.(?:webp|svg)/g) || [];
  return [...new Set(found)];
}
