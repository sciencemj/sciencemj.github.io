import { expect, test } from "bun:test";

const adminHtml = await Bun.file(new URL("../admin/index.html", import.meta.url)).text();

function buildPayloadFor(featured) {
  const start = adminHtml.indexOf("  function buildPayload() {");
  const end = adminHtml.indexOf("\n  saveBtn.addEventListener", start);
  const source = adminHtml.slice(start, end);
  return new Function("featured", source + "\nreturn buildPayload();")(featured);
}

test("admin save payload preserves opaque project metadata", () => {
  const project = {
    repo: "demo", report: " report.html ", featured: true,
    highlight: "Concrete result.", categories: ["data-analysis", "visualization"],
    preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart" },
  };

  expect(buildPayloadFor([project])).toEqual([{ ...project, report: "report.html" }]);
});
