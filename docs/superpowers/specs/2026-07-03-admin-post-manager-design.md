# Local Admin Post Manager — Design

**Date:** 2026-07-03
**Status:** Approved (conversation), implemented same day

## Problem

The portfolio site has no way to add/remove/reorder featured project cards
without hand-editing the `PROJECTS` array inside `assets/js/projects.js`.
The owner wants an interactive, local-only way to manage the list.

## Decisions

- **Scope:** GitHub repo cards only (no custom blog-style posts).
- **Environment:** local machine only — no hosted admin, no tokens.
- **Interface:** local webview served by a tiny **Bun** server (zero deps;
  Bun 1.3.14 installed at `/opt/homebrew/bin/bun`).
- Rejected alternatives: File System Access API (Chrome-only, no git),
  Python stdlib server (user prefers JS/Bun), hosted admin page (PAT burden).

## Architecture

```
assets/js/projects.data.js   ← single source of truth (new)
assets/js/projects.js        ← reads window.PORTFOLIO_PROJECTS (edited)
index.html                   ← loads data file before projects.js (edited)
admin/server.js              ← Bun.serve, localhost-only API (new)
admin/index.html             ← single-page management UI (new)
```

### Data file contract

`assets/js/projects.data.js` holds
`window.PORTFOLIO_PROJECTS = [ { "repo": ..., "report"?: ... }, ... ];`
with a strict-JSON array body. Both the site and the admin server parse it;
the server regenerates it byte-exactly on save (verified by a round-trip
smoke test: save unchanged data → empty `git diff`). A plain `.js` file
(not `.json`) so the site still works over `file://`.

### Server API (`bun admin/server.js`, 127.0.0.1:4747)

| Route | Behavior |
|---|---|
| `GET /` | redirect `/admin/` |
| `GET /admin/` | the UI |
| `GET /api/projects` | `{ owner, projects }` parsed live from data file |
| `POST /api/save` | validate (`repo` ~ `/^[A-Za-z0-9_.-]+$/`; `report` no leading `/`, no `..`), rewrite data file |
| `POST /api/git` | `git add` (data file) → `commit` → `push`, via `Bun.spawn` argv form; "nothing to commit" short-circuits before push |
| `GET /assets/*` | static, with path-traversal guard |

`--no-open` skips browser auto-open; `PORT` env overrides the port.

### UI

Left panel: current featured list — reorder (drag + ▲/▼), remove, editable
`report` path per row. Right panel: all public repos from the GitHub API
(unauthenticated, client-side) with search, "has Pages" badge, Add button
(prefills `report.html` when the repo has Pages). Top bar: dirty indicator,
Save, Commit & push (with confirm). All GitHub-derived text escaped before
DOM insertion. Uses the site's `tokens.css` design tokens; works offline
except the repo browser.

### Deployment note

`admin/` may ship to GitHub Pages harmlessly: the page loads but every
write API 404s there — the API only exists on the local Bun server.

## Testing

- Smoke: server boot, UI serve, `/api/projects` shape, static assets,
  traversal attempts blocked, save round-trip byte-exact, validation 400s,
  script-tag order in `index.html`.
- Adversarial review: correctness + security lenses (path traversal,
  command injection, XSS from GitHub API data, localhost binding).
- `POST /api/git` is never exercised by automated tests (would push).
