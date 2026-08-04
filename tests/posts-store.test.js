import { describe, expect, test } from "bun:test";
import {
  cleanMeta, fullDate, metaError, parsePosts, postUrl, renderPostPage, serializePosts, slugError, upsertPost,
} from "../admin/posts-store.js";

const META = {
  slug: "backpropagation", title: "역전파의 원리", date: "2026-08-04",
  kind: "Post", lang: "ko", lead: "체인 룰이 왜 그렇게 생겼는지.", tags: ["Deep learning"],
};

describe("posts.data.js round trip", () => {
  test("serialize then parse returns the same entries", () => {
    const posts = [{ date: "2026-08-04", kind: "Post", lang: "ko", title: "A", url: "posts/a.html" }];
    expect(parsePosts(serializePosts(posts))).toEqual(posts);
  });

  test("the serialized file still declares the global the site reads", () => {
    expect(serializePosts([])).toContain("window.PORTFOLIO_POSTS = [");
  });

  test("parsing a file without the global yields an empty list", () => {
    expect(parsePosts("var x = 1;")).toEqual([]);
  });
});

describe("validation", () => {
  test("slugs are lowercase, digits and inner hyphens", () => {
    expect(slugError("back-prop-2")).toBeNull();
    expect(slugError("Back-Prop")).not.toBeNull();
    expect(slugError("-lead")).not.toBeNull();
    expect(slugError("trail-")).not.toBeNull();
    expect(slugError("../escape")).not.toBeNull();
    expect(slugError("")).not.toBeNull();
    expect(slugError("a".repeat(61))).not.toBeNull();
  });

  test("accepts a complete post", () => {
    expect(metaError(META)).toBeNull();
  });

  test("rejects bad dates, kinds, languages and tag counts", () => {
    expect(metaError({ ...META, date: "2026-8-4" })).not.toBeNull();
    expect(metaError({ ...META, date: "2026-13-01" })).not.toBeNull();
    expect(metaError({ ...META, kind: "Essay" })).not.toBeNull();
    expect(metaError({ ...META, lang: "jp" })).not.toBeNull();
    expect(metaError({ ...META, title: "  " })).not.toBeNull();
    expect(metaError({ ...META, tags: ["a", "b", "c", "d"] })).not.toBeNull();
  });
});

describe("upsertPost", () => {
  test("replaces the entry for the same slug instead of duplicating it", () => {
    const first = upsertPost([], cleanMeta(META));
    const second = upsertPost(first, cleanMeta({ ...META, title: "Renamed" }));
    expect(second).toHaveLength(1);
    expect(second[0].title).toBe("Renamed");
    expect(second[0].url).toBe(postUrl(META.slug));
  });

  test("keeps the list newest first", () => {
    let posts = upsertPost([], cleanMeta({ ...META, slug: "old", date: "2025-01-01" }));
    posts = upsertPost(posts, cleanMeta({ ...META, slug: "new", date: "2026-08-04" }));
    expect(posts.map((post) => post.date)).toEqual(["2026-08-04", "2025-01-01"]);
  });

  test("omits tags when there are none", () => {
    const posts = upsertPost([], cleanMeta({ ...META, tags: [] }));
    expect("tags" in posts[0]).toBe(false);
  });
});

describe("renderPostPage", () => {
  const template = [
    "<!-- Post shell. Instructions that must not ship. -->",
    '<html lang="{{LANG}}">',
    "<title>{{TITLE}} — MJ Park</title>",
    '<meta name="description" content="{{DESCRIPTION}}">',
    '<div class="post-meta">{{META}}</div>',
    '<h1 class="post-title">{{TITLE}}</h1>',
    '<p class="post-lead">{{LEAD}}</p>',
    '<p class="post-date"><time datetime="{{DATE_ISO}}">{{DATE_FULL}}</time></p>',
    '<article class="post-body">',
    "{{BODY}}",
    "</article>",
  ].join("\n");

  test("fills every token and leaves none behind", () => {
    const page = renderPostPage(template, cleanMeta(META), "<p>Body</p>");
    expect(page).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(page).toContain('<html lang="ko">');
    expect(page).toContain("<p>Body</p>");
    expect(page).toContain("Deep learning");
  });

  test("puts the exact day under the title, machine-readable", () => {
    const page = renderPostPage(template, cleanMeta(META), "<p>x</p>");
    expect(page).toContain('<time datetime="2026-08-04">2026년 8월 4일</time>');
    /* The strip above the title no longer repeats it. */
    expect(page.slice(0, page.indexOf("post-title"))).not.toContain("Aug 2026");
  });

  test("drops the shell's own instructions", () => {
    expect(renderPostPage(template, cleanMeta(META), "<p>x</p>")).not.toContain("Post shell.");
  });

  test("escapes metadata so a quote in a title cannot break an attribute", () => {
    const page = renderPostPage(template, cleanMeta({ ...META, title: 'A "quoted" <b>title</b>' }), "<p>x</p>");
    expect(page).toContain("&quot;quoted&quot;");
    expect(page).toContain("&lt;b&gt;");
    expect(page).not.toContain("<b>title</b>");
  });

  test("body html is inserted as markup, not escaped", () => {
    expect(renderPostPage(template, cleanMeta(META), "<h2>Heading</h2>")).toContain("<h2>Heading</h2>");
  });

  test("an empty lead leaves no empty paragraph behind", () => {
    const page = renderPostPage(template, cleanMeta({ ...META, lead: "" }), "<p>x</p>");
    expect(page).not.toContain('<p class="post-lead"></p>');
  });

  test("falls back to the lead, then the title, for the description", () => {
    expect(renderPostPage(template, cleanMeta(META), "<p>x</p>")).toContain(META.lead);
    const bare = cleanMeta({ ...META, lead: "", description: "" });
    expect(renderPostPage(template, bare, "<p>x</p>")).toContain(META.title);
  });
});

describe("fullDate", () => {
  test("writes the day the way the post's language writes it", () => {
    expect(fullDate("2026-08-04", "ko")).toBe("2026년 8월 4일");
    expect(fullDate("2026-08-04", "en")).toBe("4 Aug 2026");
    expect(fullDate("2026-12-25", "ko")).toBe("2026년 12월 25일");
  });

  test("returns nothing for a date it cannot read", () => {
    expect(fullDate("2026-08", "ko")).toBe("");
    expect(fullDate("", "ko")).toBe("");
    expect(fullDate("2026-13-01", "ko")).toBe("");
  });
});

describe("the real shell", () => {
  test("carries every token renderPostPage fills", async () => {
    const shell = await Bun.file(new URL("../templates/post-template.html", import.meta.url)).text();
    for (const token of ["{{LANG}}", "{{TITLE}}", "{{DESCRIPTION}}", "{{META}}", "{{DATE_ISO}}", "{{DATE_FULL}}", "{{LEAD}}", "{{BODY}}"]) {
      expect(shell, `shell is missing ${token}`).toContain(token);
    }
    const page = renderPostPage(shell, cleanMeta(META), "<p>Body</p>");
    expect(page).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});
