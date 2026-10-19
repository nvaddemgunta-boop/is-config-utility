const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const { validateEnvironment } = require("./environment-config");

/**
 * This client is responsible only for calling SAP Integration Suite APIs.
 * It should not contain UI logic or comparison logic.
 */
class IntegrationSuiteClient {
  constructor(environmentId) {
    const environment = validateEnvironment(environmentId);

    this.environmentId = environment.id;
    this.destinationName = environment.destinationName;
  }

  async getIntegrationPackages() {
    return this._getAllPages("/IntegrationPackages");
  }

  async getDesignTimeArtifactsForPackage(packageId) {
    /**
     * SAP Integration Suite OData APIs commonly expose artifacts as a navigation
     * from IntegrationPackages.
     *
     * Example:
     * /IntegrationPackages('PACKAGE_ID')/IntegrationDesigntimeArtifacts
     */
    const packageKey = encodeURIComponent(escapeODataString(packageId));
    const url = `/IntegrationPackages('${packageKey}')/IntegrationDesigntimeArtifacts`;

    return this._getAllPages(url);
  }

  async getDesignTimeArtifact(packageId, artifactId) {
    /**
     * Safer approach:
     * Load artifacts for the package, then find the artifact by ID.
     *
     * This avoids issues where direct $filter calls may behave differently
     * across Integration Suite tenants.
     */
    const artifacts = await this.getDesignTimeArtifactsForPackage(packageId);

    return artifacts.find((artifact) => {
      const currentArtifactId =
        artifact.Id ||
        artifact.ID ||
        artifact.Name ||
        artifact.ArtifactId ||
        artifact.artifactId;

      return String(currentArtifactId) === String(artifactId);
    }) || null;
  }

  async getExternalizedParameters(artifactId, version) {
    if (!artifactId) {
      return [];
    }

    /*
    * The configuration endpoint requires both iFlow ID and version.
    * In most design-time API responses, Version is available.
    *
    * Example:
    * /IntegrationDesigntimeArtifacts(
    *   Id='MY_IFLOW',
    *   Version='1.0.0'
    * )/Configurations
    */
    const normalizedVersion = version || "active";

    const artifactKey =
      `Id='${escapeODataString(artifactId)}',` +
      `Version='${escapeODataString(normalizedVersion)}'`;

    return this._getAllPages(
      `/IntegrationDesigntimeArtifacts(${artifactKey})/Configurations`,
      {
        "$format": "json"
      }
    );
  }

  async getValueMappingArtifacts() {
    return this._getAllPages("/ValueMappingDesigntimeArtifacts", {
      "$format": "json"
    });
  }

  async getValueMappingSchemas(artifactId, version) {
    const artifactKey =
      `Id='${escapeODataString(artifactId)}',` +
      `Version='${escapeODataString(version || "active")}'`;

    return this._getAllPages(
      `/ValueMappingDesigntimeArtifacts(${artifactKey})/ValMapSchema`,
      {
        "$format": "json"
      }
    );
  }

  async getValueMappingEntries(artifactId, version, schema) {
    const artifactKey =
      `Id='${escapeODataString(artifactId)}',` +
      `Version='${escapeODataString(version || "active")}'`;

    const schemaKey =
      `SrcAgency='${escapeODataString(schema.SrcAgency)}',` +
      `SrcId='${escapeODataString(schema.SrcId)}',` +
      `TgtAgency='${escapeODataString(schema.TgtAgency)}',` +
      `TgtId='${escapeODataString(schema.TgtId)}'`;

    return this._getAllPages(
      `/ValueMappingDesigntimeArtifacts(${artifactKey})/` +
      `ValMapSchema(${schemaKey})/ValMaps`,
      {
        "$format": "json"
      }
    );
  }

