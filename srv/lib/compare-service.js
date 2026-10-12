const { IntegrationSuiteClient } = require("./integration-suite-client");
const { validateEnvironment } = require("./environment-config");

/**
 * Compare selected iFlows between source and target environments.
 * Current phase: metadata comparison only.
 */
async function compareArtifacts(sourceEnvironment, targetEnvironment, selectedArtifacts) {
  validateCompareRequest(sourceEnvironment, targetEnvironment, selectedArtifacts);

  const sourceClient = new IntegrationSuiteClient(sourceEnvironment);
  const targetClient = new IntegrationSuiteClient(targetEnvironment);

  const results = [];

  for (const selectedArtifact of selectedArtifacts) {
    const packageId = selectedArtifact.packageId;
    const artifactId = selectedArtifact.artifactId;

    try {
      const sourceArtifact = await sourceClient.getDesignTimeArtifact(
        packageId,
        artifactId
      );

      const targetArtifact = await targetClient.getDesignTimeArtifact(
        packageId,
        artifactId
      );

      /*
      * Only retrieve configuration parameters when the artifact exists
      * in the respective environment.
      */
      const sourceVersion = getArtifactVersion(sourceArtifact);
      const targetVersion = getArtifactVersion(targetArtifact);

      const sourceConfigurations = sourceArtifact
        ? await sourceClient.getExternalizedParameters(
            getArtifactId(sourceArtifact, artifactId),
            sourceVersion
          )
        : [];

      const targetConfigurations = targetArtifact
        ? await targetClient.getExternalizedParameters(
            getArtifactId(targetArtifact, artifactId),
            targetVersion
          )
        : [];

      const comparisonResult = compareSingleArtifact({
        packageId,
        artifactId,
        sourceArtifact,
        targetArtifact,
        sourceConfigurations,
        targetConfigurations,
        fallbackArtifactName: selectedArtifact.artifactName
      });

      results.push(comparisonResult);
    } catch (error) {
      console.error("[CompareService] Failed to compare artifact", {
        sourceEnvironment,
        targetEnvironment,
        packageId,
        artifactId,
        message: error.message
      });

      results.push({
        packageId,
        artifactId,
        artifactName: selectedArtifact.artifactName || artifactId,
        status: "ERROR",
        differences: [
          {
            category: "TECHNICAL",
            field: "comparison",
            sourceValue: "",
            targetValue: "",
            result: "ERROR",
            message: "Unable to compare this artifact. Check backend logs for details."
          }
        ]
      });
    }
  }

  return buildComparisonResponse(sourceEnvironment, targetEnvironment, results);
}

function validateCompareRequest(sourceEnvironment, targetEnvironment, selectedArtifacts) {
  validateEnvironment(sourceEnvironment);
  validateEnvironment(targetEnvironment);

  if (sourceEnvironment === targetEnvironment) {
    const error = new Error("Source and target environments must be different.");
    error.statusCode = 400;
    error.code = "SAME_ENVIRONMENT";
    throw error;
  }

  if (!Array.isArray(selectedArtifacts) || selectedArtifacts.length === 0) {
    const error = new Error("At least one artifact must be selected.");
    error.statusCode = 400;
    error.code = "NO_ARTIFACTS_SELECTED";
    throw error;
  }
}

