# sciencemj.github.io

Personal portfolio for **MJ (Sciencemj)** — a Business × Computer Science
student working in data and ML. Served by GitHub Pages at
<https://sciencemj.github.io/>.

It applies the *Sciencemj* design system (warm earth-tone palette, terracotta
accent, Space Grotesk / Hanken Grotesk / JetBrains Mono, light + dark), and the
whole site chrome reads in English or Korean.

## Build

Every page except the posts is plain static HTML, committed as-is. Posts are
built from their markdown:

```
bun install
bun test                  # 22 suites — the renderer, the admin tool, the pages
bun tools/build-site.js   # -> dist/
```

`.github/workflows/pages.yml` runs the tests and this build on every push to
`main`, then deploys `dist/` to Pages. `posts/*.html` is therefore **not** in
the repository — `posts/<slug>.md` is the source, and editing
`templates/post-template.html` re-renders every post on the next push.

`dist/` carries only what a reader needs: `admin/`, `tests/`, `tools/`,
`templates/` and `docs/` stay out of it, and so does every dot-directory —
agent and editor tooling (`.claude/`, `.cursor/`, `.code-review-graph/` …)
holds absolute local paths and a code index, none of which belongs on a public
site. `.nojekyll` is the one dotfile that ships. The build denies by name
before reading an entry's type, so a symlinked `node_modules` can't crash it.

## Layout

```
index.html                  Landing — profile, writing (4), education, projects (4)
writing.html                Full writing archive
projects.html               Full project list
contact.html                Contact details

assets/css/tokens.css       Design tokens (light + dark)
assets/css/pages.css        Page styles (CV-style rows, no cards)
assets/css/post.css         Post page styles
assets/css/bg-art.css       Background orbs + grain
assets/js/theme.js          Theme toggle (localStorage + prefers-color-scheme)
assets/js/i18n.js           English/Korean toggle for the page copy
assets/js/posts.data.js     Writing entries
assets/js/projects.data.js  Which repos appear, plus previews and highlights
assets/js/project-model.js  Project normalisation shared with the admin tool
assets/js/pages.js          Renders the writing and project rows
assets/img/logomark.svg     Bar-chart "M" mark / favicon
assets/img/projects/        Project preview thumbnails (WebP)

posts/<slug>.md             Post sources + their figures — see posts/README.md
templates/                  Post and report templates — see templates/README.md
admin/                      Local-only editor for posts and projects
tools/build-site.js         The build
tests/                      bun test suites
docs/                       Design specs and plans
embed/footer.js             Shared footer + back-link injector for report repos
```

The landing page caps a list with `data-limit` on the `<ul>`; the archive pages
leave it off and render everything.

## Language

`assets/js/i18n.js` holds every string the four pages show, in `en` and `ko`,
and English is the default — nothing is read from `navigator.language`, so a
first visit always lands in English wherever the reader is. The choice persists
under the `lang` key.

Markup opts in by attribute:

```html
<span data-i18n="nav.writing"></span>                  <!-- textContent -->
<p data-i18n-html="profile.bio"></p>                   <!-- innerHTML, for inline markup -->
<button data-i18n-attr="aria-label:theme.aria"></button>
```

Only page copy lives there. `posts.data.js` and `projects.data.js` are never
translated — those titles and summaries are the author's own words in whichever
language he wrote them. `tests/page-contract.test.js` checks that every key the
pages use exists in both tables, so a typo fails the tests instead of shipping
a blank element.

## Project rows

Rows are rendered client-side from the **GitHub REST API**, so they reflect
repo changes (description, topics, last-pushed) automatically — no rebuild.

To list a project, add it to `window.PORTFOLIO_PROJECTS` in
`assets/js/projects.data.js`:

```js
{"repo":"seoul-bike-analysis","report":"report.html","featured":true,
 "highlight":"Mapped station-level demand and supply gaps across Seoul.",
 "categories":["data-analysis","visualization"],
 "preview":{"kind":"chart","src":"assets/img/projects/seoul-bike.webp","alt":"…"}},
{"repo":"whisper-transcribe","categories":["ml-nlp"],"preview":{"kind":"terminal"}}
```

- `report` is a path under that repo's GitHub Pages site. It is used only when
  the repo actually has Pages enabled (`has_pages`); otherwise the row links to
  the repository and is labelled "report soon".
- `featured` sorts an entry to the top of the list.
- `highlight` is the one line of the author's own framing; title, description,
  tags (topics), language and "updated" all come live from the API.
- `categories` must be keys from `assets/js/project-model.js`, the single source
  of truth: `data-analysis`, `ml-nlp`, `visualization`, `developer-tools`,
  `apps`. Unknown keys are dropped on normalisation.
- `preview.kind` is one of `image`, `chart`, `app`, `terminal`, `workflow`. The
  first three take a `src` under `assets/img/projects/` (checked, so a path can't
  escape it) and an `alt`; `terminal` and `workflow` are drawn, not loaded.
- API responses are cached in `sessionStorage` for the session. Unauthenticated
  GitHub API allows 60 requests/hour per IP — ample here.

The array body must stay valid JSON: `pages.js` and the admin server both parse
it.

## Admin tool

A local-only editor for the two data files, never deployed:

```
bun admin/server.js         # http://127.0.0.1:4747/admin/
```

It binds to `127.0.0.1` and opens on the **post editor** — markdown that renders
where you type, image drag-and-drop (PNG/JPEG/WebP re-encoded to WebP, SVG kept
as vector and sanitized), KaTeX maths, localStorage drafts, and **Commit & push**
to publish. `posts/README.md` documents it in full, including how to write a post
by hand instead.

`/admin/projects` edits `projects.data.js` — the same rows, their highlights,
categories and previews — through the shared `project-model.js` normalisation, so
the editor and the site can't disagree about what a valid entry is.

## Shared report footer

Report repositories get a unified footer + "back to portfolio" link by adding a
single line before `</body>`:

```html
<script src="https://sciencemj.github.io/embed/footer.js" defer></script>
```

`embed/footer.js` is self-contained and idempotent. Edit it once here and every
report that includes it updates. `templates/report-template.html` is the
starting point for such a report.