  async getValueMappingEntries(artifactId, version, schema) {
    if (!artifactId) {
      return [];
    }

    if (
      !schema ||
      !schema.SrcAgency ||
      !schema.SrcId ||
      !schema.TgtAgency ||
      !schema.TgtId
    ) {
      const error = new Error(
        "Value Mapping schema must include SrcAgency, SrcId, TgtAgency, and TgtId."
      );

      error.statusCode = 400;
      error.code = "INVALID_VALUE_MAPPING_SCHEMA";

      throw error;
    }

    const artifactKey =
      `Id='${escapeODataString(artifactId)}',` +
      `Version='${escapeODataString(version || "active")}'`;

    const schemaKey =
      `SrcAgency='${escapeODataString(schema.SrcAgency)}',` +
      `SrcId='${escapeODataString(schema.SrcId)}',` +
      `TgtAgency='${escapeODataString(schema.TgtAgency)}',` +
      `TgtId='${escapeODataString(schema.TgtId)}'`;

    const response = await this._get(
      `/ValueMappingDesigntimeArtifacts(${artifactKey})/` +
      `ValMapSchema(${schemaKey})/ValMaps`,
      {
        "$format": "json"
      }
    );

    return extractODataResults(response.data);
  }

  async getValueMappingArtifactById(artifactId) {
    if (!artifactId) {
      return null;
    }

    /*
    * Value Mapping artifact metadata is already available through the
    * ValueMappingDesigntimeArtifacts entity set.
    *
    * We use the artifact ID to find the actual version in this environment.
    * This is important because DEV and QAS may have different versions.
    */
    const artifacts = await this.getValueMappingArtifacts();

    return artifacts.find(function (artifact) {
      const currentArtifactId =
        artifact.Id ||
        artifact.ID ||
        artifact.ArtifactId ||
        artifact.artifactId ||
        "";

      return String(currentArtifactId) === String(artifactId);
    }) || null;
  }

  async _getAllPages(url, params = {}) {
    const results = [];
    let currentUrl = url;
    let currentParams = params;

    while (currentUrl) {
      const response = await this._get(currentUrl, currentParams);
      const pageItems = extractODataResults(response.data);

      results.push(...pageItems);

      const nextLink = getNextLink(response.data);
      if (!nextLink) {
        break;
      }

      currentUrl = nextLink;
      currentParams = {};
    }

    return results;
  }

  async _get(url, params = {}) {
    try {
      return await executeHttpRequest(
        {
          destinationName: this.destinationName
        },
        {
          method: "GET",
          url,
          params,
          headers: {
            Accept: "application/json"
          },
          timeout: 60000
        }
      );
    } catch (error) {
      const safeMessage = buildSafeHttpErrorMessage(error, this.environmentId, url);
      const wrappedError = new Error(safeMessage);

      wrappedError.statusCode = error.response?.status || 502;
      wrappedError.code = "INTEGRATION_SUITE_API_ERROR";

      throw wrappedError;
    }
  }
}

function getValueMappingArtifactVersion(artifact, fallbackVersion = "active") {
  if (!artifact) {
    return fallbackVersion;
  }

  return (
    artifact.Version ||
    artifact.version ||
    fallbackVersion
  );
}
/**
 * Handles common OData response structures:
 * OData V2: { d: { results: [...] } }
 * OData V4: { value: [...] }
 * Direct array: [...]
 */
function extractODataResults(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.value)) {
    return data.value;
  }

  if (data.d && Array.isArray(data.d.results)) {
    return data.d.results;
  }

  if (data.d && !Array.isArray(data.d.results)) {
    return [data.d];
  }

  return [];
}

function getNextLink(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidates = [
    data["@odata.nextLink"],
    data["odata.nextLink"],
    data.__next,
    data.d && (data.d["@odata.nextLink"] || data.d["odata.nextLink"] || data.d.__next),
    data["d"] && (data.d["@odata.nextLink"] || data.d["odata.nextLink"] || data.d.__next)
  ];

  return candidates.find(Boolean) || null;
}

function escapeODataString(value) {
  return String(value || "").replace(/'/g, "''");
}

function buildSafeHttpErrorMessage(error, environmentId, url) {
  const status = error.response?.status;
  const statusText = error.response?.statusText;
  const remoteMessage =
    typeof error.response?.data === "string"
      ? error.response.data
      : JSON.stringify(error.response?.data || {});

  if (status) {
    return `Integration Suite API call failed for ${environmentId} at ${url}. HTTP ${status} ${statusText || ""}. ${remoteMessage.substring(0, 500)}`.trim();
  }

  return `Integration Suite API call failed for ${environmentId} at ${url}. ${error.message || ""}`.trim();
}

module.exports = {
  IntegrationSuiteClient,
  extractODataResults,
  getValueMappingArtifactVersion
};