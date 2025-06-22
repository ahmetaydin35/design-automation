const { AuthenticationClient, Scopes } = require("@aps_sdk/authentication");
const { OssClient, Region, PolicyKey } = require("@aps_sdk/oss");
const {
  ModelDerivativeClient,
  View,
  OutputType,
} = require("@aps_sdk/model-derivative");
const {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_BUCKET,
} = require("../config.js");

console.log("APS Service Config:", {
  hasClientId: !!APS_CLIENT_ID,
  hasClientSecret: !!APS_CLIENT_SECRET,
  bucket: APS_BUCKET,
});

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();

const service = (module.exports = {});

async function getInternalToken() {
  try {
    console.log("Getting internal token...");
    const credentials = await authenticationClient.getTwoLeggedToken(
      APS_CLIENT_ID,
      APS_CLIENT_SECRET,
      [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead,
      ]
    );
    console.log("Internal token obtained successfully");
    return credentials.access_token;
  } catch (err) {
    console.error("Failed to get internal token:", err);
    throw err;
  }
}

service.getViewerToken = async () => {
  try {
    console.log("Getting viewer token...");
    const token = await authenticationClient.getTwoLeggedToken(
      APS_CLIENT_ID,
      APS_CLIENT_SECRET,
      [Scopes.ViewablesRead]
    );
    console.log("Viewer token obtained successfully");
    return token;
  } catch (err) {
    console.error("Failed to get viewer token:", err);
    throw err;
  }
};

service.ensureBucketExists = async (bucketKey) => {
  const accessToken = await getInternalToken();
  try {
    await ossClient.getBucketDetails(bucketKey, { accessToken });
  } catch (err) {
    if (err.axiosError.response.status === 404) {
      await ossClient.createBucket(
        Region.Us,
        { bucketKey: bucketKey, policyKey: PolicyKey.Persistent },
        { accessToken }
      );
    } else {
      throw err;
    }
  }
};

service.listObjects = async () => {
  await service.ensureBucketExists(APS_BUCKET);
  const accessToken = await getInternalToken();
  let resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, accessToken });
  let objects = resp.items;
  while (resp.next) {
    const startAt = new URL(resp.next).searchParams.get("startAt");
    resp = await ossClient.getObjects(APS_BUCKET, {
      limit: 64,
      startAt,
      accessToken,
    });
    objects = objects.concat(resp.items);
  }
  return objects;
};

service.uploadObject = async (objectName, filePath) => {
  try {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();

    const obj = await ossClient.uploadObject(APS_BUCKET, objectName, filePath, {
      accessToken,
    });

    return obj;
  } catch (err) {
    console.error("Upload to OSS failed:", err);
    throw err;
  }
};

service.translateObject = async (urn, rootFilename) => {
  try {
    const accessToken = await getInternalToken();

    // Object ID'yi base64 encode et
    const base64Urn = service.urnify(urn);

    // Translation job payload'ı
    const jobPayload = {
      input: {
        urn: base64Urn,
      },
      output: {
        formats: [
          {
            views: [View._2d, View._3d],
            type: OutputType.Svf2,
          },
        ],
      },
    };

    // ZIP dosyaları için özel parametreler
    if (rootFilename) {
      jobPayload.input.compressedUrn = true;
      jobPayload.input.rootFilename = rootFilename;
    }

    const job = await modelDerivativeClient.startJob(jobPayload, {
      accessToken,
    });
    return job.result;
  } catch (err) {
    console.error("Translation error:", err);
    throw err;
  }
};

service.getManifest = async (urn) => {
  const accessToken = await getInternalToken();
  try {
    const manifest = await modelDerivativeClient.getManifest(urn, {
      accessToken,
    });
    return manifest;
  } catch (err) {
    if (err.axiosError.response.status === 404) {
      return null;
    } else {
      throw err;
    }
  }
};

service.urnify = (id) => Buffer.from(id).toString("base64").replace(/=/g, "");
