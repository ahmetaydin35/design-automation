// Load environment variables from .env file
require("dotenv").config();

// Autodesk Forge configuration
module.exports = {
  // APS credentials (for both old and new SDK)
  APS_CLIENT_ID: process.env.APS_CLIENT_ID,
  APS_CLIENT_SECRET: process.env.APS_CLIENT_SECRET,
  APS_BUCKET: process.env.APS_BUCKET || "aps-design-automation-bucket",

  // Set environment variables or hard-code here
  credentials: {
    client_id: process.env.APS_CLIENT_ID,
    client_secret: process.env.APS_CLIENT_SECRET,
    callback_url: process.env.APS_CALLBACK || process.env.APS_CALLBACK_URL,
    webhook_url: process.env.APS_WEBHOOK_URL,
  },
  scopes: {
    // Required scopes for the server-side application
    internal: [
      "bucket:create",
      "bucket:read",
      "bucket:delete",
      "data:read",
      "data:create",
      "data:write",
      "code:all",
    ],
    // Required scope for the client-side viewer
    public: ["viewables:read"],
  },
  client: {
    circuitBreaker: {
      threshold: 11,
      interval: 1200,
    },
    retry: {
      maxNumberOfRetries: 7,
      backoffDelay: 4000,
      backoffPolicy: "exponentialBackoffWithJitter",
    },
    requestTimeout: 13000,
  },
};
