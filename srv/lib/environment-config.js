const ENVIRONMENTS = [
  {
    id: "DEV",
    name: "Development",
    destinationName: "IS_DEV"
  },
  {
    id: "QAS",
    name: "Quality",
    destinationName: "IS_QAS"
  },
  {
    id: "UAT",
    name: "UAT",
    destinationName: "IS_UAT"
  },
  {
    id: "PROD",
    name: "Production",
    destinationName: "IS_PROD"
  }
];

function getEnvironments() {
  return ENVIRONMENTS.map((env) => ({
    id: env.id,
    name: env.name
  }));
}

function getEnvironmentById(environmentId) {
  return ENVIRONMENTS.find((env) => env.id === environmentId);
}

function validateEnvironment(environmentId) {
  const environment = getEnvironmentById(environmentId);

  if (!environment) {
    const error = new Error(`Environment '${environmentId}' is not configured.`);
    error.statusCode = 400;
    error.code = "INVALID_ENVIRONMENT";
    throw error;
  }

  return environment;
}

module.exports = {
  getEnvironments,
  getEnvironmentById,
  validateEnvironment
};