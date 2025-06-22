/// import * as Autodesk from "@types/forge-viewer";

async function getAccessToken(callback) {
  try {
    console.log("Requesting access token...");
    const resp = await fetch("/viewer/api/auth/token");
    if (!resp.ok) {
      console.error("Token request failed:", resp.status, resp.statusText);
      throw new Error(await resp.text());
    }
    const { access_token, expires_in } = await resp.json();
    console.log("Access token obtained successfully");
    callback(access_token, expires_in);
  } catch (err) {
    alert("Could not obtain access token. See the console for more details.");
    console.error("Token error:", err);
  }
}

export function initViewer(container) {
  return new Promise(function (resolve, reject) {
    console.log("Initializing Autodesk Viewer...");
    Autodesk.Viewing.Initializer(
      { env: "AutodeskProduction", getAccessToken },
      function () {
        const config = {
          extensions: ["Autodesk.DocumentBrowser"],
        };
        const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
        viewer.start();
        viewer.setTheme("light-theme");
        console.log("Viewer initialized successfully");
        resolve(viewer);
      }
    );
  });
}

export function loadModel(viewer, urn) {
  return new Promise(function (resolve, reject) {
    function onDocumentLoadSuccess(doc) {
      console.log("Document loaded successfully");
      resolve(viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()));
    }
    function onDocumentLoadFailure(code, message, errors) {
      console.error("Document load failed:", code, message, errors);
      reject({ code, message, errors });
    }
    console.log("Loading model with URN:", urn);
    viewer.setLightPreset(0);
    Autodesk.Viewing.Document.load(
      "urn:" + urn,
      onDocumentLoadSuccess,
      onDocumentLoadFailure
    );
  });
}
