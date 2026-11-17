const { IntegrationSuiteClient } = require("./integration-suite-client");
const { validateEnvironment } = require("./environment-config");

const MAX_PACKAGE_SELECTION = 1000;
const PACKAGE_CONCURRENCY = 3;
const ARTIFACT_CONCURRENCY = 8;

async function getDeploymentRuntimePackages(environmentId) {
  validateEnvironment(environmentId);
  const client = new IntegrationSuiteClient(environmentId);
  const packages = await client.getIntegrationPackages();

  return {
    environment: environmentId,
    packages: packages.map(normalizePackage).filter(Boolean)
  };
}

async function getDeploymentRuntimeArtifacts(environmentId, packageId) {
  validateEnvironment(environmentId);
  validatePackageId(packageId);

  const client = new IntegrationSuiteClient(environmentId);
  const artifacts = await getPackageArtifacts(client, packageId);

  return {
    environment: environmentId,
    packageId,
    artifacts
  };
}

async function getDeploymentRuntimeArtifactCatalog(environmentId) {
  validateEnvironment(environmentId);
  const client = new IntegrationSuiteClient(environmentId);
  const artifacts = await client.getRuntimeArtifacts();

  return {
    environment: environmentId,
    artifacts: artifacts.map(normalizeRuntimeArtifact).filter(Boolean)
  };
}

async function compareDeploymentRuntime(
  sourceEnvironment,
  targetEnvironment,
  request
) {
  validateCompareRequest(sourceEnvironment, targetEnvironment, request);

  const sourceClient = new IntegrationSuiteClient(sourceEnvironment);
  const targetClient = new IntegrationSuiteClient(targetEnvironment);
  const mode = request.mode || "PACKAGE";

  let packageResults;
  if (mode === "ARTIFACT") {
    const pair = request.artifactPair;
    const sourceArtifact = await readRuntimeArtifact(sourceClient, pair.source);
    const targetArtifact = await readRuntimeArtifact(targetClient, pair.target);
    const artifact = compareRuntimeArtifacts(
      sourceArtifact,
      targetArtifact,
      pair.source.packageId || pair.target.packageId || ""
    );

    packageResults = [{
      packageId: artifact.packageId,
      packageName: artifact.packageId || "Artifact Pair",
      status: "COMPARED",
      artifacts: [artifact]
    }];
  } else {
    const packageIds = request.packageIds;
    packageResults = await mapWithConcurrency(
      packageIds,
      PACKAGE_CONCURRENCY,
      async function (packageId) {
        const sourcePackage = request.packages?.[packageId] || {};

        try {
          const [sourceArtifacts, targetArtifacts] = await Promise.all([
            getPackageArtifacts(sourceClient, packageId),
            getPackageArtifacts(targetClient, packageId)
          ]);

          return {
            packageId,
            packageName: sourcePackage.packageName || packageId,
            status: "COMPARED",
            artifacts: compareArtifactCollections(
              sourceArtifacts,
              targetArtifacts,
              packageId
            )
          };
        } catch (error) {
          return {
            packageId,
            packageName: sourcePackage.packageName || packageId,
            status: "ERROR",
            artifacts: [{
              packageId,
              artifactId: "",
              artifactName: "Package runtime lookup failed",
              artifactType: "Package",
              sourceVersion: "",
              targetVersion: "",
              sourceStatus: "ERROR",
              targetStatus: "ERROR",
              status: "ERROR",
              error: safeRuntimeErrorMessage(error)
            }]
          };
        }
      }
    );
  }

  return buildComparisonResponse(
    sourceEnvironment,
    targetEnvironment,
    mode,
    packageResults
  );
}

async function getPackageArtifacts(client, packageId) {
  let candidates;

  try {
    candidates = await client.getDeploymentDesignTimeArtifactsForPackage(packageId);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }

  return mapWithConcurrency(
    candidates.filter(function (candidate) {
      return candidate.artifactId;
    }),
    ARTIFACT_CONCURRENCY,
    function (candidate) {
      return readRuntimeArtifact(client, candidate);
    }
  );
}

