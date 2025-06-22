const _path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");
const config = require("./config");
if (!config.credentials.client_id || !config.credentials.client_secret) {
  console.error("Missing APS_CLIENT_ID or APS_CLIENT_SECRET env variables.");
  process.exit(1);
}

let app = express();
app.use(express.static(_path.join(__dirname, "./public")));
app.use(
  cookieSession({
    name: "aps_session",
    keys: ["aps_secure_key"],
    maxAge: 60 * 60 * 1000, // 1 hour, same as the 2 legged lifespan token
  })
);
app.use(
  express.json({
    limit: "50mb",
  })
);

// Design Automation API routes
app.use("/api", require("./routes/DesignAutomation"));

// Viewer routes
app.use("/viewer", require("./routes/viewer"));

app.set("port", process.env.PORT || 8080);

module.exports = app;
