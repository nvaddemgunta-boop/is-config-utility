const cds = require("@sap/cds");
const express = require("express");

const { getDestination } = require("@sap-cloud-sdk/connectivity");

const { getEnvironments, validateEnvironment } = require("./srv/lib/environment-config");
const { getMockCatalog } = require("./srv/lib/mock-catalog-service");
const { compareMockArtifacts } = require("./srv/lib/mock-compare-service");
const { getCatalog, getPackageArtifacts } = require("./srv/lib/catalog-service");
const { compareArtifacts } = require("./srv/lib/compare-service");

const { getValueMappingPackageCatalog, getValueMappingsForPackage, clearValueMappingCache} = require("./srv/lib/value-mapping-catalog-service");
const { compareValueMappings } = require("./srv/lib/value-mapping-compare-service");
const { IntegrationSuiteClient } = require("./srv/lib/integration-suite-client");

cds.on("bootstrap", (app) => {
  app.use(express.json());

  /**
   * GET /api/environments
   */
  app.get("/api/environments", (req, res) => {
    try {
      res.json(getEnvironments());
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * GET /api/catalog?environment=DEV
   * Use mock with:
   * GET /api/catalog?environment=DEV&mock=true
   */
  app.get("/api/catalog", async (req, res) => {
    try {
      const environment = req.query.environment;
      const useMock = shouldUseMock(req);

      if (!environment) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      const catalog = useMock
        ? getMockCatalog(environment)
        : await getCatalog(environment);

      res.json(catalog);
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * GET /api/package-artifacts?environment=DEV&packageId=PACKAGE_ID
   *
   * Loads iFlows only when a user expands a package in the UI.
   */
  app.get("/api/package-artifacts", async (req, res) => {
    try {
      const environment = req.query.environment;
      const packageId = req.query.packageId;
      const useMock = shouldUseMock(req);

      if (!environment) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      if (!packageId) {
        return res.status(400).json({
          error: {
            code: "MISSING_PACKAGE_ID",
            message: "Query parameter 'packageId' is required."
          }
        });
      }

      if (useMock) {
        const mockCatalog = getMockCatalog(environment);
        const selectedPackage = mockCatalog.packages.find(function (pkg) {
          return pkg.packageId === packageId;
        });

        return res.json({
          environment: environment,
          packageId: packageId,
          iflows: selectedPackage ? selectedPackage.iflows : []
        });
      }

      const result = await getPackageArtifacts(environment, packageId);

      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * POST /api/compare
   * Real compare by default.
   * Use mock with:
   * POST /api/compare?mock=true
   */
  app.post("/api/compare", async (req, res) => {
    try {
      const body = req.body;
      const useMock = shouldUseMock(req);

      const result = useMock
        ? compareMockArtifacts(
            body.sourceEnvironment,
            body.targetEnvironment,
            body.selectedArtifacts
          )
        : await compareArtifacts(
            body.sourceEnvironment,
            body.targetEnvironment,
            body.selectedArtifacts
          );

      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * GET /api/value-mapping-catalog?environment=DEV
   *
   * Returns Integration Packages only. Value Mapping artifacts load later
   * when a specific package is expanded.
   */
  app.get("/api/value-mapping-catalog", async (req, res) => {
    try {
      const environment = req.query.environment;

      if (!environment) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      const catalog = await getValueMappingPackageCatalog(environment);
      res.json(catalog);
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * GET /api/value-mapping-package-artifacts
   *   ?environment=DEV
   *   &packageId=YOUR_PACKAGE_ID
   *
   * Returns Value Mapping artifacts belonging to one package.
   */
  app.get("/api/value-mapping-package-artifacts", async (req, res) => {
    try {
      const environment = req.query.environment;
      const packageId = req.query.packageId;

      if (!environment) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      if (!packageId) {
        return res.status(400).json({
          error: {
            code: "MISSING_PACKAGE_ID",
            message: "Query parameter 'packageId' is required."
          }
        });
      }

      const result = await getValueMappingsForPackage(
        environment,
        packageId
      );

      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * POST /api/value-mapping-cache/clear
   *
   * Development/admin endpoint. Protect or remove before production use.
   */
  app.post("/api/value-mapping-cache/clear", (req, res) => {
    try {
      const environment = req.body?.environment;

      clearValueMappingCache(environment);

      res.json({
        message: environment
          ? `Value Mapping cache cleared for ${environment}.`
          : "Value Mapping cache cleared for all environments."
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * TEMP DEBUG: Check if destination resolves.
   * Example:
   * /api/debug/destination?environment=DEV
   *
   * Remove or protect before production deployment.
   */
  app.get("/api/debug/destination", async (req, res) => {
    try {
      const environmentId = req.query.environment;

      if (!environmentId) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      const environment = validateEnvironment(environmentId);

      const destination = await getDestination({
        destinationName: environment.destinationName
      });

      if (!destination) {
        return res.status(404).json({
          error: {
            code: "DESTINATION_NOT_FOUND",
            message: `Destination '${environment.destinationName}' was not found or could not be resolved.`
          }
        });
      }

      res.json({
        environment: environment.id,
        destinationName: environment.destinationName,
        resolved: true,
        url: destination.url,
        authentication: destination.authentication,
        proxyType: destination.proxyType
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * TEMP DEBUG: Test IntegrationPackages.
   * Example:
   * /api/debug/packages?environment=DEV
   *
   * Remove or protect before production deployment.
   */
  app.get("/api/debug/packages", async (req, res) => {
    try {
      const environment = req.query.environment || "DEV";

      const client = new IntegrationSuiteClient(environment);
      const packages = await client.getIntegrationPackages();

      res.json({
        environment,
        count: packages.length,
        sample: packages.slice(0, 5)
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * TEMP DEBUG: Test design-time artifacts for a package.
   * Example:
   * /api/debug/artifacts?environment=DEV&packageId=YOUR_PACKAGE_ID
   *
   * Remove or protect before production deployment.
   */
  app.get("/api/debug/artifacts", async (req, res) => {
    try {
      const environment = req.query.environment || "DEV";
      const packageId = req.query.packageId;

      if (!packageId) {
        return res.status(400).json({
          error: {
            code: "MISSING_PACKAGE_ID",
            message: "Query parameter 'packageId' is required."
          }
        });
      }

      const client = new IntegrationSuiteClient(environment);
      const artifacts = await client.getDesignTimeArtifactsForPackage(packageId);

      res.json({
        environment,
        packageId,
        count: artifacts.length,
        sample: artifacts.slice(0, 5)
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * TEMP DEBUG: Raw GET against Integration Suite path.
   * Example:
   * /api/debug/raw-get?environment=DEV&path=/IntegrationPackages
   *
   * Remove or protect before production deployment.
   */
  app.get("/api/debug/raw-get", async (req, res) => {
    try {
      const environment = req.query.environment || "DEV";
      const path = req.query.path || "/IntegrationPackages";

      const client = new IntegrationSuiteClient(environment);
      const response = await client._get(path);

      res.json({
        environment,
        path,
        status: response.status,
        data: response.data
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * TEMP DEBUG: Retrieves externalized parameters for one iFlow.
   *
   * Example:
   * /api/debug/configurations?environment=DEV
   *   &artifactId=MY_IFLOW
   *   &version=1.0.0
   *
   * Remove or protect before production deployment.
   */
  app.get("/api/debug/configurations", async (req, res) => {
    try {
      const environment = req.query.environment;
      const artifactId = req.query.artifactId;
      const version = req.query.version;

      if (!environment) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      if (!artifactId) {
        return res.status(400).json({
          error: {
            code: "MISSING_ARTIFACT_ID",
            message: "Query parameter 'artifactId' is required."
          }
        });
      }

      const client = new IntegrationSuiteClient(environment);
      const configurations = await client.getExternalizedParameters(
        artifactId,
        version
      );

      /*
      * Return keys and values only for development validation.
      * Do not log these values in the terminal.
      */
      res.json({
        environment,
        artifactId,
        version: version || "active",
        count: configurations.length,
        configurations
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/debug/value-mappings", async (req, res) => {
    try {
      const environment = req.query.environment;

      if (!environment) {
        return res.status(400).json({
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Query parameter 'environment' is required."
          }
        });
      }

      const client = new IntegrationSuiteClient(environment);
      const valueMappings = await client.getValueMappingArtifacts();

      res.json({
        environment,
        count: valueMappings.length,
        sample: valueMappings.slice(0, 10)
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/debug/value-mapping-schemas", async (req, res) => {
    try {
      const environment = req.query.environment;
      const artifactId = req.query.artifactId;
      const version = req.query.version || "active";

      if (!environment || !artifactId) {
        return res.status(400).json({
          error: {
            code: "MISSING_PARAMETERS",
            message: "environment and artifactId are required."
          }
        });
      }

      const client = new IntegrationSuiteClient(environment);
      const schemas = await client.getValueMappingSchemas(
        artifactId,
        version
      );

      res.json({
        environment,
        artifactId,
        version,
        count: schemas.length,
        schemas
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * TEMP DEBUG: Retrieve value-mapping entries for one artifact/schema.
   *
   * Remove or secure before production deployment.
   */
  app.get("/api/debug/value-mapping-entries", async (req, res) => {
    try {
      const environment = req.query.environment;
      const artifactId = req.query.artifactId;
      const version = req.query.version || "active";

      const schema = {
        SrcAgency: req.query.srcAgency,
        SrcId: req.query.srcId,
        TgtAgency: req.query.tgtAgency,
        TgtId: req.query.tgtId
      };

      if (!environment || !artifactId) {
        return res.status(400).json({
          error: {
            code: "MISSING_PARAMETERS",
            message: "environment and artifactId are required."
          }
        });
      }

      const client = new IntegrationSuiteClient(environment);

      const entries = await client.getValueMappingEntries(
        artifactId,
        version,
        schema
      );

      res.json({
        environment,
        artifactId,
        version,
        schema,
        count: entries.length,
        entries
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * POST /api/value-mappings/compare
   *
   * Compares selected Value Mapping artifacts and their mapping entries.
   */
  app.post("/api/value-mappings/compare", async (req, res) => {
    try {
      const body = req.body || {};

      const result = await compareValueMappings(
        body.sourceEnvironment,
        body.targetEnvironment,
        body.selectedArtifacts
      );

      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });
});

function shouldUseMock(req) {
  /**
   * You can force mock mode with:
   * /api/catalog?environment=DEV&mock=true
   * /api/compare?mock=true
   *
   * Or set environment variable:
   * USE_MOCK_DATA=true
   */
  return req.query.mock === "true" || process.env.USE_MOCK_DATA === "true";
}

function handleError(res, error) {
  const statusCode = error.statusCode || 500;

  console.error("[server] Request failed", {
    code: error.code,
    message: error.message,
    statusCode
  });

  res.status(statusCode).json({
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred."
    }
  });
}

module.exports = cds.server;