async function readRuntimeArtifact(client, artifact) {
  const normalizedArtifact = normalizeArtifactReference(artifact);

  try {
    const runtime = await client.getRuntimeArtifactStatus(
      normalizedArtifact.artifactId
    );

    if (!runtime) {
      return {
        ...normalizedArtifact,
        runtimeVersion: "",
        runtimeStatus: "NOT_DEPLOYED",
        deployed: false,
        error: ""
      };
    }

    if (runtime.Version == null || runtime.Status == null) {
      return {
        ...normalizedArtifact,
        runtimeVersion: "",
        runtimeStatus: "ERROR",
        deployed: false,
        error: "Runtime response did not include a version and status."
      };
    }

    return {
      ...normalizedArtifact,
      runtimeVersion: String(runtime.Version ?? runtime.version ?? ""),
      runtimeStatus: String(runtime.Status ?? runtime.status ?? "UNKNOWN"),
      deployed: true,
      error: ""
    };
  } catch (error) {
    if (isNotFound(error)) {
      return {
        ...normalizedArtifact,
        runtimeVersion: "",
        runtimeStatus: "NOT_DEPLOYED",
        deployed: false,
        error: ""
      };
    }

    return {
      ...normalizedArtifact,
      runtimeVersion: "",
      runtimeStatus: "ERROR",
      deployed: false,
      error: safeRuntimeErrorMessage(error)
    };
  }
}

function compareArtifactCollections(sourceArtifacts, targetArtifacts, packageId) {
  const sourceMap = indexArtifacts(sourceArtifacts);
  const targetMap = indexArtifacts(targetArtifacts);
  const keys = new Set([...sourceMap.keys(), ...targetMap.keys()]);

  return [...keys].map(function (key) {
    return compareRuntimeArtifacts(
      sourceMap.get(key) || null,
      targetMap.get(key) || null,
      packageId
    );
  }).sort(function (left, right) {
    return left.artifactName.localeCompare(right.artifactName) ||
      left.artifactType.localeCompare(right.artifactType) ||
      left.artifactId.localeCompare(right.artifactId);
  });
}

function compareRuntimeArtifacts(source, target, packageId) {
  const reference = source || target || {};
  let status;

  if (source?.error || target?.error) {
    status = "ERROR";
  } else if (!source) {
    status = "MISSING_IN_SOURCE";
  } else if (!target) {
    status = "MISSING_IN_TARGET";
  } else if (!source.deployed && !target.deployed) {
    status = "NOT_DEPLOYED";
  } else if (!source.deployed) {
    status = "MISSING_IN_SOURCE";
  } else if (!target.deployed) {
    status = "MISSING_IN_TARGET";
  } else if (source.artifactType !== target.artifactType) {
    status = "DIFFERENT";
  } else if (
    source.runtimeVersion === target.runtimeVersion &&
    source.runtimeStatus === target.runtimeStatus
  ) {
    status = "SAME";
  } else {
    status = "DIFFERENT";
  }

  return {
    packageId,
    artifactId: reference.artifactId || "",
    sourceArtifactId: source?.artifactId || "",
    targetArtifactId: target?.artifactId || "",
    artifactName: reference.artifactName || reference.artifactId || "Unnamed Artifact",
    artifactType: reference.artifactType || "Unknown",
    sourceVersion: source?.runtimeVersion || "",
    targetVersion: target?.runtimeVersion || "",
    sourceStatus: source?.runtimeStatus || "MISSING",
    targetStatus: target?.runtimeStatus || "MISSING",
    status,
    error: source?.error || target?.error || ""
  };
}

function indexArtifacts(artifacts) {
  const indexed = new Map();

  (artifacts || []).forEach(function (artifact) {
    const key = JSON.stringify([
      artifact.artifactType || "",
      artifact.artifactId || ""
    ]);

    if (indexed.has(key)) {
      const error = new Error("Duplicate runtime artifact identity detected.");
      error.code = "DUPLICATE_RUNTIME_ARTIFACT";
      throw error;
    }

    indexed.set(key, artifact);
  });

  return indexed;
}

function normalizeArtifactReference(artifact) {
  return {
    packageId: artifact.packageId || "",
    artifactId: String(artifact.artifactId || artifact.Id || artifact.ID || ""),
    artifactName: artifact.artifactName || artifact.Name || artifact.artifactId || "Unnamed Artifact",
    artifactType: artifact.artifactType || artifact.Type || "Unknown"
  };
}

function normalizeRuntimeArtifact(artifact) {
  const artifactId = artifact.Id || artifact.ID || artifact.ArtifactId || artifact.artifactId || "";
  if (!artifactId) {
    return null;
  }

  const rawType = artifact.Type || artifact.ArtifactType || artifact.type || "Unknown";
  const typeLabels = {
    INTEGRATION_FLOW: "Integration Flow",
    MESSAGE_MAPPING: "Message Mapping",
    VALUE_MAPPING: "Value Mapping",
    SCRIPT_COLLECTION: "Script Collection",
    REST_API_PROVIDER: "REST API Provider",
    SOAP_API_PROVIDER: "SOAP API Provider",
    JDBC_DRIVER: "JDBC Driver",
    FUNCTION_LIBRARY: "Function Library"
  };
  const normalizedType = String(rawType).toUpperCase();

  return {
    packageId: String(artifact.PackageId || artifact.packageId || ""),
    artifactId: String(artifactId),
    artifactName: String(artifact.Name || artifact.ArtifactName || artifact.name || artifactId),
    artifactType: typeLabels[normalizedType] || String(rawType),
    runtimeVersion: String(artifact.Version ?? artifact.version ?? ""),
    runtimeStatus: String(artifact.Status ?? artifact.status ?? "UNKNOWN"),
    deployed: true,
    error: ""
  };
}

