const { IntegrationSuiteClient } = require("./integration-suite-client");

/*
 * Short in-memory cache of Value Mapping artifact metadata.
 *
 * Value Mapping APIs commonly return all VM artifacts in one request.
 * We cache that result by environment, then filter it when a user expands
 * a package. This avoids calling the remote API repeatedly for each package.
 *
 * This is local-process cache only. It resets whenever CAP restarts.
 */
const valueMappingCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // Five minutes

/**
 * Initial load for Value Mapping Comparison.
 * Returns Integration Packages only, with a placeholder child so that
 * the UI can display an expand arrow for each package.
 */
async function getValueMappingPackageCatalog(environmentId) {
  const client = new IntegrationSuiteClient(environmentId);
  const packages = await client.getIntegrationPackages();

  return {
    environment: environmentId,
    retrievedAt: new Date().toISOString(),
    packages: packages
      .map(function (pkg) {
        const packageId = getPackageId(pkg);

        if (!packageId) {
          return null;
        }

        const packageName = getPackageName(pkg);

        return {
          packageId,
          packageName,
          displayName: packageName,
          description: pkg.Description || pkg.description || "",
          selected: false,

          // Value Mapping-specific lazy-load flags.
          valueMappingsLoaded: false,
          valueMappingCount: null,

          // Placeholder child causes SAPUI5 Tree to display expand control.
          valueMappings: [
            {
              artifactId: "__VM_LOADING_PLACEHOLDER__",
              artifactName: "Expand package to load value mappings",
              isPlaceholder: true,
              selected: false
            }
          ]
        };
      })
      .filter(Boolean)
  };
}

/**
 * Called after a user expands one package.
 * Retrieves cached VM artifact metadata and returns only artifacts
 * assigned to the requested package.
 */
async function getValueMappingsForPackage(environmentId, packageId) {
  if (!packageId) {
    const error = new Error("Package ID is required.");
    error.statusCode = 400;
    error.code = "MISSING_PACKAGE_ID";
    throw error;
  }

  const artifacts = await getCachedValueMappingArtifacts(environmentId);

  const valueMappings = artifacts
    .filter(function (artifact) {
      return getArtifactPackageId(artifact) === packageId;
    })
    .map(normalizeValueMappingArtifact)
    .sort(function (left, right) {
      return left.artifactName.localeCompare(right.artifactName);
    });

  return {
    environment: environmentId,
    packageId,
    retrievedAt: new Date().toISOString(),
    valueMappings
  };
}

/**
 * Optional helper for force-refresh behavior later.
 */
function clearValueMappingCache(environmentId) {
  if (environmentId) {
    valueMappingCache.delete(environmentId);
  } else {
    valueMappingCache.clear();
  }
}

async function getCachedValueMappingArtifacts(environmentId) {
  const cached = valueMappingCache.get(environmentId);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.artifacts;
  }

  const client = new IntegrationSuiteClient(environmentId);
  const artifacts = await client.getValueMappingArtifacts();

  valueMappingCache.set(environmentId, {
    cachedAt: now,
    artifacts
  });

  return artifacts;
}

function getPackageId(pkg) {
  return pkg.Id || pkg.ID || pkg.PackageId || pkg.packageId || "";
}

function getPackageName(pkg) {
  return pkg.Name || pkg.Title || getPackageId(pkg) || "Unnamed Package";
}

/*
 * Field names can vary slightly by API response.
 * We will validate this with the endpoint response after testing.
 */
function getArtifactPackageId(artifact) {
  return (
    artifact.PackageId ||
    artifact.PackageID ||
    artifact.packageId ||
    artifact.IntegrationPackageId ||
    ""
  );
}

function normalizeValueMappingArtifact(artifact) {
  const artifactId =
    artifact.Id ||
    artifact.ID ||
    artifact.ArtifactId ||
    artifact.artifactId ||
    "";

  return {
    artifactId,
    artifactName:
      artifact.Name ||
      artifact.ArtifactName ||
      artifact.name ||
      artifactId,

    version: artifact.Version || artifact.version || "",
    packageId: getArtifactPackageId(artifact),
    artifactType:
      artifact.ArtifactType ||
      artifact.Type ||
      "Value Mapping",

    modifiedAt:
      artifact.ModifiedAt ||
      artifact.LastModifiedAt ||
      artifact.UpdatedAt ||
      "",

    modifiedBy:
      artifact.ModifiedBy ||
      artifact.LastModifiedBy ||
      artifact.UpdatedBy ||
      "",

    selected: false,
    isPlaceholder: false
  };
}

module.exports = {
  getValueMappingPackageCatalog,
  getValueMappingsForPackage,
  clearValueMappingCache
};