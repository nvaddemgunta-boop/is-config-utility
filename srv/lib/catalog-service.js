const { IntegrationSuiteClient } = require("./integration-suite-client");

/**
 * Initial catalog load:
 * Returns packages only.
 * iFlows are fetched later when the user expands a package.
 */
async function getCatalog(environmentId) {
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
          packageId: packageId,
          packageName: packageName,
          displayName: packageName,
          description: pkg.Description || pkg.description || "",
          selected: false,

          // Indicates whether iFlows were already loaded for this package.
          iflowsLoaded: false,

          // This temporary child makes the SAPUI5 Tree show an expand arrow.
          // It is replaced with real iFlows once the package is expanded.
          iflows: [
            {
              artifactId: "__LOADING_PLACEHOLDER__",
              artifactName: "Expand package to load iFlows",
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
 * Loads iFlows for one selected package.
 */
async function getPackageArtifacts(environmentId, packageId) {
  const client = new IntegrationSuiteClient(environmentId);

  const artifacts = await client.getDesignTimeArtifactsForPackage(packageId);

  return {
    environment: environmentId,
    packageId: packageId,
    iflows: artifacts
      .filter(isIntegrationFlow)
      .map(normalizeArtifact)
  };
}

function getPackageId(pkg) {
  return pkg.Id || pkg.ID || pkg.PackageId || pkg.packageId;
}

function getPackageName(pkg) {
  return pkg.Name || pkg.Title || pkg.Id || pkg.ID || "Unnamed Package";
}

function isIntegrationFlow(artifact) {
  const type =
    artifact.ArtifactType ||
    artifact.Type ||
    artifact.type ||
    artifact.ArtifactKind;

  if (!type) {
    return true;
  }

  const normalizedType = String(type).toLowerCase();

  return (
    normalizedType.includes("flow") ||
    normalizedType.includes("iflow") ||
    normalizedType.includes("integration")
  );
}

function normalizeArtifact(artifact) {
  return {
    artifactId: artifact.Id || artifact.ID || artifact.Name,
    artifactName: artifact.Name || artifact.Id || artifact.ID,
    version: artifact.Version || artifact.version || "",
    artifactType: artifact.ArtifactType || artifact.Type || "",
    modifiedAt: artifact.ModifiedAt || artifact.LastModifiedAt || "",
    modifiedBy: artifact.ModifiedBy || artifact.LastModifiedBy || "",
    deployed: false,
    selected: false,
    isPlaceholder: false
  };
}

module.exports = {
  getCatalog,
  getPackageArtifacts
};