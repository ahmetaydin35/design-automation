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
          extensions: ["Autodesk.DocumentBrowser"],
        };
        viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
        viewer.start();
        viewer.setTheme("light-theme");
        console.log("Viewer initialized successfully");
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

    // Show notification for download
    const downloadAction = `
      <a href="${url}" 
         download="${url.split("/").pop() || "download"}"
         class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 text-sm flex items-center">
        <i class="bi bi-download mr-2"></i>
        Download
      </a>
    `;

    showNotification(
      "download",
      "Download Ready",
      "Your result file is ready to download",
      downloadAction
    );
  });

  connection.on("downloadReport", function (url) {
    // Add to download history
    addToDownloadHistory(url, "Processing Report", "report");

    // Show notification for report
    const reportAction = `
      <a href="${url}" 
         download="${url.split("/").pop() || "report"}"
         class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors duration-200 text-sm flex items-center">
        <i class="bi bi-file-text mr-2"></i>
        Download
      </a>
    `;

    showNotification(
      "report",
      "Report Ready",
      "Processing report is available",
      reportAction
    );
  });

  connection.on("viewInViewer", function (data) {
    // Add to viewer history
    addToViewerHistory(data.urn, data.message);

    // Show small processing complete notification
    showProcessingCompleteNotification(data);
    console.log("Model ready for viewing. URN:", data.urn);
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
