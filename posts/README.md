# Posts

One HTML file per post, no build step.

```
posts/<slug>.md            markdown source, kept so the post stays editable
posts/<slug>.html          the published page
posts/assets/<slug>-N.webp its figures
```

## Write one (the editor)

```
bun admin/server.js
```

Then open **Write a post** from the admin bar, or go straight to
<http://127.0.0.1:4747/admin/posts>.

- The left pane edits markdown in place: headings, emphasis, links, images,
  maths and rules render where you type, and the raw syntax comes back on the
  line the cursor is on. The document itself never stops being markdown.
- The right pane is the page itself — it runs the same `renderPostPage()` the
  build writes with, so it cannot drift.
- Drag an image onto the editor, paste one from the clipboard, or use **+ Image**.
  The markdown link is inserted for you.
  - PNG / JPEG / WebP are resized to 1600px wide and re-encoded as WebP (≤400KB).
  - **SVG is kept as vector** — a diagram should not be rasterised. It is
    sanitized on save (scripts, `on*` handlers, `javascript:` links,
    `foreignObject`, entity doctypes and cross-origin refs are removed) and must
    stay under 200KB.
- Maths is [KaTeX](https://katex.org/): `$inline$` and `$$display$$`. A `$` inside
  code stays a `$`.
- **Save post** writes all three files and updates `../assets/js/posts.data.js`.
  **Commit & push** publishes.

Pick an existing post from the dropdown to edit it again.

### Drafts

The editor keeps a draft in the browser's localStorage a second after you stop
typing, and again if you try to close the tab with unsaved work. Reopen the same
post — or start a new one — and it offers to restore it.

A draft is a crash net, not a save: it never touches the repository, and it is
cleared the moment the post is really saved. **Images are not in the draft** —
they only exist in memory until you save — so a restored draft names the image
files it could not bring back, and you re-add them.

## Write one by hand

Copy `../templates/post-template.html` to `posts/<slug>.html`, replace the
`{{TOKENS}}`, then add the entry yourself:

```js
{"date":"2026-08-04","kind":"Post","lang":"ko","title":"역전파의 원리","url":"posts/backpropagation.html","tags":["Deep learning"]}
```

Keep the array newest-first — the landing page shows the top four.

## Notes

- The slug is the URL, so avoid dates in it; the date lives in `posts.data.js`.
- The editor needs the network: marked and KaTeX both come from a CDN.
- Long analyses with many charts stay in their own repo as `report.html` (see
  `../templates/README.md`) and are listed here with `"kind":"Report"` and a
  full `https://` URL.
