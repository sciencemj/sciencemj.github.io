/* In-place markdown editing, Obsidian style.

   The document stays plain markdown — nothing here rewrites it. Decorations
   hide the syntax on lines the cursor is not on and draw images, maths and
   rules as widgets, so the text reads as formatted while you edit it.

   Versions are pinned and every package is asked for the same @codemirror/state
   through ?deps=. Two copies of that package silently break every extension. */

const STATE = "@codemirror/state@6.4.1";
const VIEW = "@codemirror/view@6.26.3";
const LANGUAGE = "@codemirror/language@6.10.1";
const DEPS = `?deps=${STATE},${VIEW}`;

const [
  { EditorState, RangeSetBuilder },
  { EditorView, Decoration, ViewPlugin, WidgetType, keymap, drawSelection, highlightActiveLine },
  { syntaxTree, HighlightStyle, syntaxHighlighting },
  { markdown, markdownLanguage },
  { defaultKeymap, history, historyKeymap },
  { tags },
] = await Promise.all([
  import(`https://esm.sh/${STATE}`),
  import(`https://esm.sh/${VIEW}?deps=${STATE}`),
  import(`https://esm.sh/${LANGUAGE}${DEPS}`),
  import(`https://esm.sh/@codemirror/lang-markdown@6.2.5${DEPS},${LANGUAGE}`),
  import(`https://esm.sh/@codemirror/commands@6.5.0${DEPS}`),
  import(`https://esm.sh/@lezer/highlight@1.2.0`),
]);

/* ---------- Widgets ---------- */

class ImageWidget extends WidgetType {
  constructor(src, alt) { super(); this.src = src; this.alt = alt; }
  eq(other) { return other.src === this.src && other.alt === this.alt; }
  toDOM() {
    const figure = document.createElement("span");
    figure.className = "cm-live-image";
    const image = document.createElement("img");
    image.src = this.src;
    image.alt = this.alt;
    figure.appendChild(image);
    if (this.alt) {
      const caption = document.createElement("span");
      caption.className = "cm-live-caption";
      caption.textContent = this.alt;
      figure.appendChild(caption);
    }
    return figure;
  }
}

class MathWidget extends WidgetType {
  constructor(source, display) { super(); this.source = source; this.display = display; }
  eq(other) { return other.source === this.source && other.display === this.display; }
  toDOM() {
    const host = document.createElement("span");
    host.className = this.display ? "cm-live-math cm-live-math--block" : "cm-live-math";
    if (typeof globalThis.katex === "object") {
      try {
        globalThis.katex.render(this.source, host, { displayMode: this.display, throwOnError: false });
        return host;
      } catch { /* fall through to the raw source */ }
    }
    host.textContent = this.source;
    return host;
  }
}

class BulletWidget extends WidgetType {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-live-bullet";
    dot.textContent = "•";
    return dot;
  }
}

class RuleWidget extends WidgetType {
  toDOM() {
    const rule = document.createElement("span");
    rule.className = "cm-live-rule";
    return rule;
  }
}

const hidden = Decoration.replace({});

/* ---------- Live preview ---------- */

/* Lines the caret or a selection touches keep their raw syntax, so what you are
   editing is always the real text. */
function activeLines(state) {
  const lines = new Set();
  for (const range of state.selection.ranges) {
    const from = state.doc.lineAt(range.from).number;
    const to = state.doc.lineAt(range.to).number;
    for (let line = from; line <= to; line += 1) lines.add(line);
  }
  return lines;
}

/* $…$ and $$…$$ are not markdown, so the parser never sees them; they are found
   by scanning the text instead. Anything inside code is skipped. */
