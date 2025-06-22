const express = require("express");
const multer = require("multer");
const {
  getViewerToken,
  ensureBucketExists,
  listObjects,
  uploadObject,
  translateObject,
  getManifest,
  urnify,
} = require("../services/aps.js");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Viewer ana sayfasını serve et
router.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public/viewer" });
});

// API: Get viewer token
router.get("/api/auth/token", async (req, res, next) => {
  try {
    const token = await getViewerToken();
    res.json(token);
  } catch (err) {
    next(err);
  }
});

// API: Get models
router.get("/api/models", async (req, res, next) => {
  try {
    const objects = await listObjects();
    res.json(
      objects.map((o) => ({
        name: o.objectKey,
        urn: urnify(o.objectId),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// API: Upload model
router.post(
  "/api/models",
  upload.single("model-file"),
  async (req, res, next) => {
    try {
      // Upload to OSS
      const obj = await uploadObject(req.file.originalname, req.file.path);

      // Start translation - ZIP dosyaları için özel işleme
      let rootFilename = null;
      if (req.file.originalname.toLowerCase().endsWith(".zip")) {
        rootFilename = req.body["model-zip-entrypoint"] || null;
      }

      await translateObject(obj.objectId, rootFilename);

      // Response için encode et
      const responseUrn = urnify(obj.objectId);

      res.json({
        name: req.file.originalname,
        urn: responseUrn,
      });
    } catch (err) {
      console.error("Upload error:", err);
      next(err);
    }
  }
);

// API: Get model status
router.get("/api/models/:urn/status", async (req, res, next) => {
  try {
    const manifest = await getManifest(req.params.urn);
    if (manifest) {
      let messages = [];
      if (manifest.derivatives) {
        for (const derivative of manifest.derivatives) {
          messages = messages.concat(derivative.messages || []);
          if (derivative.children) {
            for (const child of derivative.children) {
              messages = messages.concat(child.messages || []);
            }
          }
        }
      }
      res.json({
        status: manifest.status,
        progress: manifest.progress,
        messages,
      });
    } else {
      res.json({ status: "n/a" });
    }
  } catch (err) {
    next(err);
  }
});

// Static files için viewer klasörü
router.use("/css", express.static("./public/viewer"));
router.use("/js", express.static("./public/viewer"));

module.exports = router;
