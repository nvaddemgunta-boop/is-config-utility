const { validateEnvironment } = require("./environment-config");

function compareMockArtifacts(sourceEnvironment, targetEnvironment, selectedArtifacts) {
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

  const results = selectedArtifacts.map((artifact, index) => {
    const isDifferent = index % 2 === 0;

    return {
      packageId: artifact.packageId,
      artifactId: artifact.artifactId,
      artifactName: artifact.artifactName || artifact.artifactId,
      status: isDifferent ? "DIFFERENT" : "SAME",
      differences: isDifferent
        ? [
            {
              category: "METADATA",
              field: "version",
              sourceValue: sourceEnvironment === "DEV" ? "1.0.4" : "1.0.2",
              targetValue: targetEnvironment === "QAS" ? "1.0.2" : "1.0.4",
              result: "DIFFERENT"
            },
            {
              category: "EXTERNALIZED_PARAMETER",
              field: "receiver_host",
              sourceValue: `${sourceEnvironment.toLowerCase()}-api.example.com`,
              targetValue: `${targetEnvironment.toLowerCase()}-api.example.com`,
              result: "EXPECTED_DIFFERENCE"
            }
          ]
        : []
    };
  });

  return {
    sourceEnvironment,
    targetEnvironment,
    comparedAt: new Date().toISOString(),
    summary: {
      totalCompared: results.length,
      same: results.filter((r) => r.status === "SAME").length,
      different: results.filter((r) => r.status === "DIFFERENT").length,
      missingInTarget: 0
    },
    results
  };
}

module.exports = {
  compareMockArtifacts
};