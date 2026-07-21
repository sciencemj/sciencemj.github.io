(function (root, factory) {
  var model = typeof module === "object" && module.exports
    ? require("./editor-model.js")
    : root.AdminEditorModel;
  var api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminImageProcessor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Model) {
  "use strict";

  var WIDTH = 1280;
  var HEIGHT = 800;
  var MAX_BYTES = 180 * 1024;
  var TYPES = ["image/png", "image/jpeg", "image/webp"];
  var STEPS = [.82, .78, .74, .70, .66, .62, .58, .54, .50];

  function failure(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function qualitySteps() {
    return STEPS.slice();
  }

  function defaultCanvas(width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  async function defaultDecode(file, environment) {
    if (typeof createImageBitmap === "function") {
      var bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: function () { bitmap.close(); } };
    }
    var url = environment.createObjectURL(file);
    var image = new Image();
    await new Promise(function (resolve, reject) {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, url: url };
  }

  function encode(canvas, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/webp", quality);
    });
  }

  async function processImage(file, injected) {
    if (!file || TYPES.indexOf(file.type) === -1) {
      throw failure("unsupported-image-type", "Choose a PNG, JPEG, or WebP image.");
    }
    var environment = injected || {};
    environment.createCanvas = environment.createCanvas || defaultCanvas;
    environment.createObjectURL = environment.createObjectURL || URL.createObjectURL.bind(URL);
    environment.revokeObjectURL = environment.revokeObjectURL || URL.revokeObjectURL.bind(URL);
    var decoded;
    try {
      decoded = await (environment.decode || defaultDecode)(file, environment);
      if (!decoded || !decoded.source || !(decoded.width > 0) || !(decoded.height > 0)) throw new Error("invalid dimensions");
    } catch {
      throw failure("image-decode-failed", "Could not decode this image.");
    }

    try {
      var canvas = environment.createCanvas(WIDTH, HEIGHT);
      var context = canvas.getContext("2d");
      if (!context) throw failure("webp-encode-failed", "WebP encoding is unavailable.");
      var crop = Model.cropRect(decoded.width, decoded.height);
      context.drawImage(decoded.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, WIDTH, HEIGHT);

      var blob = null;
      for (var i = 0; i < STEPS.length; i += 1) {
        blob = await encode(canvas, STEPS[i]);
        if (!blob) throw failure("webp-encode-failed", "WebP encoding failed.");
        if (blob.size <= MAX_BYTES) {
          return {
            blob: blob,
            url: environment.createObjectURL(blob),
            width: WIDTH,
            height: HEIGHT,
            size: blob.size
          };
        }
      }
      throw failure("asset-too-large", "Image remains larger than 180KB after compression.");
    } catch (error) {
      if (error && error.code) throw error;
      throw failure("webp-encode-failed", "WebP encoding failed.");
    } finally {
      if (decoded.close) decoded.close();
      if (decoded.url) environment.revokeObjectURL(decoded.url);
    }
  }

  return { qualitySteps: qualitySteps, processImage: processImage };
});
