(function () {
  var Model = window.DataCanvasModel;
  var svg = document.getElementById("data-canvas");
  if (!Model || !svg) return;

  var hero = svg.closest(".hero");
  var layer = svg.querySelector(".data-points");
  var label = hero.querySelector("[data-scene-label]");
  var line = svg.querySelector(".decision-line");
  var zone = svg.querySelector(".decision-zone");
  var scenes = Model.createScenes(48);

  layer.textContent = "";
  var circles = scenes.raw.map(function (_, index) {
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "data-point data-point--" + (index % 3));
    circle.setAttribute("r", index % 5 === 0 ? "5" : "3.5");
    layer.appendChild(circle);
    return circle;
  });

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var visible = true;
  var frame = 0;
  var progress = reduced ? 1 : 0;
  var pointer = null;

  function pointFor(index) {
    if (progress < .5) {
      return Model.interpolatePoint(scenes.raw[index], scenes.pattern[index], progress * 2);
    }
    return Model.interpolatePoint(scenes.pattern[index], scenes.decision[index], (progress - .5) * 2);
  }

  function render() {
    circles.forEach(function (circle, index) {
      var point = pointFor(index);
      var dx = 0;
      var dy = 0;

      if (pointer) {
        var px = point.x - pointer.x;
        var py = point.y - pointer.y;
        var distance = Math.sqrt(px * px + py * py) || 1;
        if (distance < 90) {
          var force = 8 * (1 - distance / 90);
          dx = px / distance * force;
          dy = py / distance * force;
        }
      }

      circle.setAttribute("cx", (point.x + dx).toFixed(2));
      circle.setAttribute("cy", (point.y + dy).toFixed(2));
      circle.setAttribute("opacity", point.opacity.toFixed(2));
    });

    label.textContent = progress < .34 ? "Raw" : progress < .68 ? "Pattern" : "Decision";
    line.style.opacity = progress >= 1 ? "1" : progress > .68 ? String((progress - .68) / .32) : "0";
    zone.style.opacity = progress >= 1 ? "1" : progress > .82 ? String((progress - .82) / .18) : "0";
  }

  function requestRender() {
    if (!visible || frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      render();
    });
  }

  render();
  if (reduced) return;

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) requestRender();
  }).observe(hero);

  addEventListener("scroll", function () {
    var rect = hero.getBoundingClientRect();
    progress = Model.clampProgress((64 - rect.top) / Math.max(1, rect.height * .55));
    requestRender();
  }, { passive: true });

  svg.addEventListener("pointermove", function (event) {
    var rect = svg.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) * 560 / rect.width,
      y: (event.clientY - rect.top) * 420 / rect.height,
    };
    requestRender();
  });

  svg.addEventListener("pointerleave", function () {
    pointer = null;
    requestRender();
  });
})();
