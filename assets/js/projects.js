/* Project cards render immediately from local configuration, then enrich with
   live GitHub metadata. No build, authentication, or runtime dependency. */
(function () {
  var OWNER = "sciencemj";
  var PROJECTS = window.PORTFOLIO_PROJECTS || [];
  var Model = window.PortfolioProjectModel;
  var View = window.PortfolioProjectView;
  if (!Model || !View) return;

  var grid = document.getElementById("project-grid");
  if (!grid) return;
  var filterBar = document.getElementById("project-filter");
  var active = [];

  function fetchRepo(project) {
    var cacheKey = "gh:" + OWNER + "/" + project.repo;
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) return Promise.resolve(JSON.parse(cached));
    } catch (error) {}
    return fetch("https://api.github.com/repos/" + OWNER + "/" + project.repo, {
      headers: { Accept: "application/vnd.github+json" },
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).then(function (data) {
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (error) {}
      return data;
    });
  }

  function updateGroupVisibility() {
    [".featured-projects__pair", ".compact-projects", ".featured-projects"].forEach(function (selector) {
      var group = grid.querySelector(selector);
      if (group) group.hidden = !group.querySelector(".project-card:not([hidden])");
    });
  }

  function applyFilters() {
    [].slice.call(grid.querySelectorAll(".project-card")).forEach(function (card) {
      var categories = (card.getAttribute("data-categories") || "").split("|").filter(Boolean);
      card.hidden = !Model.matchesAnyCategory({ categories: categories }, active);
    });
    updateGroupVisibility();
  }

  function drawFilters() {
    if (!filterBar) return;
    filterBar.innerHTML = View.renderFilters(active);
  }

  grid.innerHTML = View.renderProjectSections(PROJECTS, []);
  if (filterBar) {
    filterBar.innerHTML = View.renderFilters([]);
    filterBar.hidden = false;
    filterBar.addEventListener("click", function (event) {
      var button = event.target.closest(".filter-chip");
      if (!button) return;
      if (button.getAttribute("data-all")) active = [];
      else {
        var key = button.getAttribute("data-category");
        var index = active.indexOf(key);
        if (index > -1) active.splice(index, 1); else active.push(key);
      }
      drawFilters();
      applyFilters();
    });
  }

  Promise.all(PROJECTS.map(function (project) {
    return fetchRepo(project).then(function (data) { return data; }, function () { return null; });
  })).then(function (results) {
    grid.innerHTML = View.renderProjectSections(PROJECTS, results);
    grid.setAttribute("aria-busy", "false");
    applyFilters();
  });
})();
