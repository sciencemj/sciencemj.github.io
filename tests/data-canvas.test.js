const { describe, expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const Model = require("../assets/js/data-canvas-model.js");

describe("data canvas model", () => {
  test("builds deterministic Raw, Pattern, Decision scenes", () => {
    const scenes = Model.createScenes(48);
    expect(Object.keys(scenes)).toEqual(["raw", "pattern", "decision"]);
    expect(scenes.raw).toHaveLength(48);
    expect(scenes.pattern).toHaveLength(48);
    expect(scenes.decision).toHaveLength(48);
    expect(Model.createScenes(48)).toEqual(scenes);
  });

  test("interpolates position and opacity", () => {
    expect(Model.interpolatePoint(
      { x: 0, y: 10, opacity: .2 },
      { x: 20, y: 30, opacity: 1 },
      .5
    )).toEqual({ x: 10, y: 20, opacity: .6 });
  });

  test("clamps progress", () => {
    expect(Model.clampProgress(-1)).toBe(0);
    expect(Model.clampProgress(2)).toBe(1);
  });
});

test("reduced motion renders Decision without registering listeners", () => {
  const source = readFileSync(resolve(import.meta.dir, "../assets/js/data-canvas.js"), "utf8");
  const circles = [];
  const listeners = [];
  const label = { textContent: "Decision" };
  const line = { style: {} };
  const zone = { style: {} };
  const layer = {
    textContent: "static points",
    appendChild(circle) { circles.push(circle); },
  };
  const hero = {
    querySelector(selector) { return selector === "[data-scene-label]" ? label : null; },
  };
  const svg = {
    closest() { return hero; },
    querySelector(selector) {
      return { ".data-points": layer, ".decision-line": line, ".decision-zone": zone }[selector];
    },
    addEventListener(name) { listeners.push(name); },
  };
  const document = {
    getElementById() { return svg; },
    createElementNS() {
      return { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } };
    },
  };
  let observers = 0;
  function IntersectionObserver() { observers += 1; }

  new Function(
    "window", "document", "matchMedia", "IntersectionObserver", "addEventListener", "requestAnimationFrame", source
  )(
    { DataCanvasModel: Model },
    document,
    () => ({ matches: true }),
    IntersectionObserver,
    (name) => listeners.push(name),
    () => { throw new Error("reduced motion must not queue animation frames"); }
  );

  expect(circles).toHaveLength(48);
  expect(label.textContent).toBe("Decision");
  expect(line.style.opacity).toBe("1");
  expect(zone.style.opacity).toBe("1");
  expect(listeners).toEqual([]);
  expect(observers).toBe(0);
});
