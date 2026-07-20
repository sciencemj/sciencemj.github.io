import { describe, expect, test } from "bun:test";
import { cleanProjects, parseProjects, serializeProjects, validateProjects } from "../admin/projects-store.js";

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
});
