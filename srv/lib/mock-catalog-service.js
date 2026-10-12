const { validateEnvironment } = require("./environment-config");

function getMockCatalog(environmentId) {
  validateEnvironment(environmentId);

  return {
    environment: environmentId,
    retrievedAt: new Date().toISOString(),
    packages: [
      {
        packageId: "ERP_INTEGRATIONS",
        packageName: `ERP Integrations - ${environmentId}`,
        description: "ERP related integration flows",
        selected: false,
        iflows: [
          {
            artifactId: "SALES_ORDER_TO_S4",
            artifactName: "Sales Order to S4",
            version: environmentId === "DEV" ? "1.0.4" : "1.0.2",
            deployed: true,
            selected: false
          },
          {
            artifactId: "CUSTOMER_MASTER_TO_S4",
            artifactName: "Customer Master to S4",
            version: "1.0.1",
            deployed: true,
            selected: false
          }
        ]
      },
      {
        packageId: "FINANCE_INTEGRATIONS",
        packageName: `Finance Integrations - ${environmentId}`,
        description: "Finance related integration flows",
        selected: false,
        iflows: [
          {
            artifactId: "INVOICE_TO_S4",
            artifactName: "Invoice to S4",
            version: environmentId === "PROD" ? "2.0.0" : "2.1.0",
            deployed: true,
            selected: false
          },
          {
            artifactId: "PAYMENT_STATUS_TO_BANK",
            artifactName: "Payment Status to Bank",
            version: "1.3.0",
            deployed: environmentId !== "DEV",
            selected: false
          }
        ]
      }
    ]
  };
}

module.exports = {
  getMockCatalog
};