const { expect, test, describe } = require("bun:test");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const ROOT = resolve(import.meta.dir, "..");

function loadPosts() {
  const source = readFileSync(resolve(ROOT, "assets/js/posts.data.js"), "utf8");
  const scope = {};
  new Function("window", source)(scope);
  return scope.PORTFOLIO_POSTS;
}

describe("posts.data.js", () => {
  const posts = loadPosts();

  test("exports an array", () => {
    expect(Array.isArray(posts)).toBe(true);
  });

  test("every entry has a date, title and url", () => {
    posts.forEach((post, index) => {
      expect(post.date, `entry ${index}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof post.title, `entry ${index}`).toBe("string");
      expect(post.title.length, `entry ${index}`).toBeGreaterThan(0);
      expect(typeof post.url, `entry ${index}`).toBe("string");
    });
  });

  test("lang, when set, is one the renderer knows", () => {
    posts.forEach((post, index) => {
      if ("lang" in post) expect(["ko", "en"], `entry ${index}`).toContain(post.lang);
    });
  });

  test("internal urls point at files that exist", () => {
    posts
      .filter((post) => !/^https?:\/\//i.test(post.url))
      .forEach((post) => {
        expect(existsSync(resolve(ROOT, post.url)), `missing file for "${post.title}": ${post.url}`).toBe(true);
      });
  });

  test("entries are ordered newest first", () => {
    const dates = posts.map((post) => post.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
