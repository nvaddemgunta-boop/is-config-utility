const assert = require("node:assert/strict");

const { IntegrationSuiteClient } = require("../srv/lib/integration-suite-client");

async function run() {
  const client = new IntegrationSuiteClient("DEV");
  const originalGet = client._get.bind(client);
  const calls = [];

  client._get = async function (url, params = {}) {
    calls.push({ url, params });

    if (calls.length === 1) {
      return {
        data: {
          "@odata.nextLink": "/IntegrationPackages?$skiptoken='abc'",
          value: [{ Id: "pkg-1", Name: "First" }]
        }
      };
    }

    if (calls.length === 2) {
      return {
        data: {
          value: [{ Id: "pkg-2", Name: "Second" }]
        }
      };
    }

    throw new Error("Unexpected additional API call");
  };

  const packages = await client.getIntegrationPackages();

  assert.equal(calls.length, 2);
  assert.deepEqual(packages.map((pkg) => pkg.Id), ["pkg-1", "pkg-2"]);

  client._get = originalGet;
  console.log("integration-suite-client.test.js passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
