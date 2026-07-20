import { describe, expect, test } from "bun:test";
import { cleanProjects, parseProjects, prepareProjects, serializeProjects, validateProjects } from "../admin/projects-store.js";

const project = {
  repo: "demo", report: "report.html", featured: true,
  highlight: "Concrete result.", categories: ["data-analysis", "visualization"],
  preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart" },
};

describe("admin project store", () => {
  test("round-trips living-data metadata", () => {
    expect(parseProjects(serializeProjects([project]))).toEqual([project]);
  });

  test("cleans known fields without deleting preview metadata", () => {
    expect(cleanProjects([{ ...project, report: " report.html " }])).toEqual([project]);
  });

  test("rejects unsafe preview paths", () => {
    const invalid = [{ ...project, preview: { kind: "chart", src: "../secret.webp", alt: "Bad" } }];
    expect(validateProjects(invalid)).toBe("preview src must be under assets/img/projects/");
  });

  test("rejects paths that become unsafe after trimming", () => {
    const invalid = [{ ...project, report: " /outside" }];
    expect(validateProjects(invalid)).toBe("invalid report path");
  });

  test("rejects a whitespace-only preview alt after trimming", () => {
    const invalid = [{ ...project, preview: { ...project.preview, alt: "  " } }];
    expect(validateProjects(invalid)).toBe("preview alt is required when src is set");
  });

  test("rejects preview paths with traversal segments", () => {
    const invalid = [{ ...project, preview: { ...project.preview, src: "assets/img/projects/../../secret.webp" } }];
    expect(validateProjects(invalid)).toBe("preview src must be under assets/img/projects/");
  });

  test.each([
    [{ ...project, report: 42 }, "invalid report path"],
    [{ ...project, categories: "apps" }, "invalid project category"],
    [{ ...project, preview: "bad" }, "invalid project preview"],
  ])("rejects malformed optional fields before cleaning", (invalid, error) => {
    expect(prepareProjects([invalid])).toEqual({ error });
  });

  test.each([
    ["report", false, "invalid report path"],
    ["report", null, "invalid report path"],
    ["report", {}, "invalid report path"],
    ["featured", 0, "invalid featured flag"],
    ["featured", "true", "invalid featured flag"],
    ["featured", null, "invalid featured flag"],
    ["highlight", false, "invalid project highlight"],
    ["highlight", 0, "invalid project highlight"],
    ["highlight", [], "invalid project highlight"],
    ["categories", false, "invalid project category"],
    ["categories", 0, "invalid project category"],
    ["categories", null, "invalid project category"],
    ["preview", false, "invalid project preview"],
    ["preview", 0, "invalid project preview"],
    ["preview", null, "invalid project preview"],
    ["preview", [], "invalid project preview"],
  ])("rejects present optional %s value %p without throwing", (field, value, error) => {
    const invalid = { ...project, [field]: value };
    expect(() => prepareProjects([invalid])).not.toThrow();
    expect(prepareProjects([invalid])).toEqual({ error });
  });

  test.each([
    ["kind", false, "invalid preview kind"],
    ["kind", 0, "invalid preview kind"],
    ["kind", null, "invalid preview kind"],
    ["kind", {}, "invalid preview kind"],
    ["src", false, "invalid preview src"],
    ["src", 0, "invalid preview src"],
    ["src", 42, "invalid preview src"],
    ["src", null, "invalid preview src"],
    ["src", {}, "invalid preview src"],
    ["src", [], "invalid preview src"],
    ["alt", false, "invalid preview alt"],
    ["alt", 0, "invalid preview alt"],
    ["alt", null, "invalid preview alt"],
    ["alt", {}, "invalid preview alt"],
    ["alt", [], "invalid preview alt"],
  ])("rejects present preview.%s value %p without throwing", (field, value, error) => {
    const invalid = { ...project, preview: { ...project.preview, [field]: value } };
    expect(() => prepareProjects([invalid])).not.toThrow();
    expect(prepareProjects([invalid])).toEqual({ error });
  });

  test("preserves omitted metadata and valid false or empty collection values", () => {
    expect(prepareProjects([{ repo: "minimal" }])).toEqual({ projects: [{ repo: "minimal" }] });
    expect(prepareProjects([{
      repo: "valid", featured: false, categories: [], preview: { kind: "workflow" },
    }])).toEqual({
      projects: [{ repo: "valid", featured: false, categories: [], preview: { kind: "workflow" } }],
    });
  });
});
