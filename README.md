# sciencemj.github.io

Personal portfolio for **MJ (Sciencemj)** — a Business × Computer Science
student working in data and ML. Served by GitHub Pages at
<https://sciencemj.github.io/>.

It applies the *Sciencemj* design system (warm earth-tone palette, terracotta
accent, Space Grotesk / Hanken Grotesk / JetBrains Mono, light + dark).

## Build

Every page except the posts is plain static HTML, committed as-is. Posts are
built from their markdown:

```
bun install
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
site. `.nojekyll` is the one dotfile that ships.

## Layout

```
index.html                 Landing — profile, writing (4), education, projects (4)
writing.html               Full writing archive
projects.html              Full project list
contact.html               Contact details
assets/css/tokens.css      Design tokens (light + dark)
assets/css/pages.css       Page styles (CV-style rows, no cards)
assets/css/bg-art.css      Background orbs + grain
assets/js/theme.js         Theme toggle (localStorage + prefers-color-scheme)
assets/js/posts.data.js    Writing entries
assets/js/projects.data.js Which repos appear, plus previews and highlights
assets/js/project-model.js Project normalisation shared with the admin tool
assets/js/pages.js         Renders the writing and project rows
assets/img/logomark.svg    Bar-chart "M" mark / favicon
embed/footer.js            Shared footer + back-link injector for report repos
```

The landing page caps a list with `data-limit` on the `<ul>`; the archive pages
leave it off and render everything.

## Project cards

Rows are rendered client-side from the **GitHub REST API**, so they reflect
repo changes (description, topics, last-pushed) automatically — no rebuild.

To list a project, add it to `window.PORTFOLIO_PROJECTS` in
`assets/js/projects.data.js`:

```js
{ "repo": "seoul-bike-analysis", "report": "report.html" }, // links to the Pages report
{ "repo": "LCC_Review_Sentiment_Cluster" }                  // no Pages yet -> links to repo
```

- `report` is a path under that repo's GitHub Pages site. It is used only when
  the repo actually has Pages enabled (`has_pages`); otherwise the card links to
  the repository and is labelled "report soon".
- Title, description, tags (topics), language and "updated" all come live from
  the API. Responses are cached in `sessionStorage` for the session.
- Unauthenticated GitHub API allows 60 requests/hour per IP — ample here.

## Shared report footer

Report repositories get a unified footer + "back to portfolio" link by adding a
single line before `</body>`:

```html
<script src="https://sciencemj.github.io/embed/footer.js" defer></script>
```

`embed/footer.js` is self-contained and idempotent. Edit it once here and every
report that includes it updates.
