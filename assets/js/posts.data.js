/* Writing entries — the source of truth for writing.html and the landing page.

   Fields
     date   YYYY-MM-DD, used for the "Mon YYYY" label and the sort order (newest first)
     kind   Post | Report | Talk — shown as a small label
     lang   "ko" | "en" — shown as a KO/EN badge; omit to hide it
     title  plain text
     url    "posts/<slug>.html" for a post in this repo, or a full https:// URL for a
            report on another repo's Pages site. External URLs open in a new tab.
     tags   0-3 short labels

   Edited by the local admin tool (`bun admin/server.js`) or by hand.
   Array body must stay valid JSON: pages.js and the admin server both parse it. */
window.PORTFOLIO_POSTS = [
  {"date":"2026-08-05","kind":"Post","lang":"ko","title":"Batch Normalization","url":"posts/batch-normalization.html","tags":["Deep Learning"]},
  {"date":"2026-08-04","kind":"Post","lang":"ko","title":"역전파의 원리","url":"posts/backpropagation.html","tags":["Deep learning"]},
  {"date":"2026-07-12","kind":"Post","lang":"ko","title":"Dummy post — replace with a real one","url":"https://github.com/sciencemj","tags":["Placeholder"]}
];
