(function () {
  "use strict";

  var Model = window.AdminEditorModel;
  var Processor = window.AdminImageProcessor;
  var View = window.AdminEditorView;
  var state = {
    original: [], drafts: [], selectedIndex: 0, query: "", sourceMode: "upload",
    pendingUploads: new Map(), assetOptions: [], errors: {}, dirty: false, inFlight: false,
    owner: "", repositories: [], repositoryQuery: ""
  };

  var byId = function (id) { return document.getElementById(id); };
  var list = byId("project-list");
  var inspector = byId("project-inspector");
  var saveButton = byId("save-btn");
  var commitButton = byId("commit-btn");
  var dirtyIndicator = byId("dirty-indicator");
  var statusLive = byId("status-live");
  var errorLive = byId("error-live");
  var toastElement = byId("toast");
  var toastTimer;
  var draggedIndex = -1;

  function projectUpload(project) {
    return project ? state.pendingUploads.get(project.repo) : null;
  }

  function dirtyIndexes() {
    var indexes = [];
    state.drafts.forEach(function (project, index) {
      var before = state.original[index];
      if (!before || JSON.stringify(Model.buildPayload([before])) !== JSON.stringify(Model.buildPayload([project]))) indexes.push(index);
      else if (state.pendingUploads.has(project.repo)) indexes.push(index);
    });
    return indexes;
  }

  function refreshDirty() {
    state.dirty = dirtyIndexes().length > 0 || state.original.length !== state.drafts.length;
    dirtyIndicator.className = "save-state" + (state.dirty ? " is-dirty" : "");
    dirtyIndicator.lastElementChild.textContent = state.dirty ? "Unsaved changes" : "All changes saved";
    saveButton.disabled = state.inFlight || !state.dirty;
    commitButton.disabled = state.inFlight;
  }

  function renderSummary() {
    byId("change-summary").innerHTML = View.renderChangeSummary(Model.summarizeChanges(state.original, state.drafts, state.pendingUploads));
  }

  function renderList() {
    list.innerHTML = View.renderList(state.drafts, {
      selectedIndex: state.selectedIndex,
      query: state.query,
      uploads: state.pendingUploads,
      errors: state.errors,
      dirtyIndexes: dirtyIndexes()
    });
    byId("project-count").textContent = state.drafts.length;
  }

  function renderInspector(focusField) {
    var project = state.drafts[state.selectedIndex];
    var active = document.activeElement;
    var selectionStart = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    var selectionEnd = active && typeof active.selectionEnd === "number" ? active.selectionEnd : null;
    inspector.innerHTML = View.renderInspector(project, {
      index: state.selectedIndex,
      sourceMode: state.sourceMode,
      errors: state.errors[state.selectedIndex] || {},
      assets: state.assetOptions,
      upload: projectUpload(project)
    });
    if (focusField) {
      var next = inspector.querySelector('[data-field="' + focusField + '"]');
      if (next) {
        next.focus();
        if (selectionStart != null && next.setSelectionRange) next.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }

  function renderAll(focusField) {
    renderList();
    renderInspector(focusField);
    renderSummary();
    refreshDirty();
  }

  function announce(message, isError) {
    (isError ? errorLive : statusLive).textContent = message;
    toastElement.textContent = message;
    toastElement.className = "toast is-visible" + (isError ? " is-error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastElement.className = "toast"; }, isError ? 5200 : 2800);
  }

  function setInFlight(value) {
    state.inFlight = value;
    refreshDirty();
  }

  function updateProject(patch, focusField) {
    state.drafts = Model.updateProject(state.drafts, state.selectedIndex, patch);
    delete state.errors[state.selectedIndex];
    renderAll(focusField);
  }

  function updateField(field, value) {
    var project = state.drafts[state.selectedIndex];
    if (!project) return;
    if (field === "featured") {
      var result = Model.setFeatured(state.drafts, state.selectedIndex, value);
      state.drafts = result.projects;
      if (result.error) {
        state.errors[state.selectedIndex] = { featured: result.error };
        announce(result.error, true);
      } else delete state.errors[state.selectedIndex];
      renderAll("featured");
      return;
    }
    if (field.indexOf("preview.") === 0) {
      var previewKey = field.slice(8);
      var previewPatch = {};
      previewPatch[previewKey] = value;
      if (previewKey === "src" && state.pendingUploads.has(project.repo)) {
        URL.revokeObjectURL(state.pendingUploads.get(project.repo).url);
        state.pendingUploads.delete(project.repo);
      }
      updateProject({ preview: previewPatch }, field);
      return;
    }
    var patch = {};
    patch[field] = value;
    updateProject(patch, field);
  }

  function moveProject(from, to) {
    if (to < 0 || to >= state.drafts.length) return;
    state.drafts = Model.moveProject(state.drafts, from, to);
    if (state.selectedIndex === from) state.selectedIndex = to;
    else if (from < state.selectedIndex && to >= state.selectedIndex) state.selectedIndex -= 1;
    else if (from > state.selectedIndex && to <= state.selectedIndex) state.selectedIndex += 1;
    renderAll();
  }

  list.addEventListener("click", function (event) {
    var row = event.target.closest("[data-project-index]");
    if (!row) return;
    var index = Number(row.dataset.projectIndex);
    var action = event.target.closest("[data-action]");
    if (!action || action.dataset.action === "select-project") {
      state.selectedIndex = index;
      renderAll();
      return;
    }
    if (action.dataset.action === "move-up") moveProject(index, index - 1);
    if (action.dataset.action === "move-down") moveProject(index, index + 1);
  });

  list.addEventListener("dragstart", function (event) {
    var row = event.target.closest("[data-project-index]");
    if (!row) return;
    draggedIndex = Number(row.dataset.projectIndex);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(draggedIndex));
  });
  list.addEventListener("dragover", function (event) { if (event.target.closest("[data-project-index]")) event.preventDefault(); });
  list.addEventListener("drop", function (event) {
    var row = event.target.closest("[data-project-index]");
    if (!row || draggedIndex < 0) return;
    event.preventDefault();
    moveProject(draggedIndex, Number(row.dataset.projectIndex));
    draggedIndex = -1;
  });

  byId("project-search").addEventListener("input", function (event) {
    state.query = event.target.value;
    renderList();
  });

  inspector.addEventListener("input", function (event) {
    var field = event.target.dataset.field;
    if (!field || field === "upload" || event.target.type === "checkbox" || event.target.tagName === "SELECT") return;
    updateField(field, event.target.value);
  });

  inspector.addEventListener("change", function (event) {
    if (event.target.dataset.category) {
      var project = state.drafts[state.selectedIndex];
      var categories = project.categories.slice();
      var key = event.target.dataset.category;
      if (event.target.checked && categories.indexOf(key) === -1) categories.push(key);
      if (!event.target.checked) categories = categories.filter(function (item) { return item !== key; });
      updateProject({ categories: categories });
      return;
    }
    var field = event.target.dataset.field;
    if (field === "upload") processUpload(event.target.files && event.target.files[0]);
    else if (field === "featured") updateField(field, event.target.checked);
    else if (field && (event.target.tagName === "SELECT" || event.target.type === "checkbox")) updateField(field, event.target.value);
  });

  inspector.addEventListener("click", function (event) {
    var tab = event.target.closest("[data-source-mode]");
    if (!tab) return;
    state.sourceMode = tab.dataset.sourceMode;
    renderInspector();
  });

  inspector.addEventListener("dragenter", function (event) {
    var zone = event.target.closest("[data-dropzone]");
    if (zone) { event.preventDefault(); zone.classList.add("is-dragging"); }
  });
  inspector.addEventListener("dragover", function (event) { if (event.target.closest("[data-dropzone]")) event.preventDefault(); });
  inspector.addEventListener("dragleave", function (event) {
    var zone = event.target.closest("[data-dropzone]");
    if (zone) zone.classList.remove("is-dragging");
  });
  inspector.addEventListener("drop", function (event) {
    var zone = event.target.closest("[data-dropzone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("is-dragging");
    processUpload(event.dataTransfer.files && event.dataTransfer.files[0]);
  });

  async function processUpload(file) {
    if (!file || state.inFlight) return;
    var project = state.drafts[state.selectedIndex];
    setInFlight(true);
    try {
      var result = await Processor.processImage(file);
      var previous = state.pendingUploads.get(project.repo);
      if (previous) URL.revokeObjectURL(previous.url);
      var target = Model.targetPathFor(project);
      var projectIndex = state.drafts.findIndex(function (draft) { return draft.repo === project.repo; });
      if (projectIndex < 0) {
        URL.revokeObjectURL(result.url);
        throw new Error("Project was removed while processing its image.");
      }
      state.pendingUploads.set(project.repo, Object.assign({}, result, { target: target }));
      state.drafts = Model.updateProject(state.drafts, projectIndex, { preview: { src: target } });
      delete state.errors[projectIndex];
      if (state.selectedIndex === projectIndex) state.sourceMode = "upload";
      announce("Image ready: 1280 × 800, " + (result.size / 1024).toFixed(1) + "KB.", false);
    } catch (error) {
      announce(error.message || "Image processing failed.", true);
    } finally {
      setInFlight(false);
      renderAll();
    }
  }

  function firstError(errors) {
    var indexes = Object.keys(errors);
    if (!indexes.length) return null;
    var index = Number(indexes[0]);
    var field = Object.keys(errors[index])[0];
    return { index: index, field: field };
  }

  saveButton.addEventListener("click", async function () {
    if (state.inFlight || !state.dirty) return;
    state.errors = Model.validateDrafts(state.drafts);
    var invalid = firstError(state.errors);
    if (invalid) {
      state.selectedIndex = invalid.index;
      renderAll();
      var target = inspector.querySelector('[data-field="' + invalid.field + '"]') || inspector.querySelector("[data-category]");
      if (target) target.focus();
      announce("Fix highlighted fields before saving.", true);
      return;
    }

    setInFlight(true);
    var projects = Model.buildPayload(state.drafts);
    var options = { method: "POST" };
    var errorFocus = null;
    if (state.pendingUploads.size) {
      var body = new FormData();
      body.set("projects", JSON.stringify(projects));
      state.pendingUploads.forEach(function (upload, repo) {
        var filename = upload.target.split("/").pop();
        body.set("asset:" + repo, new File([upload.blob], filename, { type: "image/webp" }));
      });
      options.body = body;
    } else {
      options.headers = { "content-type": "application/json" };
      options.body = JSON.stringify({ projects: projects });
    }

    try {
      var response = await fetch("/api/save", options);
      var result = await response.json();
      if (!response.ok || !result.ok) throw Object.assign(new Error(result.error || "Save failed."), result);
      state.pendingUploads.forEach(function (upload) { URL.revokeObjectURL(upload.url); });
      state.pendingUploads.clear();
      state.drafts = Model.normalizeDrafts(projects);
      state.original = Model.normalizeDrafts(projects);
      state.errors = {};
      await loadAssets();
      announce("Saved " + result.count + " projects, " + result.savedAssets.length + " images; " + result.archivedAssets.length + " archived.", false);
    } catch (error) {
      var errorIndex = error.repo
        ? state.drafts.findIndex(function (project) { return project.repo === error.repo; })
        : state.selectedIndex;
      if (error.field && errorIndex >= 0) {
        state.selectedIndex = errorIndex;
        state.errors[errorIndex] = state.errors[errorIndex] || {};
        state.errors[errorIndex][error.field] = error.message;
        errorFocus = error.field;
        if (error.field === "preview" && !state.pendingUploads.has(state.drafts[errorIndex].repo)) state.sourceMode = "existing";
      }
      announce(error.message || "Save failed.", true);
    } finally {
      setInFlight(false);
      renderAll();
      if (errorFocus) {
        var focusTarget = errorFocus === "preview"
          ? inspector.querySelector(state.sourceMode === "upload" ? '[data-field="upload"]' : '[data-field="preview.src"]')
          : inspector.querySelector('[data-field="' + errorFocus + '"]');
        if (focusTarget) focusTarget.focus();
      }
    }
  });

  function renderGitLog(steps) {
    var log = byId("gitlog");
    log.hidden = false;
    log.textContent = (steps || []).map(function (step) {
      return "$ " + step.cmd + "\nexit " + step.code + (step.output ? "\n" + step.output : "");
    }).join("\n\n");
  }

  commitButton.addEventListener("click", async function () {
    if (state.inFlight) return;
    var summary = Model.summarizeChanges(state.original, state.drafts, state.pendingUploads);
    var message = "Update portfolio projects";
    if (!confirm("Commit active project metadata and previews, then push?\n\nLocal archive stays untracked.\nMessage: \"" + message + "\"\nPending editor changes: " + summary.changedProjects)) return;
    setInFlight(true);
    try {
      var response = await fetch("/api/git", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: message }) });
      var result = await response.json();
      if (result.ok) {
        byId("gitlog").hidden = true;
        announce("Committed and pushed active project files.", false);
      } else if (result.nothingToCommit) announce("Nothing to commit. Save editor changes first.", true);
      else { renderGitLog(result.steps); announce("Commit or push failed. Review command log.", true); }
    } catch (error) {
      announce("Git request failed: " + error.message, true);
    } finally {
      setInFlight(false);
    }
  });

  function syncTheme() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var label = dark ? "Switch to light theme" : "Switch to dark theme";
    var button = byId("theme-toggle");
    button.setAttribute("aria-label", label);
    button.title = label;
    button.firstElementChild.textContent = dark ? "☀" : "◐";
  }

  byId("theme-toggle").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (error) {}
    syncTheme();
  });

  function renderRepositories() {
    var query = state.repositoryQuery.trim().toLowerCase();
    var added = new Set(state.drafts.map(function (project) { return project.repo; }));
    var matches = state.repositories.filter(function (repo) {
      return !query || [repo.name, repo.description, repo.language].some(function (value) { return String(value || "").toLowerCase().indexOf(query) > -1; });
    });
    byId("repository-list").innerHTML = matches.length ? matches.map(function (repo, index) {
      return '<article class="repository-row"><div><strong>' + View.esc(repo.name) + '</strong><p>' + View.esc(repo.description || repo.language || "No description") + '</p></div>' +
        '<button type="button" class="button button-secondary" data-add-repo="' + index + '"' + (added.has(repo.name) ? " disabled" : "") + '>' + (added.has(repo.name) ? "Added" : "Add") + '</button></article>';
    }).join("") : '<p class="empty-state">No repositories match this search.</p>';
    byId("repository-list").dataset.matches = JSON.stringify(matches.map(function (repo) { return state.repositories.indexOf(repo); }));
  }

  async function loadRepositories() {
    byId("repository-list").innerHTML = '<p class="empty-state">Loading repositories…</p>';
    try {
      var response = await fetch("https://api.github.com/users/" + encodeURIComponent(state.owner) + "/repos?per_page=100&sort=pushed", { headers: { accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error("GitHub returned " + response.status);
      state.repositories = await response.json();
      renderRepositories();
    } catch (error) {
      byId("repository-list").innerHTML = '<p class="empty-state">Could not load GitHub repositories. Existing projects remain editable.</p>';
      announce(error.message, true);
    }
  }

  byId("add-project-btn").addEventListener("click", function () {
    byId("add-project-dialog").showModal();
    if (!state.repositories.length) loadRepositories();
  });
  byId("repo-search").addEventListener("input", function (event) { state.repositoryQuery = event.target.value; renderRepositories(); });
  byId("repository-list").addEventListener("click", function (event) {
    var button = event.target.closest("[data-add-repo]");
    if (!button) return;
    var matches = JSON.parse(byId("repository-list").dataset.matches || "[]");
    var repo = state.repositories[matches[Number(button.dataset.addRepo)]];
    if (!repo) return;
    state.drafts = state.drafts.concat([Model.draftFromRepository(repo)]);
    state.selectedIndex = state.drafts.length - 1;
    state.sourceMode = "upload";
    byId("add-project-dialog").close();
    renderAll();
    announce("Added " + repo.name + ". Choose categories before saving.", false);
  });

  async function loadAssets() {
    var response = await fetch("/api/assets");
    var data = await response.json();
    state.assetOptions = Array.isArray(data.assets) ? data.assets : [];
  }

  async function boot() {
    try {
      var responses = await Promise.all([fetch("/api/projects"), fetch("/api/assets")]);
      var projectData = await responses[0].json();
      var assetData = await responses[1].json();
      state.owner = projectData.owner || "";
      state.original = Model.normalizeDrafts(projectData.projects || []);
      state.drafts = Model.normalizeDrafts(projectData.projects || []);
      state.assetOptions = assetData.assets || [];
      byId("owner-sub").textContent = "@" + state.owner + " · " + state.drafts.length + " projects";
      renderAll();
      syncTheme();
    } catch (error) {
      announce("Could not load project editor: " + error.message, true);
    }
  }

  window.addEventListener("beforeunload", function (event) {
    if (state.dirty) { event.preventDefault(); event.returnValue = ""; }
  });

  boot();
})();
