# sciencemj.github.io

Personal portfolio for **MJ (Sciencemj)** — a Business × Computer Science
student working in data and ML. Static site, no build step, served by GitHub
Pages at <https://sciencemj.github.io/>.

It applies the *Sciencemj* design system (warm earth-tone palette, terracotta
accent, Space Grotesk / Hanken Grotesk / JetBrains Mono, light + dark).

## Layout

```
index.html              Landing page
assets/css/tokens.css   Design tokens (light + dark)
assets/css/site.css     Page styles
assets/js/theme.js      Theme toggle (localStorage + prefers-color-scheme)
assets/js/projects.js   Live project cards from the GitHub API
assets/img/logomark.svg Bar-chart "M" mark / favicon
embed/footer.js         Shared footer + back-link injector for report repos
```

## Project cards

Cards are rendered client-side from the **GitHub REST API**, so they reflect
repo changes (description, topics, last-pushed) automatically — no rebuild.

To feature a project, add it to `PROJECTS` in `assets/js/projects.js`:

```js
var PROJECTS = [
  { repo: 'seoul-bike-analysis', report: 'report.html' }, // links to the Pages report
  { repo: 'LCC_Review_Sentiment_Cluster' }                // no Pages yet -> links to repo
];
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
