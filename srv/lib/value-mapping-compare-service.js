const { IntegrationSuiteClient, getValueMappingArtifactVersion } = require("./integration-suite-client");
const { validateEnvironment } = require("./environment-config");

/**
 * Compare selected Value Mapping design-time artifacts between environments.
 */
async function compareValueMappings(
  sourceEnvironment,
  targetEnvironment,
  selectedArtifacts
) {
  validateCompareRequest(
    sourceEnvironment,
    targetEnvironment,
    selectedArtifacts
  );

  const sourceClient = new IntegrationSuiteClient(sourceEnvironment);
  const targetClient = new IntegrationSuiteClient(targetEnvironment);

  const results = [];

  for (const selectedArtifact of selectedArtifacts) {
    try {
      const result = await compareSingleValueMapping(
        sourceClient,
        targetClient,
        sourceEnvironment,
        targetEnvironment,
        selectedArtifact
      );

      results.push(result);
    } catch (error) {
      console.error("[ValueMappingCompareService] Compare failed", {
        sourceEnvironment,
        targetEnvironment,
        packageId: selectedArtifact.packageId,
        artifactId: selectedArtifact.artifactId,
        message: error.message
      });

      results.push({
        packageId: selectedArtifact.packageId || "",
        artifactId: selectedArtifact.artifactId || "",
        artifactName:
          selectedArtifact.artifactName ||
          selectedArtifact.artifactId ||
          "",
        status: "ERROR",
        mappingSummary: createEmptySummary(),
        schemas: [],
        errors: [
          {
            message: "Unable to compare this Value Mapping artifact."
          }
        ]
      });
    }
  }

  return buildComparisonResponse(
    sourceEnvironment,
    targetEnvironment,
    results
  );
}

async function compareSingleValueMapping(
  sourceClient,
  targetClient,
  sourceEnvironment,
  targetEnvironment,
  selectedArtifact
) {
  const artifactId = selectedArtifact.artifactId;

  /*
   * Source version comes from the selected DEV/source Value Mapping artifact.
   * If needed, source metadata is looked up as a fallback.
   */
  const sourceArtifact =
    await sourceClient.getValueMappingArtifactById(artifactId);

  const sourceVersion =
    selectedArtifact.version ||
    getValueMappingArtifactVersion(sourceArtifact, "active");

  /*
   * Target artifact must be looked up independently.
   *
   * Do NOT reuse sourceVersion here.
   * DEV and QAS can legitimately have different Value Mapping versions.
   */
  const targetArtifact =
    await targetClient.getValueMappingArtifactById(artifactId);

  if (!targetArtifact) {
    return buildMissingTargetArtifactResult(selectedArtifact);
  }

  const targetVersion =
    getValueMappingArtifactVersion(targetArtifact, "active");

  console.log("[ValueMappingCompareService] Comparing Value Mapping", {
    sourceEnvironment,
    targetEnvironment,
    artifactId,
    sourceVersion,
    targetVersion
  });

  /*
   * Read schemas using each environment's own artifact version.
   */
  const sourceSchemas = await sourceClient.getValueMappingSchemas(
    artifactId,
    sourceVersion
  );

  const targetSchemas = await targetClient.getValueMappingSchemas(
    artifactId,
    targetVersion
  );

  const sourceSchemaMap = buildSchemaMap(sourceSchemas);
  const targetSchemaMap = buildSchemaMap(targetSchemas);

  const allSchemaKeys = new Set([
    ...sourceSchemaMap.keys(),
    ...targetSchemaMap.keys()
  ]);

  const schemaResults = [];

  for (const schemaKey of allSchemaKeys) {
    const sourceSchema = sourceSchemaMap.get(schemaKey);
    const targetSchema = targetSchemaMap.get(schemaKey);

    /*
     * Schema exists only in target.
     */
    if (!sourceSchema) {
      schemaResults.push({
        schema: normalizeSchema(targetSchema),
        status: "SCHEMA_ADDED_IN_TARGET",
        mappingComparisons: [],
        mappingSummary: {
          ...createEmptySummary(),
          addedInTarget: 1
        }
      });

      continue;
    }

    /*
     * Schema exists only in source.
     */
    if (!targetSchema) {
      schemaResults.push({
        schema: normalizeSchema(sourceSchema),
        status: "SCHEMA_REMOVED_FROM_TARGET",
        mappingComparisons: [],
        mappingSummary: {
          ...createEmptySummary(),
          removedFromTarget: 1
        }
      });

      continue;
    }

    /*
     * Read mapping entries with their respective environment versions.
     */
    const sourceEntries = await sourceClient.getValueMappingEntries(
      artifactId,
      sourceVersion,
      sourceSchema
    );

    const targetEntries = await targetClient.getValueMappingEntries(
      artifactId,
      targetVersion,
      targetSchema
    );

    const mappingComparisons = compareMappingEntries(
      sourceEntries,
      targetEntries
    );

    schemaResults.push({
      schema: normalizeSchema(sourceSchema),
      status: getSchemaStatus(mappingComparisons),
      mappingComparisons,
      mappingSummary: buildMappingSummary(mappingComparisons)
    });
  }

  const allMappingComparisons = schemaResults.flatMap(function (schemaResult) {
    return schemaResult.mappingComparisons || [];
  });

  const mappingSummary = buildMappingSummary(allMappingComparisons);

  /*
   * Count schema-only differences in the artifact-level summary.
   */
  schemaResults.forEach(function (schemaResult) {
    if (schemaResult.status === "SCHEMA_ADDED_IN_TARGET") {
      mappingSummary.addedInTarget += 1;
    }

    if (schemaResult.status === "SCHEMA_REMOVED_FROM_TARGET") {
      mappingSummary.removedFromTarget += 1;
    }
  });

  return {
    packageId: selectedArtifact.packageId || "",
    artifactId,
    artifactName:
      selectedArtifact.artifactName ||
      targetArtifact.Name ||
      targetArtifact.name ||
      artifactId,

    /*
     * Helpful for UI details and troubleshooting.
     * These are metadata only—not the values being compared.
     */
    sourceVersion,
    targetVersion,
    sourceEnvironment,
    targetEnvironment,

    status: hasDifferences(mappingSummary) ? "DIFFERENT" : "SAME",
    mappingSummary,
    schemas: schemaResults,
    errors: []
  };
}