function compareSingleArtifact({ packageId, artifactId, sourceArtifact, targetArtifact, sourceConfigurations, targetConfigurations, fallbackArtifactName }) {
  const artifactName =
    getArtifactName(sourceArtifact) ||
    getArtifactName(targetArtifact) ||
    fallbackArtifactName ||
    artifactId;

  if (!sourceArtifact && !targetArtifact) {
    return {
      packageId,
      artifactId,
      artifactName,
      status: "MISSING_BOTH",
      differences: [
        {
          category: "EXISTENCE",
          field: "artifact",
          sourceValue: "Missing",
          targetValue: "Missing",
          result: "MISSING_BOTH"
        }
      ]
    };
  }

  if (!sourceArtifact) {
    return {
      packageId,
      artifactId,
      artifactName,
      status: "MISSING_IN_SOURCE",
      differences: [
        {
          category: "EXISTENCE",
          field: "artifact",
          sourceValue: "Missing",
          targetValue: "Exists",
          result: "MISSING_IN_SOURCE"
        }
      ]
    };
  }

  if (!targetArtifact) {
    return {
      packageId,
      artifactId,
      artifactName,
      status: "MISSING_IN_TARGET",
      differences: [
        {
          category: "EXISTENCE",
          field: "artifact",
          sourceValue: "Exists",
          targetValue: "Missing",
          result: "MISSING_IN_TARGET"
        }
      ]
    };
  }

  const sourceMetadata = normalizeArtifactMetadata(sourceArtifact);
  const targetMetadata = normalizeArtifactMetadata(targetArtifact);

  const differences = [];

  compareField(differences, "METADATA", "artifactName", sourceMetadata.artifactName, targetMetadata.artifactName);
  compareField(differences, "METADATA", "version", sourceMetadata.version, targetMetadata.version);
  compareField(differences, "METADATA", "artifactType", sourceMetadata.artifactType, targetMetadata.artifactType);
  
  /*
  * Externalized parameter comparison.
  * This returns ALL parameter rows: SAME, CHANGED, ADDED_IN_TARGET,
  * and REMOVED_FROM_TARGET.
  */
  const parameterComparisons = compareExternalizedParameters(
    sourceConfigurations,
    targetConfigurations
  );

  const parameterSummary = buildParameterSummary(parameterComparisons);

  /**
   * Optional audit fields. These often differ by environment.
   * For now, we include them only if both sides have values.
   */
  //compareFieldIfBothPresent(differences, "AUDIT", "modifiedAt", sourceMetadata.modifiedAt, targetMetadata.modifiedAt);
  //compareFieldIfBothPresent(differences, "AUDIT", "modifiedBy", sourceMetadata.modifiedBy, targetMetadata.modifiedBy);

  /*
  * Keep only non-matching parameters in the legacy `differences` array.
  *
  * Your existing details dialog and main iFlow-level results table use
  * `differences`, so this preserves backward compatibility while the new
  * `parameterComparisons` list supports the richer results screen.
  */
  parameterComparisons
    .filter(function (parameter) {
      return parameter.changeType !== "SAME";
    })
    .forEach(function (parameter) {
      differences.push({
        category: "EXTERNALIZED_PARAMETER",
        field: parameter.parameterKey,
        sourceValue: parameter.sourceValue,
        targetValue: parameter.targetValue,
        result: parameter.changeType
      });
    });

  return {
    packageId,
    artifactId,
    artifactName,
    status: differences.length === 0 ? "SAME" : "DIFFERENT",
    parameterSummary,
    parameterComparisons,
    differences
  };
}
function getArtifactId(artifact, fallbackArtifactId) {
  if (!artifact) {
    return fallbackArtifactId || "";
  }

  return (
    artifact.Id ||
    artifact.ID ||
    artifact.ArtifactId ||
    artifact.artifactId ||
    fallbackArtifactId ||
    ""
  );
}

function getArtifactVersion(artifact) {
  if (!artifact) {
    return "";
  }

  return artifact.Version || artifact.version || "active";
}
function normalizeArtifactMetadata(artifact) {
  return {
    artifactId:
      artifact.Id ||
      artifact.ID ||
      artifact.ArtifactId ||
      artifact.artifactId ||
      "",

    artifactName:
      artifact.Name ||
      artifact.ArtifactName ||
      artifact.artifactName ||
      artifact.Id ||
      artifact.ID ||
      "",

    version:
      artifact.Version ||
      artifact.version ||
      "",

    artifactType:
      artifact.ArtifactType ||
      artifact.Type ||
      artifact.type ||
      artifact.ArtifactKind ||
      "",

    modifiedAt:
      artifact.ModifiedAt ||
      artifact.LastModifiedAt ||
      artifact.UpdatedAt ||
      artifact.ModifiedDate ||
      "",

    modifiedBy:
      artifact.ModifiedBy ||
      artifact.LastModifiedBy ||
      artifact.UpdatedBy ||
      ""
  };
}

function getArtifactName(artifact) {
  if (!artifact) {
    return "";
  }

  return (
    artifact.Name ||
    artifact.ArtifactName ||
    artifact.artifactName ||
    artifact.Id ||
    artifact.ID ||
    ""
  );
}

function compareField(differences, category, field, sourceValue, targetValue) {
  const normalizedSource = normalizeCompareValue(sourceValue);
  const normalizedTarget = normalizeCompareValue(targetValue);

  if (normalizedSource !== normalizedTarget) {
    differences.push({
      category,
      field,
      sourceValue: normalizedSource,
      targetValue: normalizedTarget,
      result: "DIFFERENT"
    });
  }
}

