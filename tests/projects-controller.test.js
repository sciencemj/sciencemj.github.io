const { describe, expect, test } = require("bun:test");
const Controller = require("../assets/js/projects.js");

describe("projects controller", () => {
  test("restores the focused project card after GitHub enrichment replaces the grid", async () => {
    let resolveFetch;
    let markup = "";
    let busy = "true";
    let focused = false;
    const oldCard = {
      closest(selector) { return selector === "[data-project-index]" ? this : null; },
      getAttribute(name) { return name === "data-project-index" ? "0" : null; },
    };
    const document = {
      activeElement: null,
      getElementById(id) { return id === "project-grid" ? grid : null; },
    };
    const newCard = {
      closest(selector) { return selector === "[data-project-index]" ? this : null; },
      getAttribute(name) { return name === "data-project-index" ? "0" : null; },
      focus() { focused = true; document.activeElement = this; },
    };
    const grid = {
      contains(node) {
        return (markup === "local" && node === oldCard) || (markup === "enriched" && node === newCard);
      },
      querySelector(selector) {
        return markup === "enriched" && selector === '[data-project-index="0"]' ? newCard : null;
      },
      querySelectorAll() { return []; },
      setAttribute(name, value) { if (name === "aria-busy") busy = value; },
      get innerHTML() { return markup; },
      set innerHTML(value) { markup = value; },
    };
    const root = {
      PORTFOLIO_PROJECTS: [{ repo: "demo" }],
      PortfolioProjectModel: { matchesAnyCategory() { return true; } },
      PortfolioProjectView: {
        renderProjectSections(projects, results) { return results[0] ? "enriched" : "local"; },
      },
      document,
      sessionStorage: { getItem() { return null; }, setItem() {} },
      fetch() { return new Promise((resolve) => { resolveFetch = resolve; }); },
    };

    Controller.start(root);
    expect(markup).toBe("local");
    document.activeElement = oldCard;
    resolveFetch({ ok: true, json: () => Promise.resolve({ html_url: "https://example.com/demo" }) });
    await Bun.sleep(0);

    expect(markup).toBe("enriched");
    expect(busy).toBe("false");
    expect(focused).toBe(true);
  });
});