function mathRanges(text) {
  const found = [];
  const skip = [];
  for (const pattern of [/```[\s\S]*?```/g, /`[^`\n]+`/g]) {
    for (const match of text.matchAll(pattern)) skip.push([match.index, match.index + match[0].length]);
  }
  const blocked = (start) => skip.some(([a, b]) => start >= a && start < b);
  for (const match of text.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
    if (!blocked(match.index)) found.push({ from: match.index, to: match.index + match[0].length, source: match[1], display: true });
  }
  const taken = (start) => found.some((item) => start >= item.from && start < item.to);
  for (const match of text.matchAll(/(?<![\\$])\$(?![\s$])((?:[^$\n\\]|\\.)+?)\$(?!\$)/g)) {
    if (!blocked(match.index) && !taken(match.index)) {
      found.push({ from: match.index, to: match.index + match[0].length, source: match[1], display: false });
    }
  }
  return found.sort((a, b) => a.from - b.from);
}

const HEADING_LINE = { 1: "cm-h1", 2: "cm-h2", 3: "cm-h3", 4: "cm-h4", 5: "cm-h5", 6: "cm-h6" };

function buildDecorations(view, resolveSrc) {
  const builder = [];
  const state = view.state;
  const live = activeLines(state);
  const isLive = (from, to) => {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;
    for (let line = first; line <= last; line += 1) if (live.has(line)) return true;
    return false;
  };

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter(node) {
      const name = node.name;

      if (/^ATXHeading[1-6]$/.test(name)) {
        const level = Number(name.slice(-1));
        builder.push(Decoration.line({ class: HEADING_LINE[level] }).range(state.doc.lineAt(node.from).from));
        return;
      }

      if (name === "HeaderMark" && !isLive(node.from, node.to)) {
        /* Swallow the space after the # as well, so the text starts flush. */
        const after = state.doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
        builder.push(hidden.range(node.from, after));
        return;
      }

      if ((name === "EmphasisMark" || name === "CodeMark" || name === "StrikethroughMark")
        && !isLive(node.from, node.to)) {
        builder.push(hidden.range(node.from, node.to));
        return;
      }

      /* A dash becomes a bullet; a numbered marker is left alone because the
         number is content. */
      if (name === "ListMark" && !isLive(node.from, node.to)) {
        if (/^[-*+]$/.test(state.doc.sliceString(node.from, node.to))) {
          builder.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
        }
        return;
      }

      if (name === "QuoteMark" && !isLive(node.from, node.to)) {
        builder.push(hidden.range(node.from, node.to));
        return;
      }

      if (name === "HorizontalRule" && !isLive(node.from, node.to)) {
        builder.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
        return;
      }

      if (name === "Image" && !isLive(node.from, node.to)) {
        const raw = state.doc.sliceString(node.from, node.to);
        const match = /^!\[([^\]]*)\]\(([^)\s]+)/.exec(raw);
        if (match) {
          const src = resolveSrc ? resolveSrc(match[2]) : match[2];
          builder.push(Decoration.replace({ widget: new ImageWidget(src, match[1]), block: false })
            .range(node.from, node.to));
        }
        return;
      }

      /* A link keeps its text and loses the target. */
      if (name === "Link" && !isLive(node.from, node.to)) {
        const raw = state.doc.sliceString(node.from, node.to);
        const match = /^\[([^\]]*)\]\(/.exec(raw);
        if (match) {
          builder.push(hidden.range(node.from, node.from + 1));
          builder.push(hidden.range(node.from + 1 + match[1].length, node.to));
          builder.push(Decoration.mark({ class: "cm-live-link" })
            .range(node.from + 1, node.from + 1 + match[1].length));
        }
      }
    },
  });

  for (const item of mathRanges(state.doc.toString())) {
    if (isLive(item.from, item.to)) continue;
    builder.push(Decoration.replace({ widget: new MathWidget(item.source, item.display) })
      .range(item.from, item.to));
  }

  builder.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  const set = new RangeSetBuilder();
  for (const range of builder) set.add(range.from, range.to, range.value);
  return set.finish();
}

function livePreview(resolveSrc) {
  return ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = buildDecorations(view, resolveSrc); }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view, resolveSrc);
      }
    }
  }, {
    decorations: (plugin) => plugin.decorations,
    /* Widgets that replace text must not swallow clicks meant for the caret. */
    eventHandlers: {
      mousedown(event, view) {
        const widget = event.target.closest?.(".cm-live-image, .cm-live-math, .cm-live-rule");
        if (!widget) return false;
        const pos = view.posAtDOM(widget);
        view.dispatch({ selection: { anchor: pos } });
        view.focus();
        return true;
      },
    },
  });
}

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "var(--font-body)", lineHeight: "1.75", padding: "16px" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-line": { padding: "0" },
  ".cm-h1, .cm-h2, .cm-h3, .cm-h4, .cm-h5, .cm-h6": {
    fontFamily: "var(--font-display)", fontWeight: "600", lineHeight: "1.35",
  },
  ".cm-h1": { fontSize: "1.7em" },
  ".cm-h2": { fontSize: "1.4em", marginTop: "0.6em" },
  ".cm-h3": { fontSize: "1.15em", marginTop: "0.5em" },
  ".cm-live-image": { display: "inline-block", width: "min(100%, 560px)", verticalAlign: "top" },
  ".cm-live-image img": {
    display: "block", width: "100%", height: "auto",
    border: "1px solid var(--border-2)", borderRadius: "var(--r-sm)", background: "var(--surface-2)",
  },
  ".cm-live-caption": {
    display: "block", marginTop: "4px",
    fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)",
  },
  ".cm-live-math--block": { display: "block", textAlign: "center", padding: "6px 0" },
  ".cm-live-rule": {
    display: "block", height: "1px", background: "var(--border-2)", margin: "8px 0",
  },
  ".cm-live-bullet": { color: "var(--muted)" },
  ".cm-live-link": { color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "3px" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
}, { dark: false });

const highlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "600", color: "var(--ink)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.92em", color: "var(--accent-700)" },
  { tag: tags.quote, color: "var(--ink-2)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--muted)" },
  { tag: tags.link, color: "var(--accent)" },
]);

/* ---------- Public surface ----------
   Deliberately the same shape the textarea offered, so posts.js does not care
   which widget it is talking to. */
export function createLiveEditor({ parent, doc = "", onChange, onDrop, onPaste, resolveSrc }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(highlight),
        EditorView.lineWrapping,
        livePreview(resolveSrc),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) onChange();
        }),
        EditorView.domEventHandlers({
          drop(event) { return onDrop ? onDrop(event) : false; },
          paste(event) { return onPaste ? onPaste(event) : false; },
        }),
      ],
    }),
  });

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    insertAtCursor(text) {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    },
    focus: () => view.focus(),
  };
}
