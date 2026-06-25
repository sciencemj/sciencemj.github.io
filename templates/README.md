# Report template

`report-template.html` is a reusable, design-system-styled report page for any
Sciencemj project. It keeps every report visually consistent with the portfolio
and links back to it.

## Use it

1. Copy `report-template.html` into a project repo as `report.html`.
2. Replace every `TODO` (title, eyebrow, headline, metrics, figures, table,
   takeaways, footer meta). Search the file for `TODO`.
3. Put figure images in `report_assets/` next to `report.html` and update the
   `<img src>` paths.
4. Enable **GitHub Pages** on the repo (Settings → Pages → branch `main`, `/`).
5. Add the repo to the portfolio's card list in
   `assets/js/projects.js` (`PROJECTS`), with `report: 'report.html'`.

## What's built in

- The Sciencemj design tokens (warm earth-tone, light + dark) inline — no build.
- A `← Sciencemj` back-link in the nav.
- The shared portfolio footer, injected by:
  ```html
  <script src="https://sciencemj.github.io/embed/footer.js" defer></script>
  ```
  Keep that line. Edit the footer once in `embed/footer.js` and every report
  that includes it updates.
- Theme toggle (persisted under the `ddr-theme` key) and Lucide icons.

## Blocks included

Based on the `seoul-bike-analysis` report design:

Hero + side stat panel · problem/goal cards · data sources · finding + figure ·
figure pair · segment bars + split bar · model-comparison bars · recommendation
table · insight grid · future work · report meta footer.

Delete the blocks you don't need — they're independent.
