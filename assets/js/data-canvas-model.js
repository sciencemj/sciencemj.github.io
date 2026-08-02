(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DataCanvasModel = api;
})(typeof window !== "undefined" ? window : null, function () {
  var WIDTH = 560;
  var HEIGHT = 420;
  var SEED = 20260720;
  var CLUSTERS = [
    { x: 155, y: 250 },
    { x: 295, y: 165 },
    { x: 420, y: 275 },
  ];

  function clampProgress(value) {
    return Math.max(0, Math.min(1, value));
  }

  function interpolatePoint(from, to, progress) {
    var t = clampProgress(progress);
    function interpolate(value, target) {
      return Math.round((value + (target - value) * t) * 1e12) / 1e12;
    }
    return {
      x: interpolate(from.x, to.x),
      y: interpolate(from.y, to.y),
      opacity: interpolate(from.opacity, to.opacity),
    };
  }

  function generator() {
    var state = SEED;
    return function () {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function createScenes(count) {
    count = Math.max(0, Math.floor(Number(count) || 0));
    var random = generator();
    var raw = [];
    var pattern = [];
    var decision = [];

    for (var index = 0; index < count; index += 1) {
      raw.push({
        x: 45 + random() * (WIDTH - 90),
        y: 52 + random() * (HEIGHT - 114),
        opacity: .42 + random() * .48,
      });

      var cluster = CLUSTERS[index % CLUSTERS.length];
      pattern.push({
        x: cluster.x + (random() - .5) * 104,
        y: cluster.y + (random() - .5) * 84,
        opacity: .66 + random() * .3,
      });

      var x = count > 1 ? 45 + index * 470 / (count - 1) : WIDTH / 2;
      decision.push({
        x: x,
        y: 330 - .42 * x + (random() - .5) * 18,
        opacity: index % 7 === 0 ? .48 : .92,
      });
    }

    return { raw: raw, pattern: pattern, decision: decision };
  }

  return {
    clampProgress: clampProgress,
    interpolatePoint: interpolatePoint,
    createScenes: createScenes,
  };
});
