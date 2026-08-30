/* Language toggle — English/Korean, persisted. English is the default and
   nothing is read from navigator.language, so a first visit always lands in
   English no matter where the reader is.

   Contract with the markup:
     data-i18n="key"                     -> textContent
     data-i18n-html="key"                -> innerHTML, for copy with inline markup
     data-i18n-attr="aria-label:key;..." -> attributes, ';'-separated name:key pairs

   Only page copy lives here. Dates and list labels that pages.js composes stay
   in pages.js, and the project/post data files are never translated — their
   titles and summaries are the author's own words in whichever language he
   wrote them. tests/page-contract checks that every key used in the four pages
   exists in both tables, so a typo fails the tests instead of shipping a blank
   element. */
(function (root) {
  var doc = root.document;
  var KEY = "lang";
  var FALLBACK = "en";

  var STRINGS = {
    en: {
      "skip": "Skip to content",
      "brand.aria": "MJ Park — home",
      "nav.writing": "Writing",
      "nav.projects": "Projects",
      "nav.contact": "Contact",
      "link.email": "Email",

      "title.home": "MJ Park — Data & ML portfolio",
      "desc.home": "MJ Park — Business × Computer Science student working on analytics, machine learning, and data storytelling.",
      "title.writing": "Writing — MJ Park",
      "desc.writing": "Posts and talks by MJ Park on analytics, NLP, and forecasting.",
      "title.projects": "Projects — MJ Park",
      "desc.projects": "Data analysis, ML and tooling projects by MJ Park.",
      "title.contact": "Contact — MJ Park",
      "desc.contact": "How to reach MJ Park.",

      "profile.name": "MJ Park",
      "profile.role": "Business × Computer Science · Korea University",
      "profile.bio1": "I work on the seam between analytics and decisions — cleaning messy data, finding the question underneath it, and shipping something a non-analyst can act on. Most of my work lands as a written report rather than a model file.",
      "profile.bio2": "Currently focused on NLP over user reviews, demand forecasting, and making analysis reproducible enough that someone else can rerun it.",
      "rail.title": "Elsewhere",

      "sec.writing": "Writing",
      "sec.background": "Education & Experience",
      "sec.projects": "Projects",
      "more.writing": "All writing →",
      "more.projects": "All projects →",

      "edu.when": "2024<br>– present",
      "edu.title": "B.A. Business Administration, B.S. Computer Science",
      "edu.org": "Korea University · Seoul, Korea",

      "page.writing.lead": "Posts and talks — mostly write-ups of analyses I ran, and the parts that did not work the first time.",
      "page.projects.lead": "Analyses, models and small tools. Titles, languages and update times come live from the GitHub API; the one-line summaries are mine.",
      "page.contact.lead": "Email is the fastest way to reach me. I read everything and usually reply within a couple of days.",

      "contact.basedin": "Based in",
      "contact.email.desc": "Best for anything with detail — a dataset, a question, a role.",
      "contact.github.desc": "Code, notebooks and the reports behind the projects.",
      "contact.linkedin.desc": "Background and roles, in the shortest form.",
      "contact.city": "Seoul, Korea",
      "contact.tz": "KST (UTC+9). Remote is fine.",

      "row.report": "Report",
      "row.code": "Code",
      "row.post": "Post",
      "row.talk": "Talk",
    },
    ko: {
      "skip": "본문으로 건너뛰기",
      "brand.aria": "박민준 — 홈",
      "nav.writing": "글",
      "nav.projects": "프로젝트",
      "nav.contact": "연락처",
      "link.email": "이메일",

      "title.home": "박민준 — 데이터 · ML 포트폴리오",
      "desc.home": "박민준 — 분석, 머신러닝, 데이터 스토리텔링을 다루는 경영학 × 컴퓨터학 전공 학생.",
      "title.writing": "글 — 박민준",
      "desc.writing": "분석, NLP, 예측을 주제로 박민준이 쓴 글과 발표.",
      "title.projects": "프로젝트 — 박민준",
      "desc.projects": "박민준의 데이터 분석 · 머신러닝 · 도구 프로젝트.",
      "title.contact": "연락처 — 박민준",
      "desc.contact": "박민준에게 연락하는 방법.",

      "profile.name": "박민준",
      "profile.role": "경영학 × 컴퓨터학 · 고려대학교",
      "profile.bio1": "분석과 의사결정이 맞닿는 지점에서 일합니다. 지저분한 데이터를 정리하고, 그 아래 깔린 진짜 질문을 찾아, 분석가가 아닌 사람도 바로 움직일 수 있는 형태로 내놓습니다. 결과물은 모델 파일보다 글로 된 리포트인 쪽이 많습니다.",
      "profile.bio2": "요즘은 사용자 리뷰 NLP, 수요 예측, 그리고 남이 그대로 다시 돌려볼 수 있을 만큼 재현 가능한 분석에 집중하고 있습니다.",
      "rail.title": "다른 곳에서",

      "sec.writing": "글",
      "sec.background": "학력 · 경력",
      "sec.projects": "프로젝트",
      "more.writing": "글 전체 보기 →",
      "more.projects": "프로젝트 전체 보기 →",

      "edu.when": "2024<br>– 현재",
      "edu.title": "경영학 학사 · 컴퓨터학 학사",
      "edu.org": "고려대학교 · 서울",

      "page.writing.lead": "글과 발표 — 대부분 직접 돌린 분석을 정리한 것이고, 처음에 잘 풀리지 않았던 부분도 같이 적었습니다.",
      "page.projects.lead": "분석, 모델, 작은 도구들. 제목과 언어, 업데이트 시각은 GitHub API에서 바로 가져오고, 한 줄 요약은 직접 씁니다.",
      "page.contact.lead": "이메일이 제일 빠릅니다. 온 메일은 다 읽고 보통 이틀 안에 답합니다.",

      "contact.basedin": "거주지",
      "contact.email.desc": "데이터셋이든 질문이든 채용이든, 내용이 있는 이야기는 여기로.",
      "contact.github.desc": "코드와 노트북, 프로젝트 뒤에 있는 리포트.",
      "contact.linkedin.desc": "이력과 역할을 가장 짧게 정리한 곳.",
      "contact.city": "서울, 대한민국",
      "contact.tz": "KST (UTC+9). 원격도 괜찮습니다.",

      "row.report": "리포트",
      "row.code": "코드",
      "row.post": "글",
      "row.talk": "발표",
    },
  };

  /* Same rule the theme button follows — name the destination, not the current
     state — except the label is written in the language it switches to. */
  var BUTTON = {
    en: { text: "KO", label: "한국어로 보기" },
    ko: { text: "EN", label: "Switch to English" },
  };

  function stored() {
    try {
      var saved = root.localStorage.getItem(KEY);
      return saved === "ko" || saved === "en" ? saved : FALLBACK;
    } catch (error) {
      return FALLBACK;
    }
  }

  var current = stored();
  var listeners = [];

  function t(key) {
    var value = (STRINGS[current] || {})[key];
    return value == null ? STRINGS[FALLBACK][key] || "" : value;
  }

  function each(list, visit) {
    Array.prototype.forEach.call(list || [], visit);
  }

  function applyAttrs(node) {
    String(node.getAttribute("data-i18n-attr")).split(";").forEach(function (pair) {
      var split = pair.indexOf(":");
      if (split < 0) return;
      var name = pair.slice(0, split).trim();
      var key = pair.slice(split + 1).trim();
      if (name && key) node.setAttribute(name, t(key));
    });
  }

  function apply() {
    if (doc.documentElement) doc.documentElement.setAttribute("lang", current);
    each(doc.querySelectorAll("[data-i18n]"), function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    each(doc.querySelectorAll("[data-i18n-html]"), function (node) {
      node.innerHTML = t(node.getAttribute("data-i18n-html"));
    });
    each(doc.querySelectorAll("[data-i18n-attr]"), applyAttrs);
  }

  function sync(btn) {
    if (!btn) return;
    var face = BUTTON[current] || BUTTON[FALLBACK];
    btn.textContent = face.text;
    btn.setAttribute("aria-label", face.label);
    btn.setAttribute("title", face.label);
  }

  function init() {
    apply();
    var btn = doc.getElementById("lang-toggle");
    sync(btn);
    if (!btn) return;
    btn.addEventListener("click", function () {
      current = current === "ko" ? "en" : "ko";
      try { root.localStorage.setItem(KEY, current); } catch (error) {}
      apply();
      sync(btn);
      listeners.forEach(function (listener) { listener(current); });
    });
  }

  root.PortfolioI18n = {
    lang: function () { return current; },
    t: t,
    keys: function (lang) { return Object.keys(STRINGS[lang === "ko" ? "ko" : "en"]); },
    /* pages.js redraws its lists from here; the rows are rebuilt wholesale, so
       they carry no data-i18n of their own. */
    onChange: function (listener) { if (typeof listener === "function") listeners.push(listener); },
  };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
