$(document).ready(function () {
  prepareLists();
  initializeViewer();

  $("#clearAccount").click(clearAccount);
  $("#createAppBundleActivity").click(createAppBundleActivity);
  $("#startWorkitem").click(startWorkitem);

  startConnection();
});

// Viewer variables
let viewer;
let viewerDocument;
let is3DViewer;

// Initialize embedded viewer
function initializeViewer() {
  return new Promise(function (resolve, reject) {
    console.log("Initializing Autodesk Viewer...");
    Autodesk.Viewing.Initializer(
      { env: "AutodeskProduction", getAccessToken },
      function () {
        const container = document.getElementById("embedded-viewer");
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
            "Autodesk.FullScreen",
            "Autodesk.Viewing.FusionOrbit",
          ],
        };
        viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
        viewer.start();
        viewer.setTheme("light-theme");

        // Viewer başladığında placeholder'ı gizle
        viewer.addEventListener(
          Autodesk.Viewing.VIEWER_INITIALIZED,
          function () {
            console.log("🎛️ Viewer initialized - hiding placeholder");
            const placeholder = document.getElementById("viewer-placeholder");
            if (placeholder) {
              placeholder.style.display = "none";
            }
          }
        );

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

// Get access token for viewer - exact same as dedicated viewer
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

// Load model in embedded viewer - exact same as dedicated viewer
function loadModelInViewer(urn) {
  if (!viewer) {
    console.error("Viewer not initialized");
    return;
  }

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

function prepareLists() {
  list("activity", "/api/aps/designautomation/activities");
  list("engines", "/api/aps/designautomation/engines");
  list("localBundles", "/api/appbundles");
}

function list(control, endpoint) {
  $("#" + control)
    .find("option")
    .remove()
    .end();
  jQuery.ajax({
    url: endpoint,
    success: function (list) {
      if (list.length === 0)
        $("#" + control).append(
          $("<option>", {
            disabled: true,
            text: "Nothing found",
          })
        );
      else
        list.forEach(function (item) {
          $("#" + control).append(
            $("<option>", {
              value: item,
              text: item,
            })
          );
        });
    },
  });
}

function clearAccount() {
  if (
    !confirm(
      "Clear existing activities & appbundles before start. " +
        "This is useful if you believe there are wrong settings on your account." +
        "\n\nYou cannot undo this operation. Proceed?"
    )
  )
    return;

  jQuery.ajax({
    url: "api/aps/designautomation/account",
    method: "DELETE",
    success: function () {
      prepareLists();
      writeLog("Account cleared, all appbundles & activities deleted");
    },
  });
}

function defineActivityModal() {
  openConfigModal();
}

function createAppBundleActivity() {
  startConnection(function () {
    writeLog("Defining appbundle and activity for " + $("#engines").val());
    closeConfigModal();
    createAppBundle(function () {
      createActivity(function () {
        prepareLists();
      });
    });
  });
}

function createAppBundle(cb) {
  jQuery.ajax({
    url: "api/aps/designautomation/appbundles",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      zipFileName: $("#localBundles").val(),
      engine: $("#engines").val(),
    }),
    success: function (res) {
      writeLog("AppBundle: " + res.appBundle + ", v" + res.version);
      if (cb) cb();
    },
    error: function (xhr, ajaxOptions, thrownError) {
      writeLog(
        " -> " +
          (xhr.responseJSON && xhr.responseJSON.diagnostic
            ? xhr.responseJSON.diagnostic
            : thrownError)
      );
    },
  });
}

function createActivity(cb) {
  jQuery.ajax({
    url: "api/aps/designautomation/activities",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      zipFileName: $("#localBundles").val(),
      engine: $("#engines").val(),
    }),
    success: function (res) {
      writeLog("Activity: " + res.activity);
      if (cb) cb();
    },
    error: function (xhr, ajaxOptions, thrownError) {
      writeLog(
        " -> " +
          (xhr.responseJSON && xhr.responseJSON.diagnostic
            ? xhr.responseJSON.diagnostic
            : thrownError)
      );
    },
  });
}