function compareMappingEntries(sourceEntries, targetEntries) {
  const sourceMap = buildEntryMap(sourceEntries);
  const targetMap = buildEntryMap(targetEntries);

  const allSourceValues = new Set([
    ...sourceMap.keys(),
    ...targetMap.keys()
  ]);

  return [...allSourceValues]
    .sort(function (left, right) {
      return left.localeCompare(right);
    })
    .map(function (sourceValue) {
      const sourceEntry = sourceMap.get(sourceValue);
      const targetEntry = targetMap.get(sourceValue);

      if (!sourceEntry) {
        return {
          sourceValue,
          sourceEnvironmentValue: "",
          targetEnvironmentValue: getTargetValue(targetEntry),
          changeType: "ADDED_IN_TARGET"
        };
      }

      if (!targetEntry) {
        return {
          sourceValue,
          sourceEnvironmentValue: getTargetValue(sourceEntry),
          targetEnvironmentValue: "",
          changeType: "REMOVED_FROM_TARGET"
        };
      }

      const sourceTargetValue = getTargetValue(sourceEntry);
      const targetTargetValue = getTargetValue(targetEntry);

      return {
        sourceValue,
        sourceEnvironmentValue: sourceTargetValue,
        targetEnvironmentValue: targetTargetValue,
        changeType:
          sourceTargetValue === targetTargetValue
            ? "SAME"
            : "CHANGED"
      };
    });
}

function buildEntryMap(entries) {
  const result = new Map();

  (entries || []).forEach(function (entry) {
    const sourceValue = getSourceValue(entry);

    if (sourceValue === "") {
      return;
    }

    result.set(sourceValue, entry);
  });

  return result;
}

function getSourceValue(entry) {
  return String(
    entry?.SrcValue ??
    entry?.SourceValue ??
    entry?.srcValue ??
    ""
  ).trim();
}