function normalizePackage(pkg) {
  const packageId = pkg.Id || pkg.ID || pkg.PackageId || pkg.packageId || "";
  if (!packageId) {
    return null;
  }

  const packageName = pkg.Name || pkg.Title || packageId;
  return {
    packageId: String(packageId),
    packageName: String(packageName),
    description: pkg.Description || pkg.description || "",
    selected: false
  };
}

function buildComparisonResponse(sourceEnvironment, targetEnvironment, mode, packageResults) {
  const summary = {
    packagesCompared: packageResults.length,
    totalArtifacts: 0,
    same: 0,
    different: 0,
    missingInSource: 0,
    missingInTarget: 0,
    notDeployed: 0,
    errors: 0
  };

  packageResults.forEach(function (packageResult) {
    (packageResult.artifacts || []).forEach(function (artifact) {
      summary.totalArtifacts += 1;
      const summaryKeyByStatus = {
        SAME: "same",
        DIFFERENT: "different",
        MISSING_IN_SOURCE: "missingInSource",
        MISSING_IN_TARGET: "missingInTarget",
        NOT_DEPLOYED: "notDeployed",
        ERROR: "errors"
      };
      const summaryKey = summaryKeyByStatus[artifact.status];
      if (summaryKey) {
        summary[summaryKey] += 1;
      }
    });
  });

  return {
    sourceEnvironment,
    targetEnvironment,
    mode,
    comparedAt: new Date().toISOString(),
    summary,
    packageResults
  };
}

function validateCompareRequest(sourceEnvironment, targetEnvironment, request) {
  validateEnvironment(sourceEnvironment);
  validateEnvironment(targetEnvironment);

  if (sourceEnvironment === targetEnvironment) {
    const error = new Error("Source and target environments must be different.");
    error.statusCode = 400;
    error.code = "SAME_ENVIRONMENT";
    throw error;
  }

  if (!request || typeof request !== "object") {
    throw createRequestError("A comparison request is required.", "INVALID_REQUEST");
  }

  if (request.mode === "ARTIFACT") {
    const pair = request.artifactPair;
    if (!pair?.source?.artifactId || !pair?.target?.artifactId) {
      throw createRequestError("Select one source and one target artifact.", "INVALID_ARTIFACT_PAIR");
    }
    return;
  }

  if (!Array.isArray(request.packageIds) || request.packageIds.length === 0) {
    throw createRequestError("Select at least one source package.", "NO_PACKAGES_SELECTED");
  }

  if (request.packageIds.length > MAX_PACKAGE_SELECTION) {
    throw createRequestError(
      `Select no more than ${MAX_PACKAGE_SELECTION} packages per comparison.`,
      "PACKAGE_SELECTION_LIMIT"
    );
  }

  if (request.packageIds.some(function (packageId) {
    return typeof packageId !== "string" || !packageId.trim();
  })) {
    throw createRequestError("Package IDs must be non-empty strings.", "INVALID_PACKAGE_ID");
  }

  if (new Set(request.packageIds).size !== request.packageIds.length) {
    throw createRequestError("Package selections must be unique.", "DUPLICATE_PACKAGE_ID");
  }
}

function validatePackageId(packageId) {
  if (typeof packageId !== "string" || !packageId.trim()) {
    throw createRequestError("A package ID is required.", "MISSING_PACKAGE_ID");
  }
}

function createRequestError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function safeRuntimeErrorMessage(error) {
  if (error?.code === "INTEGRATION_SUITE_API_ERROR") {
    return "Runtime status could not be read from this environment.";
  }
  return "Runtime status could not be compared for this artifact.";
}

function isNotFound(error) {
  return error?.statusCode === 404 || error?.response?.status === 404;
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

module.exports = {
  getDeploymentRuntimePackages,
  getDeploymentRuntimeArtifacts,
  getDeploymentRuntimeArtifactCatalog,
  compareDeploymentRuntime,
  compareArtifactCollections,
  compareRuntimeArtifacts
};
