import { describe, expect, test } from "bun:test";
import { promoteFigures, protect, render, restore, restoreCode, rewriteImages, wrapTables } from "../admin/markdown.js";

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Stand-in for marked. It mangles _ and * the way a real markdown parser would —
   which is the whole reason maths has to be lifted out first — and turns code
   fences into <pre><code>, so a test can tell whether code reached the parser. */
function fakeParse(text) {
  return text
    .replace(/```[a-z]*\n([\s\S]*?)```/g, (whole, code) => `<pre><code>${escape(code)}</code></pre>`)
    .replace(/`([^`\n]+)`/g, (whole, code) => `<code>${escape(code)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .split(/\n{2,}/)
    .map((block) => (block.trim() ? (/^<(pre|h\d)/.test(block.trim()) ? block.trim() : `<p>${block.trim()}</p>`) : ""))
    .join("\n");
}

describe("maths survives the markdown parser", () => {
  test("inline maths with underscores comes out untouched", () => {
    const html = render("The gradient is $\\delta_j a_i$ here.", { parse: fakeParse });
    expect(html).toContain("$\\delta_j a_i$");
    expect(html).not.toContain("<em>");
  });

  test("display maths survives", () => {
    const html = render("Before\n\n$$\\frac{\\partial L}{\\partial w_{ij}} = \\delta_j a_i$$\n\nAfter", { parse: fakeParse });
    expect(html).toContain("$$\\frac{\\partial L}{\\partial w_{ij}} = \\delta_j a_i$$");
  });

  test("emphasis outside maths still works", () => {
    expect(render("This is **bold** and $x_1$.", { parse: fakeParse })).toContain("<strong>bold</strong>");
  });

  test("a dollar sign inside code is not treated as maths", () => {
    const html = render("Run `echo $HOME` now.", { parse: fakeParse });
    expect(html).toContain("<code>echo $HOME</code>");
  });

  test("a lone dollar amount does not open a maths span", () => {
    expect(render("It cost $5 to run.", { parse: fakeParse })).toContain("$5 to run");
  });

  /* The bug this guards: code used to be handed back only after parsing, so a
     fence never became <pre><code> and KaTeX rendered the $x$ inside it. */
  test("fenced code reaches the parser and stays code", () => {
    const html = render("```python\na_b = $x$\n```", { parse: fakeParse });
    expect(html).toContain("<pre><code>");
    expect(html).toContain("a_b = $x$");
    expect(html).not.toContain("```");
  });

  test("inline code reaches the parser too", () => {
    expect(render("a `list_item` here", { parse: fakeParse })).toContain("<code>list_item</code>");
  });

  test("code is put back before parsing, maths after", () => {
    const { text, spans } = protect("`a_b` and $c_d$");
    expect(text).not.toContain("`");
    const beforeParse = restoreCode(text, spans);
    expect(beforeParse).toContain("`a_b`");
    expect(beforeParse).toContain("MATHPLACEHOLDER");
    expect(restore(beforeParse, spans)).toBe("`a_b` and $c_d$");
  });

  test("placeholders never leak into the output", () => {
    const html = render("$a_1$ and $$b_2$$ and `c_3`", { parse: fakeParse });
    expect(html).not.toContain("MATHPLACEHOLDER");
  });
});

describe("protect / restore", () => {
  test("restoring code then maths is the inverse of protect", () => {
    const source = "text $a_1$ more $$b_2$$ and `c` end";
    const { text, spans } = protect(source);
    expect(text).not.toContain("$");
    expect(text).not.toContain("`");
    expect(restore(restoreCode(text, spans), spans)).toBe(source);
  });

  test("restore leaves code placeholders alone, and vice versa", () => {
    const { text, spans } = protect("`a` $b$");
    expect(restore(text, spans)).toContain("MATHPLACEHOLDER");
    expect(restoreCode(text, spans)).toContain("MATHPLACEHOLDER");
  });
});

describe("html shaping", () => {
  test("a lone image becomes a figure with its alt as the caption", () => {
    const html = promoteFigures('<p><img src="assets/a-1.webp" alt="Loss curve"></p>');
    expect(html).toContain("<figure>");
    expect(html).toContain("<figcaption>Loss curve</figcaption>");
  });

  test("an image with text around it is left as a paragraph", () => {
    const html = promoteFigures('<p>see <img src="a.webp" alt="x"> here</p>');
    expect(html).not.toContain("<figure>");
  });

  test("an image without alt text gets no empty caption", () => {
    expect(promoteFigures('<p><img src="a.webp" alt=""></p>')).not.toContain("<figcaption>");
  });

  test("tables are wrapped so a wide one scrolls", () => {
    const html = wrapTables("<table><tr><td>1</td></tr></table>");
    expect(html).toBe('<div class="post-table-wrap"><table><tr><td>1</td></tr></table></div>');
  });

  test("image sources can be rewritten for the preview", () => {
    const html = rewriteImages('<img src="assets/a-1.webp">', (src) => "blob:" + src);
    expect(html).toBe('<img src="blob:assets/a-1.webp">');
  });

  test("rewriting is skipped when no resolver is given", () => {
    expect(rewriteImages('<img src="a.webp">')).toBe('<img src="a.webp">');
  });
});

describe("render without a parser", () => {
  test("fails loudly instead of writing an empty post", () => {
    expect(() => render("hi", { parse: null })).toThrow(/parser unavailable/);
  });
});