function getTargetValue(entry) {
  return String(
    entry?.TgtValue ??
    entry?.TargetValue ??
    entry?.tgtValue ??
    ""
  ).trim();
}

function buildSchemaMap(schemas) {
  const result = new Map();

  (schemas || []).forEach(function (schema) {
    result.set(getSchemaKey(schema), schema);
  });

  return result;
}

function getSchemaKey(schema) {
  return [
    schema?.SrcAgency || "",
    schema?.SrcId || "",
    schema?.TgtAgency || "",
    schema?.TgtId || ""
  ].join("::");
}

function normalizeSchema(schema) {
  return {
    srcAgency: schema?.SrcAgency || "",
    srcId: schema?.SrcId || "",
    tgtAgency: schema?.TgtAgency || "",
    tgtId: schema?.TgtId || ""
  };
}

function buildMappingSummary(mappingComparisons) {
  const summary = createEmptySummary();

  (mappingComparisons || []).forEach(function (comparison) {
    switch (comparison.changeType) {
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

function createEmptySummary() {
  return {
    changed: 0,
    addedInTarget: 0,
    removedFromTarget: 0,
    same: 0
  };
}

function hasDifferences(summary) {
  return (
    summary.changed > 0 ||
    summary.addedInTarget > 0 ||
    summary.removedFromTarget > 0
  );
}

function getSchemaStatus(mappingComparisons) {
  const summary = buildMappingSummary(mappingComparisons);

  return hasDifferences(summary) ? "DIFFERENT" : "SAME";
}

function buildMissingTargetArtifactResult(selectedArtifact) {
  return {
    packageId: selectedArtifact.packageId || "",
    artifactId: selectedArtifact.artifactId || "",
    artifactName:
      selectedArtifact.artifactName ||
      selectedArtifact.artifactId ||
      "",
    status: "MISSING_IN_TARGET",
    mappingSummary: createEmptySummary(),
    schemas: [],
    errors: []
  };
}

function validateCompareRequest(
  sourceEnvironment,
  targetEnvironment,
  selectedArtifacts
) {
  validateEnvironment(sourceEnvironment);
  validateEnvironment(targetEnvironment);

  if (sourceEnvironment === targetEnvironment) {
    const error = new Error(
      "Source and target environments must be different."
    );

    error.statusCode = 400;
    error.code = "SAME_ENVIRONMENT";

    throw error;
  }

  if (!Array.isArray(selectedArtifacts) || selectedArtifacts.length === 0) {
    const error = new Error(
      "At least one Value Mapping artifact must be selected."
    );

    error.statusCode = 400;
    error.code = "NO_VALUE_MAPPINGS_SELECTED";

    throw error;
  }
}

function isNotFoundError(error) {
  return error?.statusCode === 404 || error?.response?.status === 404;
}

function buildComparisonResponse(
  sourceEnvironment,
  targetEnvironment,
  results
) {
  const summary = {
    totalArtifacts: results.length,
    sameArtifacts: 0,
    differentArtifacts: 0,
    missingInTarget: 0,
    errors: 0,
    changed: 0,
    addedInTarget: 0,
    removedFromTarget: 0,
    same: 0
  };

  results.forEach(function (result) {
    if (result.status === "SAME") {
      summary.sameArtifacts += 1;
    } else if (result.status === "DIFFERENT") {
      summary.differentArtifacts += 1;
    } else if (result.status === "MISSING_IN_TARGET") {
      summary.missingInTarget += 1;
    } else if (result.status === "ERROR") {
      summary.errors += 1;
    }

    summary.changed += result.mappingSummary?.changed || 0;
    summary.addedInTarget += result.mappingSummary?.addedInTarget || 0;
    summary.removedFromTarget += result.mappingSummary?.removedFromTarget || 0;
    summary.same += result.mappingSummary?.same || 0;
  });

  return {
    sourceEnvironment,
    targetEnvironment,
    comparedAt: new Date().toISOString(),
    summary,
    results
  };
}

module.exports = {
  compareValueMappings
};