function startWorkitem() {
  var inputFileField = document.getElementById("inputFile");
  if (inputFileField.files.length === 0) {
    alert("Please select an input file");
    return;
  }
  if ($("#activity").val() === null) return alert("Please select an activity");
  var file = inputFileField.files[0];
  startConnection(function () {
    var formData = new FormData();
    formData.append("inputFile", file);
    formData.append(
      "data",
      JSON.stringify({
        width: $("#width").val(),
        height: $("#height").val(),
        activityName: $("#activity").val(),
        browserConnectionId: connectionId,
      })
    );
    writeLog("Uploading input file...");
    $.ajax({
      url: "api/aps/designautomation/workitems",
      data: formData,
      processData: false,
      contentType: false,
      //contentType: 'multipart/form-data',
      //dataType: 'json',
      type: "POST",
      success: function (res) {
        writeLog("Workitem started: " + res.workItemId);
      },
      error: function (xhr, ajaxOptions, thrownError) {
        writeLog(
          " -> " +
            (xhr.responseJSON && xhr.responseJSON.diagnostic
              ? xhr.responseJSON.diagnostic
              : thrownError)
        );
      },
    });
  });
}

function writeLog(text) {
  // Check if text contains HTML (buttons/styled content)
  if (text.includes('<div class="my-')) {
    // For styled content (buttons, complete messages), append as-is
    $("#outputlog").append(text);
  } else {
    // For regular log text, add terminal styling
    $("#outputlog").append(
      '<div class="border-t border-gray-700 border-dashed py-1 text-green-400 text-xs font-mono">' +
        '<span class="text-gray-500 mr-2">[' +
        new Date().toLocaleTimeString() +
        "]</span>" +
        text +
        "</div>"
    );
  }

  var elem = document.getElementById("outputlog");
  elem.scrollTop = elem.scrollHeight;
}

var connection;
var connectionId;

function startConnection(onReady) {
  if (connection && connection.connected) {
    if (onReady) onReady();
    return;
  }
  connection = io();
  connection.on("connect", function () {
    connectionId = connection.id;
    if (onReady) onReady();
  });

  connection.on("downloadResult", function (url) {
    // Add to download history
    addToDownloadHistory(url, "Result File", "file");

    // Simple notification for download
    writeLog("Result file is ready for download");
  });

  connection.on("downloadReport", function (url) {
    // Add to download history
    addToDownloadHistory(url, "Processing Report", "report");

    // Simple notification for report
    writeLog("Processing report is available");
  });

  connection.on("viewInViewer", function (data) {
    console.log("🚀 viewInViewer event received. URN:", data.urn);
    writeLog("Starting auto-load...");

    let attemptCount = 0;
    const maxAttempts = 10;
    const retryInterval = 500;
    let isLoaded = false;

    function attemptModelLoad() {
      if (isLoaded) {
        return;
      }

      attemptCount++;

      // Basit timeout wrapper ile Promise chain'i koruyalım
      const attemptPromise = new Promise((resolve, reject) => {
        // Timeout safety
        const timeoutId = setTimeout(() => {
          reject(new Error("Attempt timeout"));
        }, 3000); // 3 saniye timeout

        try {
          if (!viewer || !viewer.impl) {
            initializeViewer()
              .then(() => {
                return loadModelInViewer(data.urn);
              })
              .then(() => {
                clearTimeout(timeoutId);
                resolve();
              })
              .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
              });
          } else {
            loadModelInViewer(data.urn)
              .then(() => {
                clearTimeout(timeoutId);
                resolve();
              })
              .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
              });
          }
        } catch (syncError) {
          clearTimeout(timeoutId);
          reject(syncError);
        }
      });

      attemptPromise
        .then(() => {
          if (!isLoaded) {
            isLoaded = true;
            writeLog(`✅ Model loaded successfully!`);
            console.log(
              `🎉 Model successfully loaded on attempt ${attemptCount}`
            );
          }
        })
        .catch((error) => {
          // Sadece console'a yaz, writeLog'a yazmaya gerek yok
          if (attemptCount < maxAttempts && !isLoaded) {
            setTimeout(() => {
              attemptModelLoad();
            }, retryInterval);
          } else if (!isLoaded) {
            writeLog("❌ Model could not be loaded automatically.");
            console.log("💀 All attempts exhausted");
          }
        });
    }

    // İlk denemeyi hemen başlat
    attemptModelLoad();

    // Add to viewer history after successful processing
    addToViewerHistory(data.urn, data.message);

    // Simple notification for model ready
    writeLog("Model ready for viewing: " + data.message);
  });

  connection.on("onComplete", function (message) {
    if (typeof message === "object") message = JSON.stringify(message, null, 2);
    writeLog(message);
  });
}

