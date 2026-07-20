# Portfolio Living Data Design

Date: 2026-07-20  
Status: Approved design; implementation pending

## Goal

Reshape the portfolio into a distinctive “Living Data Lab” without changing its
static GitHub Pages architecture. The page must show how MJ turns messy inputs
into trustworthy decisions, then prove that claim with project-specific visual
previews.

The primary audience is a recruiter, collaborator, or technical peer scanning
for evidence of data-analysis judgment. The page's single job is to move that
visitor from the hero thesis to a relevant project with minimal friction.

## Scope

This branch will:

- add an interactive hero visualization that transforms scattered data into a
  structured result;
- replace generic project-cover bars with mixed, project-specific previews;
- promote three projects into larger case-study cards and show the remainder in
  a compact grid;
- reduce the visible filter taxonomy to five useful categories;
- add a preview data contract that a later admin-page feature can edit;
- preserve light/dark themes, keyboard navigation, reduced-motion behavior,
  and the no-build static deployment.

This branch will not:

- add the enhancement-game easter egg;
- add image upload, file storage, or thumbnail editing to the admin page;
- add a backend, framework, bundler, or external animation library;
- rewrite project reports or unrelated portfolio copy.

## Design Direction

### Palette

The existing brand palette remains, but decoration shifts from generic blurred
orbs toward data-instrument cues.

- Paper Canvas: `#FAF6F0`
- Carbon Canvas: `#1B1611`
- Decision Orange: `#E8682B`
- Signal Teal: `#4E8A7E`
- Evidence Sand: `#D9A441`
- Model Slate: `#5E6E8A`

### Typography

- Space Grotesk: display headings and project titles
- Hanken Grotesk: body copy and controls
- JetBrains Mono: data states, metadata, labels, and measurements
- IBM Plex Sans KR: Korean fallback

No new font dependency is introduced.

### Signature

The memorable element is a living data canvas in the hero. It begins as an
unstructured scatter, responds gently to pointer position, and resolves through
three truthful states: `Raw`, `Pattern`, and `Decision`. The transition embodies
the existing headline rather than decorating it.

The current ambient orbs remain only as restrained color atmosphere. Their
opacity and movement are reduced so the data canvas carries the visual identity.