function compareFieldIfBothPresent(differences, category, field, sourceValue, targetValue) {
  const normalizedSource = normalizeCompareValue(sourceValue);
  const normalizedTarget = normalizeCompareValue(targetValue);

  if (!normalizedSource && !normalizedTarget) {
    return;
  }

  if (normalizedSource !== normalizedTarget) {
    differences.push({
      category,
      field,
      sourceValue: normalizedSource,
      targetValue: normalizedTarget,
      result: "DIFFERENT"
    });
  }
}

function normalizeCompareValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function buildComparisonResponse(sourceEnvironment, targetEnvironment, results) {
  return {
    sourceEnvironment,
    targetEnvironment,
    comparedAt: new Date().toISOString(),
    summary: {
      totalCompared: results.length,
      same: results.filter((result) => result.status === "SAME").length,
      different: results.filter((result) => result.status === "DIFFERENT").length,
      missingInTarget: results.filter((result) => result.status === "MISSING_IN_TARGET").length,
      missingInSource: results.filter((result) => result.status === "MISSING_IN_SOURCE").length,
      errors: results.filter((result) => result.status === "ERROR").length
    },
    results
  };
}

function normalizeExternalizedParameters(configurations) {
  const parametersByKey = new Map();

  (configurations || []).forEach(function (configuration) {
    const key =
      configuration.ParameterKey ||
      configuration.Key ||
      configuration.Name ||
      configuration.parameterKey ||
      "";

    if (!key) {
      return;
    }

    const value =
      configuration.ParameterValue ??
      configuration.Value ??
      configuration.value ??
      "";

    parametersByKey.set(String(key).trim(), {
      key: String(key).trim(),
      value: value === null || value === undefined ? "" : String(value).trim()
    });
  });

  return parametersByKey;
}

function buildParameterSummary(parameterComparisons) {
  const summary = {
    changed: 0,
    addedInTarget: 0,
    removedFromTarget: 0,
    same: 0
  };

  (parameterComparisons || []).forEach(function (parameter) {
    switch (parameter.changeType) {
      case "CHANGED":
        summary.changed += 1;
        break;

      case "ADDED_IN_TARGET":
        summary.addedInTarget += 1;
        break;

      case "REMOVED_FROM_TARGET":
        summary.removedFromTarget += 1;
        break;

      case "SAME":
        summary.same += 1;
        break;

      default:
        break;
    }
  });

  return summary;
}

function compareExternalizedParameters(
  sourceConfigurations,
  targetConfigurations
) {
  const sourceParameters = normalizeExternalizedParameters(sourceConfigurations);
  const targetParameters = normalizeExternalizedParameters(targetConfigurations);

  const allKeys = new Set([
    ...sourceParameters.keys(),
    ...targetParameters.keys()
  ]);

  const parameterComparisons = [];

  [...allKeys]
    .sort(function (left, right) {
      return left.localeCompare(right);
    })
    .forEach(function (key) {
      const sourceParameter = sourceParameters.get(key);
      const targetParameter = targetParameters.get(key);

      let changeType;
      let sourceValue = "";
      let targetValue = "";

      if (!sourceParameter) {
        changeType = "ADDED_IN_TARGET";
        targetValue = maskSensitiveValue(key, targetParameter.value);
      } else if (!targetParameter) {
        changeType = "REMOVED_FROM_TARGET";
        sourceValue = maskSensitiveValue(key, sourceParameter.value);
      } else {
        sourceValue = maskSensitiveValue(key, sourceParameter.value);
        targetValue = maskSensitiveValue(key, targetParameter.value);

        changeType =
          sourceParameter.value === targetParameter.value
            ? "SAME"
            : "CHANGED";
      }

      parameterComparisons.push({
        parameterKey: key,
        sourceValue,
        targetValue,
        changeType
      });
    });

  return parameterComparisons;
}

function maskSensitiveValue(parameterKey, value) {
  const key = String(parameterKey || "").toLowerCase();

  /*
   * This masks likely sensitive values in UI/API responses.
   * Adjust the list according to your governance requirements.
   */
  const sensitiveKeywords = [
    "password",
    "passwd",
    "secret",
    "token",
    "apikey",
    "api_key",
    "clientsecret",
    "client_secret",
    "credential"
  ];

  const isSensitive = sensitiveKeywords.some(function (keyword) {
    return key.includes(keyword);
  });

  if (isSensitive && value) {
    return "********";
  }

  return value || "";
}

module.exports = {
  compareArtifacts
};