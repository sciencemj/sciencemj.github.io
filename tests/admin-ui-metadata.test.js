import { expect, test } from "bun:test";
import Model from "../admin/editor-model.js";

test("admin save payload preserves opaque project metadata", () => {
  const project = {
    repo: "demo", report: " report.html ", featured: true,
    highlight: "Concrete result.", categories: ["data-analysis", "visualization"],
    preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart" },
  };

  expect(Model.buildPayload([project])).toEqual([{ ...project, report: "report.html" }]);
});