## Page Structure

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ navigation                                               │
├──────────────────────────────┬───────────────────────────┤
│ headline, introduction, CTA  │ living data canvas        │
│                              │ Raw / Pattern / Decision  │
├──────────────────────────────┴───────────────────────────┤
│ selected work                         five filters        │
├──────────────────────────────────────────────────────────┤
│ featured case study 1: large preview + project evidence  │
├───────────────────────┬──────────────────────────────────┤
│ featured case study 2 │ featured case study 3            │
├───────────────────────┴──────────────────────────────────┤
│ compact project grid, two columns                        │
├──────────────────────────────────────────────────────────┤
│ about / working method                                   │
│ toolbelt                                                 │
│ contact CTA                                              │
└──────────────────────────────────────────────────────────┘
```

Mobile:

- hero copy appears first, followed by a full-width static or interactive data
  canvas;
- filters wrap within the viewport and retain at least a 40-pixel touch height;
- every featured and compact project card becomes one column;
- preview media uses a stable aspect ratio and never causes horizontal overflow;
- navigation controls keep accessible touch targets.

## Hero Data Canvas

### Rendering

Use inline SVG and a small dedicated script. SVG keeps the visualization crisp,
themeable, accessible as decorative content, and easier to verify than a pixel
canvas. Approximately 48 points are sufficient; no physics engine is needed.

The visualization exposes three internal states:

1. `Raw`: scattered points with weak relationships.
2. `Pattern`: points settle into visible clusters and a trend emerges.
3. `Decision`: noise recedes, a fitted line and highlighted decision region
   remain.

Page position determines the base state. Pointer movement adds a small local
displacement without changing state or capturing input. A compact label reports
the current state visually.

### Motion and failure behavior

- Use `requestAnimationFrame` only while movement is active.
- Stop animation when the hero is outside the viewport.
- Under `prefers-reduced-motion: reduce`, render the final `Decision` state with
  no animation.
- Without JavaScript, the inline SVG still shows the final static composition.
- The visualization is `aria-hidden="true"`; the adjacent headline carries the
  meaning.

## Project Presentation

### Hierarchy

The first three configured featured projects receive case-study treatment. The
first card spans the content width; the next two share a row. Remaining projects
use compact two-column cards. Configuration controls featured status, so visual
priority does not depend permanently on array order.

Each card presents information in this order:

1. preview;
2. title and report/code status;
3. concise project description or curated highlight;
4. language, update recency, and a maximum of two visible tags;
5. clear destination affordance.

### Preview strategy

Use real output wherever it gives honest evidence:

- reports: representative chart crop;
- apps: real product screenshot;
- developer tools: purpose-built terminal or workflow preview based on the
  project's real command or process;
- missing media: deterministic type-specific fallback generated with HTML/CSS.

Initial local assets live under `assets/img/projects/` as optimized WebP or SVG.
Raster images target less than 180 KB each and include explicit dimensions to
avoid layout shift.

### Preview data contract

Each entry in `assets/js/projects.data.js` may add:

```js
{
  repo: "example-project",
  report: "report.html",
  featured: true,
  highlight: "One concrete result or project outcome.",
  preview: {
    kind: "image",
    src: "assets/img/projects/example-project.webp",
    alt: "Representative project result"
  }
}
```

Supported `preview.kind` values are `image`, `chart`, `app`, `terminal`, and
`workflow`. `src` is required only for `image`, `chart`, and `app`. `alt` is
required whenever `src` is present.

The renderer validates these fields defensively. Invalid or missing preview data
uses the type-specific fallback and never suppresses the project card.

This contract is the boundary for the later admin-page work. The future editor
will manage `kind`, `src`, `alt`, `featured`, and `highlight`; no upload UI or
storage behavior is part of this branch.

## Filters

Replace the live union of every GitHub topic with five editorial categories:

- Data Analysis
- ML & NLP
- Visualization
- Developer Tools
- Apps

Project configuration maps repository topics into these categories. The `All`
control remains the default. Multiple active categories keep OR behavior.
Specific repository topics still appear on cards, capped at two visible tags.

If JavaScript or GitHub metadata fails, all cards remain visible and the filter
bar hides rather than presenting unusable controls.

## Data Flow

1. Static configuration renders skeleton dimensions and supplies preview,
   feature status, category, and curated highlight.
2. Existing GitHub API requests add description, topics, language, update time,
   Pages availability, and link targets.
3. Preview normalization chooses a real asset or deterministic fallback.
4. Layout separates featured and compact cards.
5. Filters operate on editorial categories, independent of API topic wording.

The existing `sessionStorage` cache remains. Preview assets are local and do not
wait on GitHub API responses.

## Accessibility

- Preserve skip navigation and visible `:focus-visible` outlines.
- Increase icon, filter, and compact navigation targets toward 40–44 pixels.
- Keep project cards as descriptive links with distinct accessible names.
- Give real preview images useful `alt` text; decorative fallbacks remain hidden
  from assistive technology.
- Update theme-toggle labeling to state the destination theme.
- Preserve `aria-busy` while GitHub metadata loads.
- Ensure all hero and card motion obeys reduced-motion preferences.
- Maintain no horizontal overflow at 390 CSS pixels.

## Performance

- No new runtime dependency.
- Lazy-load project preview images below the first featured card.
- Use explicit image dimensions and `object-fit` to prevent layout shift.
- Keep hero animation bounded to one SVG and pause it off-screen.
- Retain a usable static hero and project fallback when JavaScript is unavailable.

## Implementation Boundaries

Expected changes:

- `index.html`: hero visualization markup and project-section structure hooks
- `assets/css/site.css`: hero grid, case-study cards, compact cards, touch targets
- `assets/css/bg-art.css`: quieter ambient background
- `assets/js/projects.data.js`: preview, category, feature, and highlight fields
- `assets/js/projects.js`: schema normalization, mixed previews, split layouts,
  editorial filtering
- `assets/js/data-canvas.js`: bounded hero-state animation
- `assets/img/projects/`: optimized project preview assets
- `tests/`: preview-schema, fallback, filter, and rendering behavior tests

Unrelated admin server behavior and report templates remain untouched.

## Verification

Automated checks:

- preview normalization accepts every supported kind;
- missing or invalid preview data produces a fallback;
- five editorial filters retain OR behavior and accessible pressed state;
- featured and compact projects render in the correct containers;
- existing report/code link selection remains unchanged;
- reduced-motion produces a static final hero state.

Browser checks:

- desktop at 1440 × 900 in light and dark themes;
- mobile at 390 × 844 in light and dark themes;
- no horizontal overflow;
- keyboard traversal reaches navigation, filters, every project, and CTA;
- filter, theme, project-link, and reduced-motion states remain usable;
- no console errors or failed local preview assets.

## Success Criteria

- The hero visually communicates transformation from messy data to a decision.
- Featured projects no longer share a generic cover treatment.
- Real charts, app screens, terminal views, and workflows coexist within one
  disciplined card system.
- Five filters replace the current twenty-chip taxonomy.
- Preview data is editable through a stable contract ready for later admin work.
- Existing static deployment, theme, project links, and API enrichment continue
  to work.
- Desktop and mobile screenshots show a coherent, distinctive Living Data Lab
  rather than a generic portfolio template.
