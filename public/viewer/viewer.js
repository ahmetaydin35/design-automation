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
          extensions: [
            "Autodesk.DocumentBrowser",
            "Autodesk.ViewCubeUi",
            "Autodesk.DefaultTools.NavTools",
            "Autodesk.ModelStructure",
            "Autodesk.LayerManager",
            "Autodesk.Measure",
            "Autodesk.Section",
            "Autodesk.Explode",
          ],
        };
        const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
        viewer.start();
        viewer.setTheme("light-theme");

        // Viewer başladığında fit to view yap
        viewer.addEventListener(
          Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
          function () {
            console.log("🎛️ Geometry loaded - fitting to view");
            viewer.fitToView();
          }
        );

        console.log("Viewer initialized successfully with full toolbar");
        resolve(viewer);
      }
    );
  });
}

export function loadModel(viewer, urn) {
  return new Promise(function (resolve, reject) {
    function onDocumentLoadSuccess(doc) {
      console.log("Document loaded successfully");

      // İlk olarak default geometry'yi dene
      let modelToLoad = doc.getRoot().getDefaultGeometry();

      // Eğer default geometry yoksa, alternative viewable ara
      if (!modelToLoad) {
        console.log("No default geometry found, searching for viewables...");
        try {
          const viewables = doc.getRoot().search({ type: "geometry" });
          if (viewables && viewables.length > 0) {
            modelToLoad = viewables[0];
            console.log("Found viewable geometry:", modelToLoad);
          } else {
            // getChildren fonksiyonu güvenli kontrolü
            const root = doc.getRoot();
            if (root && typeof root.getChildren === "function") {
              const allChildren = root.getChildren();
              if (allChildren && allChildren.length > 0) {
                modelToLoad = allChildren[0];
                console.log("Using first child as viewable:", modelToLoad);
              }
            }
          }
        } catch (searchError) {
          console.log("Search failed, trying direct access:", searchError);
          // Son çare: document'in kendisini dene
          modelToLoad = doc.getRoot();
        }
      }

      if (modelToLoad) {
        viewer
          .loadDocumentNode(doc, modelToLoad)
          .then(() => {
            console.log("Model displayed in viewer successfully");
            resolve();
          })
          .catch((loadError) => {
            console.error("Failed to display model:", loadError);
            reject(loadError);
          });
      } else {
        const error = "No viewable content found in document";
        console.error(error);
        reject(error);
      }
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
