# Sciencemj Portfolio Site — Design Spec

Date: 2026-06-25
Status: Approved (design), implementing

## Goal

A GitHub Pages portfolio at `https://sciencemj.github.io/` that applies the
"Sciencemj" personal design system (warm earth-tone, terracotta accent,
Space Grotesk / Hanken Grotesk / JetBrains Mono). It features project
**preview cards** that pull live info from the GitHub API so they reflect
repo changes automatically, and links out to each project's report page.
Existing report repos get a shared footer + back-link for visual unity.

## Decisions (locked)

- **Host**: `sciencemj.github.io` user site, served at root. `.nojekyll`.
- **Scope this round**: portfolio site + retrofit `seoul-bike-analysis` report.
  Building the `LCC_Review_Sentiment_Cluster` report page is deferred; its
  card links to the repo, labelled "report soon".
- **Card data**: pure GitHub REST API (no per-repo manifest files).
- **Profile copy**: keep verifiable facts only; remove fabricated claims.
- **Shared footer**: a single hosted injector `embed/footer.js`, included by
  each report repo, so the common footer stays in one source of truth.

## Architecture (static, no build)

```
index.html              Portfolio landing (Portfolio Home.dc.html -> vanilla)
assets/css/tokens.css   Design tokens, light + dark
assets/css/site.css     nav / hero / project-card / cta / footer + motion
assets/js/theme.js      data-theme toggle: localStorage + prefers-color-scheme
assets/js/projects.js   GitHub API fetch -> render project cards
assets/img/logomark.svg bar-chart "M" mark (+ favicon)
embed/footer.js         shared footer + back-link injector for report repos
README.md  .nojekyll
```

## Project cards — data flow

Local config in `projects.js` lists the repos to feature and the per-repo
link target; all displayed text comes live from the API:

```js
const OWNER = 'sciencemj';
const PROJECTS = [
  { repo: 'seoul-bike-analysis', report: 'report.html' }, // -> pages report
  { repo: 'LCC_Review_Sentiment_Cluster' },               // no pages -> repo
];
```

Per repo: `GET https://api.github.com/repos/{OWNER}/{repo}` ->
`description`, `topics` (tags), `pushed_at` ("Updated <relative>"),
`language`, `html_url`, `has_pages`.

- Link target: `report` set + `has_pages` -> `https://{OWNER}.github.io/{repo}/{report}`;
  else `html_url` with a "Code · report soon" label.
- Cache responses in `sessionStorage` (avoid refetch on same session).
- States: skeleton while loading; per-card error fallback (name + repo link);
  unauthenticated rate limit is 60/hr/IP — acceptable.
- `api.github.com` and `raw.githubusercontent.com` send `Access-Control-Allow-Origin: *`;
  `*.github.io` pages do NOT — hence API, not HTML scraping.

## Honesty edits to the template

Remove: the `12+ / 2 / ∞` stat strip; "Open to 2026 summer internships"
badge; the fake blog/writing section; the three fabricated featured projects;
the LinkedIn link (unknown).

Keep (real): wordmark *Sciencemj*; "Business × Computer Science student"
(from the brand doc); GitHub -> `github.com/sciencemj`; Email ->
`mailto:sciencemj.park@gmail.com`. Hero brand line kept (copy, not a claim).
CTA reduced to a neutral "Get in touch".

## Theme

`data-theme` on `<html>`. On load: `localStorage('theme')` else
`prefers-color-scheme`. Toggle persists. Tokens define the dark earth-tone set.

## seoul-bike retrofit (additive, surgical)

`report.html` already uses the same tokens/fonts/`data-theme`, so no restyle.
1. Wrap the nav right side in a group: add a "← Sciencemj" back-link anchor
   to `https://sciencemj.github.io/` beside the existing theme button.
2. Add `<script src="https://sciencemj.github.io/embed/footer.js" defer></script>`
   before `</body>`. The injector appends a common portfolio footer (logomark,
   wordmark, back-to-portfolio link, GitHub/Email, © year) below the report's
   own footer. Idempotent; styled with `var(--token, fallback)` so it also
   works on report pages that lack the tokens.

Its theme key is `ddr-theme` (independent of the portfolio's `theme` key — not
unified, left as-is to avoid touching report behavior).

## Out of scope (this round)

LCC report page, blog, slides, contact form backend.

## Outward actions (confirm before each)

1. Create + push GitHub repo `sciencemj.github.io`.
2. Push the retrofit commit to `seoul-bike-analysis`.

Everything is built and verified locally first.