// Initialize viewer when page loads - same as dedicated viewer
$(document).ready(function () {
  // Wait a bit for DOM to be fully ready
  setTimeout(function () {
    initializeViewer()
      .then((embeddedViewer) => {
        console.log("Embedded viewer ready");
      })
      .catch((error) => {
        console.error("Failed to initialize viewer:", error);
      });
  }, 1000);
});

// Simple view history functions - basic style
function addToViewerHistory(urn, message) {
  // Create history panel if it doesn't exist
  let historyPanel = document.getElementById("viewerHistoryPanel");
  if (!historyPanel) {
    historyPanel = document.createElement("div");
    historyPanel.id = "viewerHistoryPanel";
    historyPanel.innerHTML = `
      <div style="position: fixed; bottom: 20px; left: 20px; width: 300px; background: white; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000;">
        <div style="background: #f5f5f5; padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">
          View History
        </div>
        <div id="viewerHistoryList" style="max-height: 200px; overflow-y: auto; padding: 10px;">
        </div>
      </div>
    `;
    document.body.appendChild(historyPanel);
  }

  const historyList = document.getElementById("viewerHistoryList");
  const timestamp = new Date().toLocaleTimeString();

  const historyItem = document.createElement("div");
  historyItem.style.cssText =
    "margin-bottom: 10px; padding: 8px; border: 1px solid #eee; border-radius: 4px; background: #f9f9f9;";
  historyItem.innerHTML = `
    <div style="font-size: 11px; color: #666; margin-bottom: 5px;">${timestamp}</div>
    <div style="font-size: 12px; margin-bottom: 8px;">${message}</div>
    <button onclick="viewModelAgain('${urn}')" style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px; cursor: pointer;">View Again</button>
  `;

  historyList.insertBefore(historyItem, historyList.firstChild);

  // Keep only last 5 items
  while (historyList.children.length > 5) {
    historyList.removeChild(historyList.lastChild);
  }
}

function addToDownloadHistory(url, fileName, type) {
  // Create download history panel if it doesn't exist
  let downloadPanel = document.getElementById("downloadHistoryPanel");
  if (!downloadPanel) {
    downloadPanel = document.createElement("div");
    downloadPanel.id = "downloadHistoryPanel";
    downloadPanel.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; width: 300px; background: white; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000;">
        <div style="background: #f5f5f5; padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">
          Download History
        </div>
        <div id="downloadHistoryList" style="max-height: 200px; overflow-y: auto; padding: 10px;">
        </div>
      </div>
    `;
    document.body.appendChild(downloadPanel);
  }

  const downloadList = document.getElementById("downloadHistoryList");
  const timestamp = new Date().toLocaleTimeString();

  const downloadItem = document.createElement("div");
  downloadItem.style.cssText =
    "margin-bottom: 10px; padding: 8px; border: 1px solid #eee; border-radius: 4px; background: #f9f9f9;";
  downloadItem.innerHTML = `
    <div style="font-size: 11px; color: #666; margin-bottom: 5px;">${timestamp}</div>
    <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">${fileName}</div>
    <a href="${url}" download="${fileName}" style="background: #28a745; color: white; text-decoration: none; padding: 4px 8px; border-radius: 3px; font-size: 11px;">Download</a>
  `;

  downloadList.insertBefore(downloadItem, downloadList.firstChild);

  // Keep only last 10 items
  while (downloadList.children.length > 10) {
    downloadList.removeChild(downloadList.lastChild);
  }
}

function viewModelAgain(urn) {
  writeLog("Loading previous model...");
  loadModelInViewer(urn)
    .then(() => {
      writeLog("Previous model loaded successfully!");
    })
    .catch((error) => {
      writeLog("Failed to load previous model: " + error.message);
    });
}
