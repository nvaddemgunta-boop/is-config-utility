sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/Dialog",
  "sap/m/Table",
  "sap/m/Column",
  "sap/m/ColumnListItem",
  "sap/m/Text",
  "sap/m/Button",
  "sap/m/ObjectStatus"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Dialog,
    Table,
    Column,
    ColumnListItem,
    Text,
    Button,
    ObjectStatus
  ) {
  "use strict";

  return Controller.extend("btpis.iflowcompare.controller.App", {

    onInit: function () {
      this._sourceEnvironment = null;
      this._targetEnvironment = null;

      this._sourceCatalogFull = [];
      this._targetCatalogFull = [];
      this._sourceSearchText = "";
      this._targetSearchText = "";

      this._vmSourceEnvironment = null;
      this._vmTargetEnvironment = null;

      this._vmSourceCatalogFull = [];
      this._vmTargetCatalogFull = [];

      this._vmSourceSearchText = "";
      this._vmTargetSearchText = "";
      this._deploymentSourcePackages = [];
      this._deploymentTargetPackages = [];
      this._deploymentPackageRequests = { source: 0, target: 0 };
      this._deploymentArtifactRequests = { source: 0, target: 0 };
      this._deploymentCompareRequest = 0;

      this.getView().setModel(new JSONModel({
        environments: []
      }), "env");

      this.getView().setModel(new JSONModel({
        packages: []
      }), "source");

      this.getView().setModel(new JSONModel({
        packages: []
      }), "target");

      this.getView().setModel(new JSONModel({
        packages: []
      }), "vmSource");

      this.getView().setModel(new JSONModel({
        packages: []
      }), "vmTarget");

      this.getView().setModel(new JSONModel({
        selectionText: "No iFlows selected",
        vmSelectionText: "No value mappings selected",
        sourceEnvironment: "",
        targetEnvironment: "",
        vmSourceEnvironment: "",
        vmTargetEnvironment: "",
        activeFeature: "IFLOW_CONFIG"
      }), "view");

      this.getView().setModel(new JSONModel({
        summary: {
          totalCompared: 0,
          same: 0,
          different: 0,
          missingInTarget: 0
        },
        results: []
      }), "result");

      this.getView().setModel(new JSONModel({
        selectedFilter: "ALL",
        searchText: "",
        parameterResults: [],
        summary: {
          changed: 0,
          addedInTarget: 0,
          removedFromTarget: 0,
          same: 0
        }
      }), "parameterView");

      this.getView().setModel(new JSONModel({
        packages: []
      }), "vmSource");

      this.getView().setModel(new JSONModel({
        packages: []
      }), "vmTarget");

      this.getView().setModel(new JSONModel({
        sourceEnvironment: "",
        targetEnvironment: "",
        selectedFilter: "ALL",
        searchText: "",
        summary: {
          changed: 0,
          addedInTarget: 0,
          removedFromTarget: 0,
          same: 0
        },
        allRows: [],
        allGroups: [],
        groups: []
      }), "vmComparison");

      this.getView().setModel(new JSONModel({
        mode: "PACKAGE",
        sourceEnvironment: "",
        targetEnvironment: "",
        sourceEnvironmentSelection: "__SELECT_SOURCE_ENVIRONMENT__",
        targetEnvironmentSelection: "__SELECT_TARGET_ENVIRONMENT__",
        packageSearch: "",
        packages: [],
        sourcePackages: [],
        targetPackages: [],
        sourceArtifacts: [],
        targetArtifacts: [],
        sourceVisibleArtifacts: [],
        targetVisibleArtifacts: [],
        sourceArtifactSearch: "",
        targetArtifactSearch: "",
        selectedArtifactType: "__ALL_TYPES__",
        artifactTypes: [{ key: "__ALL_TYPES__", text: "All Types", icon: "sap-icon://grid" }],
        sourceArtifactsLoading: false,
        targetArtifactsLoading: false,
        selectedSourcePackageId: "",
        selectedTargetPackageId: "",
        selectedSourceArtifactKey: "",
        selectedTargetArtifactKey: "",
        allPackagesSelected: false,
        selectedPackageCount: 0,
        packageLoading: false,
        busy: false,
        summary: {
          packagesCompared: 0,
          totalArtifacts: 0,
          same: 0,
          different: 0,
          missingInSource: 0,
          missingInTarget: 0,
          notDeployed: 0,
          errors: 0
        },
        packageResults: []
      }), "deploymentRuntime");

      this._loadEnvironments();
      this._setActiveFeatureStep("IFLOW_CONFIG");
    },

    _loadEnvironments: async function () {
      try {
        const response = await fetch("/api/environments");

        if (!response.ok) {
          throw new Error("Failed to load environments");
        }

        const data = await response.json();
        this.getView().getModel("env").setProperty("/environments", data);
      } catch (error) {
        MessageBox.error("Unable to load environments from backend.");
        console.error(error);
      }
    },

    onFeatureTabSelect: function (event) {
      const selectedKey = event.getParameter("key");

      const featureNames = {
        IFLOW_CONFIG: "Integration Flow Configuration",
        VALUE_MAPPING: "Value Mapping Comparison",
        DEPLOYMENT_VERSION: "Deployment Runtime Comparison",
        CONFIG_EXPORT: "Configuration Export",
        TENANT_SEARCH: "Tenant Configuration Search",
        YAML_VALIDATOR: "YAML Validator",
        PAYLOAD_TOOLS: "Payload Tools"
      };

      const selectedFeature = featureNames[selectedKey] || "Selected feature";

      if (selectedKey === "IFLOW_CONFIG") {
        MessageToast.show("Integration Flow Configuration is active.");
        return;
      }

      MessageToast.show(
        `${selectedFeature} is planned for a future enhancement.`
      );

      /*
      * Keep Integration Flow Configuration selected for now because
      * the other modules are placeholders only.
      */
      this.byId("featureNavigation").setSelectedKey("IFLOW_CONFIG");
    },

    onFeatureButtonPress: function (event) {
      const featureKey = event.getSource().data("feature");

      const featureNames = {
        IFLOW_CONFIG: "Integration Flow Configuration",
        VALUE_MAPPING: "Value Mapping Comparison",
        DEPLOYMENT_VERSION: "Deployment Runtime Comparison",
        CONFIG_EXPORT: "Configuration Export",
        TENANT_SEARCH: "Tenant Configuration Search",
        YAML_VALIDATOR: "YAML Validator",
        PAYLOAD_TOOLS: "Payload Tools"
      };

      const supportedFeatures = [
        "IFLOW_CONFIG",
        "VALUE_MAPPING",
        "DEPLOYMENT_VERSION"
      ];

      if (!supportedFeatures.includes(featureKey)) {
        MessageToast.show(
          `${featureNames[featureKey] || "This feature"} is planned for a future enhancement.`
        );
        return;
      }

      this.getView()
        .getModel("view")
        .setProperty("/activeFeature", featureKey);

      this._setActiveFeatureStep(featureKey);

      MessageToast.show(`${featureNames[featureKey]} is active.`);
    },

    onDeploymentModeChange: function (event) {
      const mode = event.getParameter("item").getKey();
      const model = this.getView().getModel("deploymentRuntime");
      model.setProperty("/mode", mode);
      this._clearDeploymentResults();

      if (mode === "ARTIFACT") {
        const sourceEnvironment = model.getProperty("/sourceEnvironment");
        const targetEnvironment = model.getProperty("/targetEnvironment");
        if (sourceEnvironment) {
          this._loadDeploymentRuntimeArtifacts(sourceEnvironment, "source");
        }
        if (targetEnvironment) {
          this._loadDeploymentRuntimeArtifacts(targetEnvironment, "target");
        }
      }
    },

    onDeploymentSourceEnvironmentChange: async function (event) {
      const selectedKey = event.getSource().getSelectedKey();
      const environment = selectedKey === "__SELECT_SOURCE_ENVIRONMENT__"
        ? ""
        : selectedKey;
      const model = this.getView().getModel("deploymentRuntime");
      const mode = model.getProperty("/mode");

      model.setProperty("/sourceEnvironmentSelection", selectedKey);
      model.setProperty("/sourceEnvironment", environment);
      model.setProperty("/selectedSourcePackageId", "");
      model.setProperty("/sourceArtifacts", []);
      model.setProperty("/sourceVisibleArtifacts", []);
      model.setProperty("/selectedSourceArtifactKey", "");
      model.setProperty("/sourceArtifactsLoading", false);
      model.setProperty("/packages", []);
      model.setProperty("/selectedPackageCount", 0);
      model.setProperty("/allPackagesSelected", false);
      this._deploymentSourcePackages = [];
      this._deploymentPackageRequests.source += 1;
      this._deploymentArtifactRequests.source += 1;
      this._clearDeploymentResults();

      if (environment && mode === "ARTIFACT") {
        await this._loadDeploymentRuntimeArtifacts(environment, "source");
      } else if (environment) {
        await this._loadDeploymentPackages(environment, "source");
      } else {
        this._applyDeploymentPackageFilter();
      }
    },

    onDeploymentTargetEnvironmentChange: async function (event) {
      const selectedKey = event.getSource().getSelectedKey();
      const environment = selectedKey === "__SELECT_TARGET_ENVIRONMENT__"
        ? ""
        : selectedKey;
      const model = this.getView().getModel("deploymentRuntime");
      const mode = model.getProperty("/mode");

      model.setProperty("/targetEnvironmentSelection", selectedKey);
      model.setProperty("/targetEnvironment", environment);
      model.setProperty("/selectedTargetPackageId", "");
      model.setProperty("/targetArtifacts", []);
      model.setProperty("/targetVisibleArtifacts", []);
      model.setProperty("/selectedTargetArtifactKey", "");
      model.setProperty("/targetArtifactsLoading", false);
      model.setProperty("/targetPackages", []);
      this._deploymentTargetPackages = [];
      this._deploymentPackageRequests.target += 1;
      this._deploymentArtifactRequests.target += 1;
      this._clearDeploymentResults();

      if (environment && mode === "ARTIFACT") {
        await this._loadDeploymentRuntimeArtifacts(environment, "target");
      } else if (environment) {
        await this._loadDeploymentPackages(environment, "target");
      }
    },

    _loadDeploymentPackages: async function (environment, side) {
      const requestId = ++this._deploymentPackageRequests[side];
      const model = this.getView().getModel("deploymentRuntime");
      model.setProperty("/packageLoading", true);

      try {
        const response = await fetch(
          `/api/deployment-runtime/packages?environment=${encodeURIComponent(environment)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error?.message || "Unable to load packages.");
        }

        if (
          requestId !== this._deploymentPackageRequests[side] ||
          model.getProperty(`/${side}Environment`) !== environment
        ) {
          return;
        }

        const packages = Array.isArray(data.packages) ? data.packages : [];
        if (side === "source") {
          this._deploymentSourcePackages = packages;
          this._applyDeploymentPackageFilter();
        } else {
          this._deploymentTargetPackages = packages;
          model.setProperty("/targetPackages", packages);
          this._updateDeploymentRuntimeSizeLimit();
        }
      } catch (error) {
        if (requestId === this._deploymentPackageRequests[side]) {
          MessageBox.error(`Unable to load ${environment} packages. ${error.message || ""}`);
        }
      } finally {
        if (requestId === this._deploymentPackageRequests[side]) {
          model.setProperty("/packageLoading", false);
        }
      }
    },

    async _loadDeploymentRuntimeArtifacts(environment, side) {
      const requestId = ++this._deploymentArtifactRequests[side];
      const model = this.getView().getModel("deploymentRuntime");
      const loadingProperty = side === "source"
        ? "/sourceArtifactsLoading"
        : "/targetArtifactsLoading";
      const artifactsProperty = side === "source"
        ? "/sourceArtifacts"
        : "/targetArtifacts";
      const visibleProperty = side === "source"
        ? "/sourceVisibleArtifacts"
        : "/targetVisibleArtifacts";

      model.setProperty(loadingProperty, true);

      try {
        const response = await fetch(
          `/api/deployment-runtime/artifacts?environment=${encodeURIComponent(environment)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error?.message || "Unable to load runtime artifacts.");
        }

        if (
          requestId !== this._deploymentArtifactRequests[side] ||
          model.getProperty(`/${side}Environment`) !== environment ||
          model.getProperty("/mode") !== "ARTIFACT"
        ) {
          return;
        }

        const artifacts = (data.artifacts || []).map(function (artifact) {
          return Object.assign({}, artifact, {
            artifactKey: JSON.stringify([artifact.artifactType, artifact.artifactId]),
            displayName: artifact.artifactName || artifact.artifactId
          });
        });
        model.setProperty(artifactsProperty, artifacts);
        this._syncDeploymentTargetArtifact(false);
        this._refreshDeploymentArtifactTypes();
        this._updateDeploymentRuntimeSizeLimit(artifacts.length);
      } catch (error) {
        if (requestId === this._deploymentArtifactRequests[side]) {
          MessageBox.error(`Unable to load runtime artifacts for ${environment}. ${error.message || ""}`);
        }
      } finally {
        if (requestId === this._deploymentArtifactRequests[side]) {
          model.setProperty(loadingProperty, false);
        }
      }
    },

    onDeploymentArtifactSearch: function (event) {
      const side = event.getSource().data("side");
      const searchProperty = side === "source"
        ? "/sourceArtifactSearch"
        : "/targetArtifactSearch";
      const searchText = event.getParameter("newValue") || event.getParameter("query") || "";
      this.getView().getModel("deploymentRuntime").setProperty(searchProperty, searchText);
      this._filterDeploymentRuntimeArtifacts(side, searchText);
    },

    _refreshDeploymentArtifactTypes: function () {
      const model = this.getView().getModel("deploymentRuntime");
      const types = new Set([
        ...(model.getProperty("/sourceArtifacts") || []),
        ...(model.getProperty("/targetArtifacts") || [])
      ].map(function (artifact) {
        return artifact.artifactType || "Unknown";
      }));
      model.setProperty("/artifactTypes", [
        { key: "__ALL_TYPES__", text: "All Types", icon: "sap-icon://grid" },
        ...Array.from(types).sort().map(function (type) {
          return { key: type, text: type, icon: this._getDeploymentArtifactTypeIcon(type) };
        }, this)
      ]);
      this._applyDeploymentArtifactFilters();
    },

    _getDeploymentArtifactTypeIcon: function (type) {
      const normalizedType = String(type || "").toUpperCase().replace(/[\s-]+/g, "_");
      const icons = {
        INTEGRATION_FLOW: "sap-icon://process",
        MESSAGE_MAPPING: "sap-icon://compare",
        VALUE_MAPPING: "sap-icon://table-view",
        SCRIPT_COLLECTION: "sap-icon://source-code",
        FUNCTION_LIBRARY: "sap-icon://source-code",
        FUNCTION_LIBRARIES: "sap-icon://source-code",
        JDBC_DRIVER: "sap-icon://database",
        REST_API_PROVIDER: "sap-icon://world",
        SOAP_API_PROVIDER: "sap-icon://connected"
      };
      return icons[normalizedType] || "sap-icon://document";
    },

    onDeploymentArtifactTypeChange: function (event) {
      const button = event.getSource();
      this.getView().getModel("deploymentRuntime").setProperty(
        "/selectedArtifactType",
        button.getBindingContext("deploymentRuntime").getObject().key
      );
      button.setPressed(true);
      this._applyDeploymentArtifactFilters();
    },

    _applyDeploymentArtifactFilters: function () {
      const model = this.getView().getModel("deploymentRuntime");
      this._filterDeploymentRuntimeArtifacts("source", model.getProperty("/sourceArtifactSearch"));
      this._filterDeploymentRuntimeArtifacts("target", model.getProperty("/targetArtifactSearch"));
    },

    _filterDeploymentRuntimeArtifacts: function (side, searchText) {
      const model = this.getView().getModel("deploymentRuntime");
      const artifactsProperty = side === "source" ? "/sourceArtifacts" : "/targetArtifacts";
      const visibleProperty = side === "source"
        ? "/sourceVisibleArtifacts"
        : "/targetVisibleArtifacts";
      const query = String(searchText || "").trim().toLowerCase();
      const selectedType = model.getProperty("/selectedArtifactType") || "__ALL_TYPES__";
      const artifacts = (model.getProperty(artifactsProperty) || []).filter(function (artifact) {
        const matchesType = selectedType === "__ALL_TYPES__" ||
          (artifact.artifactType || "Unknown") === selectedType;
        return matchesType && (!query || [
          artifact.artifactId,
          artifact.artifactName,
          artifact.artifactType,
          artifact.packageId,
          artifact.runtimeVersion,
          artifact.runtimeStatus
        ].join(" ").toLowerCase().includes(query));
      });

      model.setProperty(visibleProperty, artifacts);
      this._updateDeploymentRuntimeSizeLimit(artifacts.length);
    },

    onDeploymentRuntimeArtifactSelect: function (event) {
      const side = event.getSource().data("side");
      const artifact = event.getSource().getBindingContext("deploymentRuntime").getObject();
      const property = side === "source"
        ? "/selectedSourceArtifactKey"
        : "/selectedTargetArtifactKey";
      this.getView().getModel("deploymentRuntime").setProperty(property, artifact.artifactKey);
      if (side === "source") {
        this._syncDeploymentTargetArtifact(true);
      }
      this._clearDeploymentResults();
    },

    _syncDeploymentTargetArtifact: function (replaceSelection) {
      const model = this.getView().getModel("deploymentRuntime");
      if (!replaceSelection && model.getProperty("/selectedTargetArtifactKey")) {
        return;
      }

      const sourceKey = model.getProperty("/selectedSourceArtifactKey");
      const source = (model.getProperty("/sourceArtifacts") || []).find(function (artifact) {
        return artifact.artifactKey === sourceKey;
      });
      const matches = source
        ? (model.getProperty("/targetArtifacts") || []).filter(function (artifact) {
            return artifact.artifactId === source.artifactId &&
              artifact.artifactType === source.artifactType;
          })
        : [];

      model.setProperty("/selectedTargetArtifactKey", matches.length === 1
        ? matches[0].artifactKey
        : "");
    },

    onDeploymentPackageSearch: function (event) {
      const model = this.getView().getModel("deploymentRuntime");
      model.setProperty(
        "/packageSearch",
        event.getParameter("newValue") || event.getParameter("query") || ""
      );
      this._applyDeploymentPackageFilter();
    },

    _applyDeploymentPackageFilter: function () {
      const model = this.getView().getModel("deploymentRuntime");
      const query = String(model.getProperty("/packageSearch") || "")
        .trim()
        .toLowerCase();
      const packages = this._deploymentSourcePackages.filter(function (pkg) {
        return !query || [pkg.packageId, pkg.packageName, pkg.description]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

      this._updateDeploymentRuntimeSizeLimit(packages.length);
      model.setProperty("/packages", packages);
      model.setProperty("/selectedPackageCount", this._deploymentSourcePackages.filter(function (pkg) {
        return pkg.selected;
      }).length);
      model.setProperty("/allPackagesSelected", this._deploymentSourcePackages.length > 0 &&
        this._deploymentSourcePackages.every(function (pkg) { return pkg.selected; }));
    },

    onDeploymentPackageSelect: function (event) {
      const selectedPackage = event.getSource()
        .getBindingContext("deploymentRuntime")
        .getObject();
      const selected = event.getSource().getSelected();
      const canonical = this._deploymentSourcePackages.find(function (pkg) {
        return pkg.packageId === selectedPackage.packageId;
      });

      if (canonical) {
        canonical.selected = selected;
      }

      this._applyDeploymentPackageFilter();
      this._clearDeploymentResults();
    },

    onDeploymentSelectAllPackages: function (event) {
      const selected = event.getSource().getSelected();
      this._deploymentSourcePackages.forEach(function (pkg) {
        pkg.selected = selected;
      });
      this._applyDeploymentPackageFilter();
      this._clearDeploymentResults();
    },

    onDeploymentPairPackageChange: async function (event) {
      const side = event.getSource().data("side");
      const packageId = event.getSource().getSelectedKey();
      const model = this.getView().getModel("deploymentRuntime");
      const packageProperty = side === "source"
        ? "/selectedSourcePackageId"
        : "/selectedTargetPackageId";
      const artifactsProperty = side === "source"
        ? "/sourceArtifacts"
        : "/targetArtifacts";
      const selectedArtifactProperty = side === "source"
        ? "/selectedSourceArtifactKey"
        : "/selectedTargetArtifactKey";
      const environment = model.getProperty(`/${side}Environment`);

      model.setProperty(packageProperty, packageId);
      model.setProperty(artifactsProperty, []);
      model.setProperty(selectedArtifactProperty, "");
      this._clearDeploymentResults();

      if (!environment || !packageId) {
        return;
      }

      await this._loadDeploymentArtifacts(environment, packageId, side);
    },

    async _loadDeploymentArtifacts(environment, packageId, side) {
      const requestId = ++this._deploymentArtifactRequests[side];
      const model = this.getView().getModel("deploymentRuntime");

      try {
        const response = await fetch(
          `/api/deployment-runtime/package-artifacts?environment=${encodeURIComponent(environment)}` +
          `&packageId=${encodeURIComponent(packageId)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error?.message || "Unable to load runtime artifacts.");
        }

        if (
          requestId !== this._deploymentArtifactRequests[side] ||
          model.getProperty(`/${side}Environment`) !== environment ||
          model.getProperty(`/selected${side === "source" ? "Source" : "Target"}PackageId`) !== packageId
        ) {
          return;
        }

        const artifacts = (data.artifacts || []).map(function (artifact) {
          return Object.assign({}, artifact, {
            artifactKey: JSON.stringify([artifact.artifactType, artifact.artifactId]),
            displayName: `${artifact.artifactName} (${artifact.artifactType})`
          });
        });
        model.setProperty(side === "source" ? "/sourceArtifacts" : "/targetArtifacts", artifacts);
        this._updateDeploymentRuntimeSizeLimit(artifacts.length);
      } catch (error) {
        if (requestId === this._deploymentArtifactRequests[side]) {
          MessageBox.error(`Unable to load runtime artifacts. ${error.message || ""}`);
        }
      }
    },

    onDeploymentPairArtifactChange: function (event) {
      const side = event.getSource().data("side");
      const property = side === "source"
        ? "/selectedSourceArtifactKey"
        : "/selectedTargetArtifactKey";
      this.getView().getModel("deploymentRuntime").setProperty(
        property,
        event.getSource().getSelectedKey()
      );
      this._clearDeploymentResults();
    },

    _clearDeploymentResults: function () {
      const model = this.getView().getModel("deploymentRuntime");
      this._deploymentCompareRequest += 1;
      model.setProperty("/busy", false);
      model.setProperty("/packageResults", []);
      model.setProperty("/summary", {
        packagesCompared: 0,
        totalArtifacts: 0,
        same: 0,
        different: 0,
        missingInSource: 0,
        missingInTarget: 0,
        notDeployed: 0,
        errors: 0
      });
    },

    _updateDeploymentRuntimeSizeLimit: function (visibleCount) {
      const model = this.getView().getModel("deploymentRuntime");
      model.setSizeLimit(Math.max(
        100,
        visibleCount || 0,
        this._deploymentSourcePackages.length,
        this._deploymentTargetPackages.length,
        model.getProperty("/sourceArtifacts").length,
        model.getProperty("/targetArtifacts").length
      ));
    },

    onDeploymentRuntimeCompare: async function () {
      const model = this.getView().getModel("deploymentRuntime");
      const data = model.getData();

      if (!data.sourceEnvironment || !data.targetEnvironment) {
        MessageBox.warning("Select both source and target environments.");
        return;
      }
      if (data.sourceEnvironment === data.targetEnvironment) {
        MessageBox.warning("Source and target environments must be different.");
        return;
      }

      const mode = data.mode || "PACKAGE";
      let request;
      if (mode === "ARTIFACT") {
        const sourceArtifact = (data.sourceArtifacts || []).find(function (artifact) {
          return artifact.artifactKey === data.selectedSourceArtifactKey;
        });
        const targetArtifact = (data.targetArtifacts || []).find(function (artifact) {
          return artifact.artifactKey === data.selectedTargetArtifactKey;
        });
        if (!sourceArtifact || !targetArtifact) {
          MessageBox.warning("Select one source and one target runtime artifact.");
          return;
        }
        request = {
          mode,
          artifactPair: {
            source: sourceArtifact,
            target: targetArtifact
          }
        };
      } else {
        const selectedPackages = this._deploymentSourcePackages.filter(function (pkg) {
          return pkg.selected;
        });
        if (selectedPackages.length === 0) {
          MessageBox.warning("Select at least one source package to compare.");
          return;
        }
        request = {
          mode,
          packageIds: selectedPackages.map(function (pkg) { return pkg.packageId; }),
          packages: selectedPackages.reduce(function (packageMap, pkg) {
            packageMap[pkg.packageId] = pkg;
            return packageMap;
          }, {})
        };
      }

      const requestId = ++this._deploymentCompareRequest;
      model.setProperty("/busy", true);
      try {
        const response = await fetch("/api/deployment-runtime/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign(request, {
            sourceEnvironment: data.sourceEnvironment,
            targetEnvironment: data.targetEnvironment
          }))
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error?.message || "Runtime comparison failed.");
        }
        if (requestId !== this._deploymentCompareRequest) {
          return;
        }
        model.setProperty("/summary", result.summary || {});
        model.setProperty("/packageResults", result.packageResults || []);
        MessageToast.show("Deployment runtime comparison completed.");
      } catch (error) {
        if (requestId === this._deploymentCompareRequest) {
          MessageBox.error(error.message || "Unable to compare deployment runtime versions.");
        }
      } finally {
        if (requestId === this._deploymentCompareRequest) {
          model.setProperty("/busy", false);
        }
      }
    },

    formatRuntimeComparisonText: function (status) {
      const labels = {
        SAME: "Same",
        DIFFERENT: "Different",
        MISSING_IN_SOURCE: "Missing in source",
        MISSING_IN_TARGET: "Missing in target",
        NOT_DEPLOYED: "Not deployed",
        ERROR: "Error"
      };
      return labels[status] || status || "Unknown";
    },

    formatRuntimeComparisonState: function (status) {
      const states = {
        SAME: "Success",
        DIFFERENT: "Warning",
        MISSING_IN_SOURCE: "Error",
        MISSING_IN_TARGET: "Error",
        NOT_DEPLOYED: "Information",
        ERROR: "Error"
      };
      return states[status] || "None";
    },

    _setActiveFeatureStep: function (featureKey) {
      const featureButtonIds = {
        IFLOW_CONFIG: "btnIflowConfig",
        VALUE_MAPPING: "btnValueMapping",
        DEPLOYMENT_VERSION: "btnDeploymentVersion",
        CONFIG_EXPORT: "btnConfigExport",
        TENANT_SEARCH: "btnTenantSearch",
        YAML_VALIDATOR: "btnYamlValidator",
        PAYLOAD_TOOLS: "btnPayloadTools"
      };

      Object.values(featureButtonIds).forEach(function (buttonId) {
        const button = this.byId(buttonId);

        if (button) {
          button.removeStyleClass("featureModuleCircleActive");
        }
      }, this);

      const activeButton = this.byId(featureButtonIds[featureKey]);

      if (activeButton) {
        activeButton.addStyleClass("featureModuleCircleActive");
      } else {
        console.warn("[UI] Feature button was not found for", featureKey);
      }
    },

    onFeatureSelected: function (event) {
      const feature = event.getSource().data("feature");

      if (feature === "Integration Flow Configuration") {
        MessageToast.show("Integration Flow Configuration is currently active.");
        return;
      }

      MessageToast.show(`${feature} is planned for a future enhancement.`);
    },

    onSourceEnvironmentChange: async function (event) {
      const selectedKey = event.getSource().getSelectedKey();
      this._sourceEnvironment = selectedKey;

      await this._loadCatalog(selectedKey, "source");
      this._syncTargetSelection();
      this._updateSelectionText();
    },

    onTargetEnvironmentChange: async function (event) {
      const selectedKey = event.getSource().getSelectedKey();
      this._targetEnvironment = selectedKey;

      await this._loadCatalog(selectedKey, "target");
      this._syncTargetSelection();
    },

    onVmSourceEnvironmentChange: async function (event) {
      const environment = event.getSource().getSelectedKey();

      this._vmSourceEnvironment = environment;

      this.getView()
        .getModel("view")
        .setProperty("/vmSourceEnvironment", environment);

      this._vmSourceCatalogFull = [];
      this._vmSourceSearchText = "";

      await this._loadVmCatalog(environment, "vmSource");
      this._syncVmTargetSelection();
      this._updateVmSelectionText();
    },

    onVmTargetEnvironmentChange: async function (event) {
      const environment = event.getSource().getSelectedKey();

      this._vmTargetEnvironment = environment;

      this.getView()
        .getModel("view")
        .setProperty("/vmTargetEnvironment", environment);

      this._vmTargetCatalogFull = [];
      this._vmTargetSearchText = "";

      await this._loadVmCatalog(environment, "vmTarget");
      this._syncVmTargetSelection();
    },

    

    onSourceTreeToggle: async function (event) {
      const expanded = event.getParameter("expanded");
      const context = event.getParameter("itemContext");

      console.log("[UI] Source tree toggle event", {
        expanded: expanded,
        hasContext: Boolean(context),
        environment: this._sourceEnvironment
      });

      if (!expanded) {
        console.log("[UI] Source tree was collapsed; no lazy-load required.");
        return;
      }

      if (!context) {
        console.warn("[UI] No source item context was received.");
        return;
      }

      const packageObject = context.getObject();

      console.log("[UI] Source tree expanded object", packageObject);

      if (!packageObject.packageId) {
        console.warn("[UI] Expanded item has no packageId; skipping.", packageObject);
        return;
      }

      if (packageObject.artifactId) {
        console.log("[UI] Expanded item is an iFlow/placeholder, not a package; skipping.");
        return;
      }

      await this._loadPackageIflows(
        this._sourceEnvironment,
        packageObject,
        "source"
      );
    },

    onTargetTreeToggle: async function (event) {
      const expanded = event.getParameter("expanded");
      const context = event.getParameter("itemContext");

      console.log("[UI] Target tree toggle event", {
        expanded: expanded,
        hasContext: Boolean(context),
        environment: this._targetEnvironment
      });

      if (!expanded) {
        console.log("[UI] Target tree was collapsed; no lazy-load required.");
        return;
      }

      if (!context) {
        console.warn("[UI] No target item context was received.");
        return;
      }

      const packageObject = context.getObject();

      console.log("[UI] Target tree expanded object", packageObject);

      if (!packageObject.packageId) {
        console.warn("[UI] Expanded item has no packageId; skipping.", packageObject);
        return;
      }

      if (packageObject.artifactId) {
        console.log("[UI] Expanded item is an iFlow/placeholder, not a package; skipping.");
        return;
      }

      await this._loadPackageIflows(
        this._targetEnvironment,
        packageObject,
        "target"
      );
    },

    onVmSourceTreeToggle: async function (event) {
      const expanded = event.getParameter("expanded");
      const context = event.getParameter("itemContext");

      if (!expanded || !context) {
        return;
      }

      const packageObject = context.getObject();

      if (!packageObject.packageId || packageObject.artifactId) {
        return;
      }

      await this._loadVmArtifactsForPackage(
        this._vmSourceEnvironment,
        packageObject,
        "vmSource"
      );
    },

    onVmTargetTreeToggle: async function (event) {
      const expanded = event.getParameter("expanded");
      const context = event.getParameter("itemContext");

      if (!expanded || !context) {
        return;
      }

      const packageObject = context.getObject();

      if (!packageObject.packageId || packageObject.artifactId) {
        return;
      }

      await this._loadVmArtifactsForPackage(
        this._vmTargetEnvironment,
        packageObject,
        "vmTarget"
      );
    },

    _loadPackageIflows: async function (environment, packageObject, modelName) {
      console.log("[UI] Lazy-load requested", {
        environment: environment,
        modelName: modelName,
        packageId: packageObject?.packageId,
        iflowsLoaded: packageObject?.iflowsLoaded
      });

      if (!environment) {
        console.warn("[UI] Lazy-load stopped: environment is empty.");
        return;
      }

      if (!packageObject || !packageObject.packageId) {
        console.warn("[UI] Lazy-load stopped: package object or packageId is missing.");
        return;
      }

      /*
      * Only skip if explicitly loaded successfully before.
      * Using === true avoids an unexpected truthy value blocking the call.
      */
      if (packageObject.iflowsLoaded === true) {
        console.log("[UI] Lazy-load skipped: iFlows already loaded for package.", {
          packageId: packageObject.packageId
        });
        return;
      }

      const packageId = packageObject.packageId;
      const model = this.getView().getModel(modelName);

      try {
        packageObject.iflows = [
          {
            artifactId: "__LOADING__",
            artifactName: "Loading iFlows...",
            isPlaceholder: true,
            selected: false
          }
        ];

        model.refresh(true);

        const requestUrl =
          `/api/package-artifacts?environment=${encodeURIComponent(environment)}` +
          `&packageId=${encodeURIComponent(packageId)}` +
          `&_ts=${Date.now()}`;

        console.log("[UI] Calling lazy-load endpoint", requestUrl);

        const response = await fetch(requestUrl);

        console.log("[UI] Lazy-load response received", {
          packageId: packageId,
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          const errorData = await response.json().catch(function () {
            return null;
          });

          throw new Error(
            errorData?.error?.message ||
            `Unable to load iFlows for package ${packageId}`
          );
        }

        const data = await response.json();
        const iflows = Array.isArray(data.iflows) ? data.iflows : [];
        packageObject.iflowCount = iflows.length;
        packageObject.displayName =
          `${packageObject.packageName} (${iflows.length})`;

        packageObject.iflows = iflows.length > 0
          ? iflows
          : [
              {
                artifactId: "__NO_IFLOWS__",
                artifactName: "No iFlows found in this package",
                isPlaceholder: true,
                selected: false
              }
            ];

        packageObject.iflowsLoaded = true;

        this._updateCatalogModelSizeLimit(model, model.getData().packages, "iflows");
        model.refresh(true);

        if (modelName === "target") {
          this._syncTargetSelection();
        }

        MessageToast.show(`${iflows.length} iFlow(s) loaded`);
      } catch (error) {
        console.error("[UI] Lazy-load failed", {
          environment: environment,
          packageId: packageId,
          message: error.message
        });

        packageObject.iflows = [
          {
            artifactId: "__LOAD_ERROR__",
            artifactName: "Unable to load iFlows. Collapse and expand to retry.",
            isPlaceholder: true,
            selected: false
          }
        ];

        packageObject.iflowsLoaded = false;
        model.refresh(true);

        MessageBox.error(
          `Unable to load iFlows for package ${packageId}. ${error.message || ""}`
        );
      }
    },

    _loadVmArtifactsForPackage: async function (environment, packageObject, modelName) {
      if (!environment || !packageObject?.packageId) {
        return;
      }

      if (packageObject.valueMappingsLoaded === true) {
        return;
      }

      const packageId = packageObject.packageId;
      const model = this.getView().getModel(modelName);

      try {
        packageObject.valueMappings = [
          {
            artifactId: "__VM_LOADING__",
            artifactName: "Loading value mappings...",
            isPlaceholder: true,
            selected: false
          }
        ];

        model.refresh(true);

        const response = await fetch(
          `/api/value-mapping-package-artifacts?environment=${encodeURIComponent(environment)}` +
          `&packageId=${encodeURIComponent(packageId)}` +
          `&_ts=${Date.now()}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(function () {
            return null;
          });

          throw new Error(
            errorData?.error?.message ||
            `Unable to load Value Mappings for ${packageId}`
          );
        }

        const data = await response.json();
        const valueMappings = Array.isArray(data.valueMappings)
          ? data.valueMappings
          : [];

        packageObject.valueMappingCount = valueMappings.length;
        packageObject.displayName =
          `${packageObject.packageName} (${valueMappings.length})`;

        packageObject.valueMappings = valueMappings.length > 0
          ? valueMappings
          : [
              {
                artifactId: "__VM_NONE__",
                artifactName: "No Value Mappings found in this package",
                isPlaceholder: true,
                selected: false
              }
            ];

        packageObject.valueMappingsLoaded = true;

        this._updateCatalogModelSizeLimit(model, model.getData().packages, "valueMappings");
        model.refresh(true);

        if (modelName === "vmTarget") {
          this._syncVmTargetSelection();
        }

        MessageToast.show(`${valueMappings.length} Value Mapping artifact(s) loaded`);
      } catch (error) {
        console.error("[UI] Value Mapping lazy load failed", {
          environment,
          packageId,
          message: error.message
        });

        packageObject.valueMappings = [
          {
            artifactId: "__VM_ERROR__",
            artifactName: "Unable to load Value Mappings. Collapse and expand to retry.",
            isPlaceholder: true,
            selected: false
          }
        ];

        packageObject.valueMappingsLoaded = false;

        model.refresh(true);

        MessageBox.error(
          `Unable to load Value Mappings for ${packageId}. ${error.message || ""}`
        );
      }
    },

    _loadCatalog: async function (environment, modelName) {
      if (!environment) {
        return;
      }

      try {
        const response = await fetch(`/api/catalog?environment=${encodeURIComponent(environment)}&_ts=${Date.now()}`);

        if (!response.ok) {
          const errorData = await response.json().catch(function () {
            return null;
          });

          throw new Error(errorData?.error?.message || `Failed to load catalog for ${environment}`);
        }

        const data = await response.json();

        if (modelName === "source") {
          this._sourceCatalogFull = data.packages || [];
          this._applySourceFilter();
        }

        if (modelName === "target") {
          this._targetCatalogFull = data.packages || [];
          this._syncTargetSelection();
          this._applyTargetFilter();
        }

        MessageToast.show(`${environment} catalog loaded`);
      } catch (error) {
        MessageBox.error(`Unable to load catalog for ${environment}. ${error.message || ""}`);
        console.error(error);
      }
    },

    _loadVmCatalog: async function (environment, modelName) {
      if (!environment) {
        return;
      }

      try {
        const response = await fetch(
          `/api/value-mapping-catalog?environment=${encodeURIComponent(environment)}&_ts=${Date.now()}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(function () {
            return null;
          });

          throw new Error(
            errorData?.error?.message ||
            `Unable to load Value Mapping packages for ${environment}`
          );
        }

        const data = await response.json();
        const packages = data.packages || [];

        if (modelName === "vmSource") {
          this._vmSourceCatalogFull = packages;
          this._applyVmSourceFilter();
        } else {
          this._vmTargetCatalogFull = packages;
          this._applyVmTargetFilter();
        }

        MessageToast.show(`${environment} Value Mapping packages loaded`);
      } catch (error) {
        console.error("[UI] Value Mapping catalog load failed", error);

        MessageBox.error(
          `Unable to load Value Mapping packages for ${environment}. ${error.message || ""}`
        );
      }
    },

    onSourceSearch: function (event) {
      this._sourceSearchText =
        event.getParameter("newValue") ||
        event.getParameter("query") ||
        "";

      this._applySourceFilter();
    },

    onTargetSearch: function (event) {
      this._targetSearchText =
        event.getParameter("newValue") ||
        event.getParameter("query") ||
        "";

      this._applyTargetFilter();
    },

    onVmSourceSearch: function (event) {
      this._vmSourceSearchText =
        event.getParameter("newValue") ||
        event.getParameter("query") ||
        "";

      this._applyVmSourceFilter();
    },

    onVmTargetSearch: function (event) {
      this._vmTargetSearchText =
        event.getParameter("newValue") ||
        event.getParameter("query") ||
        "";

      this._applyVmTargetFilter();
    },

    _applyVmSourceFilter: function () {
      const filteredPackages = this._filterVmPackages(
        this._vmSourceCatalogFull,
        this._vmSourceSearchText
      );

      this._setCatalogModelData("vmSource", filteredPackages, "valueMappings");
    },

    _applyVmTargetFilter: function () {
      const filteredPackages = this._filterVmPackages(
        this._vmTargetCatalogFull,
        this._vmTargetSearchText
      );

      this._setCatalogModelData("vmTarget", filteredPackages, "valueMappings");
    },

    _setCatalogModelData: function (modelName, packages, childProperty) {
      const packageList = packages || [];
      const model = this.getView().getModel(modelName);

      this._updateCatalogModelSizeLimit(model, packageList, childProperty);
      model.setData({ packages: packageList });
    },

    _updateCatalogModelSizeLimit: function (model, packages, childProperty) {
      const packageList = packages || [];
      const largestChildList = packageList.reduce(function (largest, pkg) {
        const children = pkg[childProperty];
        return Math.max(largest, Array.isArray(children) ? children.length : 0);
      }, 0);

      model.setSizeLimit(Math.max(100, packageList.length, largestChildList));
    },

    _filterVmPackages: function (packages, searchText) {
      const query = String(searchText || "").trim().toLowerCase();

      if (!query) {
        return packages || [];
      }

      return (packages || [])
        .map(function (pkg) {
          const packageText = [
            pkg.packageId,
            pkg.packageName,
            pkg.description
          ].join(" ").toLowerCase();

          const packageMatches = packageText.includes(query);

          const matchingMappings = (pkg.valueMappings || []).filter(function (mapping) {
            if (mapping.isPlaceholder) {
              return packageMatches;
            }

            const mappingText = [
              mapping.artifactId,
              mapping.artifactName,
              mapping.version,
              mapping.artifactType
            ].join(" ").toLowerCase();

            return packageMatches || mappingText.includes(query);
          });

          if (packageMatches || matchingMappings.length > 0) {
            return Object.assign({}, pkg, {
              valueMappings: matchingMappings
            });
          }

          return null;
        })
        .filter(Boolean);
    },

    _applySourceFilter: function () {
      const filteredPackages = this._filterPackages(
        this._sourceCatalogFull,
        this._sourceSearchText
      );

      this._setCatalogModelData("source", filteredPackages, "iflows");
    },

    _applyTargetFilter: function () {
      const filteredPackages = this._filterPackages(
        this._targetCatalogFull,
        this._targetSearchText
      );

      this._setCatalogModelData("target", filteredPackages, "iflows");
    },

    _filterPackages: function (packages, searchText) {
      if (!Array.isArray(packages)) {
        return [];
      }

      const query = String(searchText || "").trim().toLowerCase();

      if (!query) {
        return packages;
      }

      return packages
        .map(function (pkg) {
          const packageText = [
            pkg.packageId,
            pkg.packageName,
            pkg.description
          ].join(" ").toLowerCase();

          const packageMatches = packageText.includes(query);

          const matchingIflows = Array.isArray(pkg.iflows)
            ? pkg.iflows.filter(function (iflow) {
                if (iflow.isPlaceholder) {
                  return packageMatches;
                }

                const iflowText = [
                  iflow.artifactId,
                  iflow.artifactName,
                  iflow.version,
                  iflow.artifactType
                ].join(" ").toLowerCase();

                return packageMatches || iflowText.includes(query);
    })
  : [];

          if (packageMatches || matchingIflows.length > 0) {
            return Object.assign({}, pkg, {
              iflows: matchingIflows
            });
          }

          return null;
        })
        .filter(Boolean);
    },



    onSourceCheckboxSelect: function (event) {
      const checkbox = event.getSource();
      const selected = checkbox.getSelected();
      const context = checkbox.getBindingContext("source");

      if (!context) {
        return;
      }

      const object = context.getObject();

      // Package-level selection:
      if (object.packageId && Array.isArray(object.iflows)) {
        object.selected = selected;

        // Select only real iFlows that have already been loaded.
        object.iflows.forEach(function (iflow) {
          if (!iflow.isPlaceholder) {
            iflow.selected = selected;
          }
        });
      } else if (!object.isPlaceholder) {
        // Individual real iFlow selection.
        object.selected = selected;
      }

      this.getView().getModel("source").refresh(true);
      this._syncTargetSelection();
      this._updateSelectionText();
    },

    onVmSourceCheckboxSelect: function (event) {
      const checkbox = event.getSource();
      const selected = checkbox.getSelected();
      const context = checkbox.getBindingContext("vmSource");

      if (!context) {
        return;
      }

      const object = context.getObject();

      /*
      * Package selection affects only already-loaded VM artifacts.
      * Expand the package first if the user wants to select all artifacts.
      */
      if (object.packageId && Array.isArray(object.valueMappings)) {
        object.selected = selected;

        object.valueMappings.forEach(function (valueMapping) {
          if (!valueMapping.isPlaceholder) {
            valueMapping.selected = selected;
          }
        });
      } else if (!object.isPlaceholder) {
        object.selected = selected;
      }

      this.getView().getModel("vmSource").refresh(true);

      this._syncVmTargetSelection();
      this._updateVmSelectionText();
    },

    _syncTargetSelection: function () {
      const sourcePackages = this._sourceCatalogFull || [];
      const targetPackages = this._targetCatalogFull || [];

      const selectedKeys = new Set();

      sourcePackages.forEach(function (pkg) {
        if (Array.isArray(pkg.iflows)) {
          pkg.iflows.forEach(function (iflow) {
            if (iflow.selected) {
              selectedKeys.add(pkg.packageId + "::" + iflow.artifactId);
            }
          });
        }
      });

      targetPackages.forEach(function (pkg) {
        pkg.selected = false;

        if (Array.isArray(pkg.iflows)) {
          pkg.iflows.forEach(function (iflow) {
            const key = pkg.packageId + "::" + iflow.artifactId;
            iflow.selected = selectedKeys.has(key);
          });

          pkg.selected = pkg.iflows.some(function (iflow) {
            return iflow.selected;
          });
        }
      });

      this._applyTargetFilter();
    },

    _syncVmTargetSelection: function () {
      const sourcePackages = this._vmSourceCatalogFull || [];
      const targetPackages = this._vmTargetCatalogFull || [];

      const selectedKeys = new Set();

      sourcePackages.forEach(function (pkg) {
        (pkg.valueMappings || []).forEach(function (valueMapping) {
          if (!valueMapping.isPlaceholder && valueMapping.selected) {
            selectedKeys.add(`${pkg.packageId}::${valueMapping.artifactId}`);
          }
        });
      });

      targetPackages.forEach(function (pkg) {
        pkg.selected = false;

        (pkg.valueMappings || []).forEach(function (valueMapping) {
          if (valueMapping.isPlaceholder) {
            return;
          }

          const key = `${pkg.packageId}::${valueMapping.artifactId}`;
          valueMapping.selected = selectedKeys.has(key);
        });

        pkg.selected = (pkg.valueMappings || []).some(function (valueMapping) {
          return !valueMapping.isPlaceholder && valueMapping.selected;
        });
      });

      this._applyVmTargetFilter();
    },

    _updateSelectionText: function () {
      const selectedArtifacts = this._getSelectedSourceArtifacts();
      const text = selectedArtifacts.length === 0
        ? "No iFlows selected"
        : `${selectedArtifacts.length} iFlow(s) selected`;

      this.getView().getModel("view").setProperty("/selectionText", text);
    },

    _updateVmSelectionText: function () {
      const selectedArtifacts = this._getSelectedVmArtifacts();
      const count = selectedArtifacts.length;

      this.getView()
        .getModel("view")
        .setProperty(
          "/vmSelectionText",
          count === 0
            ? "No value mappings selected"
            : `${count} value mapping artifact(s) selected`
        );
    },

    _prepareParameterComparisonResults: function (comparisonData) {
      const allParameterResults = [];
      const summary = {
        changed: 0,
        addedInTarget: 0,
        removedFromTarget: 0,
        same: 0
      };

      (comparisonData.results || []).forEach(function (artifact) {
        (artifact.parameterComparisons || []).forEach(function (parameter) {
          const row = {
            packageId: artifact.packageId || "",
            artifactId: artifact.artifactId || "",
            artifactName: artifact.artifactName || artifact.artifactId || "",
            parameterKey: parameter.parameterKey || "",
            sourceValue: parameter.sourceValue || "",
            targetValue: parameter.targetValue || "",
            changeType: parameter.changeType || "SAME"
          };

          allParameterResults.push(row);

          switch (row.changeType) {
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
      });

      const parameterModel = this.getView().getModel("parameterView");

      parameterModel.setData({
        sourceEnvironment: comparisonData.sourceEnvironment || "Source",
        targetEnvironment: comparisonData.targetEnvironment || "Target",
        selectedFilter: "ALL",
        searchText: "",
        allParameterResults: allParameterResults,
        parameterResults: allParameterResults,
        groups: this._buildParameterGroups(allParameterResults),
        summary: summary
      });
    },

    _buildParameterGroups: function (parameterRows) {
      const groupMap = new Map();

      (parameterRows || []).forEach(function (row) {
        const groupKey = `${row.packageId}::${row.artifactId}`;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            packageId: row.packageId,
            artifactId: row.artifactId,
            artifactName: row.artifactName,
            parameterRows: [],
            changedCount: 0,
            addedCount: 0,
            removedCount: 0,
            sameCount: 0,
            differenceCount: 0
          });
        }

        const group = groupMap.get(groupKey);

        group.parameterRows.push(row);

        switch (row.changeType) {
          case "CHANGED":
            group.changedCount += 1;
            group.differenceCount += 1;
            break;

          case "ADDED_IN_TARGET":
            group.addedCount += 1;
            group.differenceCount += 1;
            break;

          case "REMOVED_FROM_TARGET":
            group.removedCount += 1;
            group.differenceCount += 1;
            break;

          case "SAME":
            group.sameCount += 1;
            break;

          default:
            break;
        }
      });

      return Array.from(groupMap.values()).sort(function (left, right) {
        return left.artifactName.localeCompare(right.artifactName);
      });
    },

    onParameterFilterPress: function (event) {
      const filterType = event.getSource().data("filter");

      this.getView()
        .getModel("parameterView")
        .setProperty("/selectedFilter", filterType);

      this._applyParameterResultFilters();
    },

    onParameterSearch: function (event) {
      const searchText =
        event.getParameter("newValue") ||
        event.getParameter("query") ||
        "";

      this.getView()
        .getModel("parameterView")
        .setProperty("/searchText", searchText);

      this._applyParameterResultFilters();
    },

    _prepareVmComparisonResults: function (comparisonData) {
      const comparisonGroups = this._buildVmComparisonGroups(comparisonData);
      const model = this.getView().getModel("vmComparison");

      model.setData({
        sourceEnvironment: comparisonData.sourceEnvironment || "Source",
        targetEnvironment: comparisonData.targetEnvironment || "Target",
        selectedFilter: "ALL",
        searchText: "",
        summary: comparisonGroups.summary,
        allRows: comparisonGroups.allRows,
        allGroups: comparisonGroups.groups,
        groups: comparisonGroups.groups
      });
    },

    _buildVmComparisonGroups: function (comparisonData) {
      const artifactMap = new Map();

      (comparisonData.results || []).forEach(function (artifact) {
        const artifactKey = JSON.stringify([
          artifact.packageId || "",
          artifact.artifactId || ""
        ]);

        if (!artifactMap.has(artifactKey)) {
          artifactMap.set(artifactKey, {
            packageId: artifact.packageId || "",
            artifactId: artifact.artifactId || "",
            artifactName: artifact.artifactName || artifact.artifactId || "",
            artifactStatus: artifact.status || "",
            sourceVersion: artifact.sourceVersion || "",
            targetVersion: artifact.targetVersion || "",
            differenceCount: 0,
            sameCount: 0,
            schemas: []
          });
        }

        const artifactGroup = artifactMap.get(artifactKey);

        (artifact.schemas || []).forEach(function (schemaResult) {
          const schema = schemaResult.schema || {};
          const schemaKey = JSON.stringify([
            schema.srcAgency || "",
            schema.srcId || "",
            schema.tgtAgency || "",
            schema.tgtId || ""
          ]);
          const pairKey = this._getVmSchemaPairKey(schema);

          let schemaGroup = artifactGroup.schemas.find(function (schemaItem) {
            return schemaItem.schemaKey === pairKey;
          });

          if (!schemaGroup) {
            schemaGroup = {
              schemaKey: pairKey,
              srcAgency: schema.srcAgency || "",
              srcId: schema.srcId || "",
              tgtAgency: schema.tgtAgency || "",
              tgtId: schema.tgtId || "",
              displayName: this._formatVmSchemaPairName(schema),
              detailsText: this._formatVmSchemaPairDetails(schema),
              schemaStatus: schemaResult.status || "",
              differenceCount: 0,
              sameCount: 0,
              directionCount: 0,
              directions: [],
              allMappingRows: [],
              mappingRows: []
            };

            artifactGroup.schemas.push(schemaGroup);
          }

          if (!schemaGroup.directions.includes(schemaKey)) {
            schemaGroup.directions.push(schemaKey);
            schemaGroup.directionCount += 1;
            schemaGroup.displayName = this._formatVmSchemaPairName(
              schemaGroup,
              schemaGroup.directionCount > 1
            );
            schemaGroup.detailsText = this._formatVmSchemaPairDetails(
              schemaGroup,
              schemaGroup.directionCount > 1
            );
          }

          (schemaResult.mappingComparisons || []).forEach(function (mapping) {
            const row = {
              packageId: artifact.packageId || "",
              artifactId: artifact.artifactId || "",
              artifactName: artifact.artifactName || artifact.artifactId || "",
              artifactStatus: artifact.status || "",

              sourceVersion: artifact.sourceVersion || "",
              targetVersion: artifact.targetVersion || "",

              srcAgency: schema.srcAgency || "",
              srcId: schema.srcId || "",
              tgtAgency: schema.tgtAgency || "",
              tgtId: schema.tgtId || "",
              pairKey,
              directionKey: schemaKey,
              directionLabel: this._formatVmSchemaName(schema),

              sourceValue: mapping.sourceValue || "",
              sourceEnvironmentValue: mapping.sourceEnvironmentValue || "",
              targetEnvironmentValue: mapping.targetEnvironmentValue || "",
              changeType: mapping.changeType || "SAME"
            };

            schemaGroup.allMappingRows.push(row);
          }, this);
        }, this);

        if (artifact.status === "MISSING_IN_TARGET") {
          const missingRow = {
            packageId: artifact.packageId || "",
            artifactId: artifact.artifactId || "",
            artifactName: artifact.artifactName || artifact.artifactId || "",
            artifactStatus: artifact.status,
            sourceVersion: artifact.sourceVersion || "",
            targetVersion: "",
            srcAgency: "",
            srcId: "",
            tgtAgency: "",
            tgtId: "",
            sourceValue: "",
            sourceEnvironmentValue: "",
            targetEnvironmentValue: "",
            changeType: "REMOVED_FROM_TARGET",
            artifactMissing: true
          };

          if (artifactGroup.schemas.length === 0) {
            artifactGroup.schemas.push({
              schemaKey: JSON.stringify(["", "", "", ""]),
              srcAgency: "",
              srcId: "",
              tgtAgency: "",
              tgtId: "",
              displayName: "Artifact missing in target",
              detailsText: "Artifact-level comparison",
              schemaStatus: artifact.status,
              differenceCount: 1,
              sameCount: 0,
              directionCount: 0,
              directions: [],
              allMappingRows: [missingRow],
              mappingRows: [missingRow]
            });
          }
        }
      }, this);

      return this._finalizeVmComparisonGroups(
        Array.from(artifactMap.values())
          .map(function (artifactGroup) {
            artifactGroup.schemas.sort(function (left, right) {
              return left.displayName.localeCompare(right.displayName);
            });

            return artifactGroup;
          })
          .sort(function (left, right) {
            return left.artifactName.localeCompare(right.artifactName);
          })
      );
    },

    _finalizeVmComparisonGroups: function (groups) {
      const allRows = [];
      const summary = {
        changed: 0,
        addedInTarget: 0,
        removedFromTarget: 0,
        same: 0
      };

      (groups || []).forEach(function (artifactGroup) {
        artifactGroup.differenceCount = 0;
        artifactGroup.sameCount = 0;

        (artifactGroup.schemas || []).forEach(function (schemaGroup) {
          const visibleRows = this._selectVmVisibleRows(schemaGroup);

          schemaGroup.mappingRows = visibleRows;
          schemaGroup.differenceCount = 0;
          schemaGroup.sameCount = 0;

          visibleRows.forEach(function (row) {
            allRows.push(row);
            this._incrementVmSummary(summary, row.changeType);

            if (row.changeType === "SAME") {
              schemaGroup.sameCount += 1;
              artifactGroup.sameCount += 1;
            } else {
              schemaGroup.differenceCount += 1;
              artifactGroup.differenceCount += 1;
            }
          }, this);
        }, this);
      }, this);

      return {
        groups,
        allRows,
        summary
      };
    },

    _selectVmVisibleRows: function (schemaGroup) {
      const allMappingRows = schemaGroup.allMappingRows || schemaGroup.mappingRows || [];
      const preferredDirectionKey = JSON.stringify([
        schemaGroup.srcAgency || "",
        schemaGroup.srcId || "",
        schemaGroup.tgtAgency || "",
        schemaGroup.tgtId || ""
      ]);

      if ((schemaGroup.directionCount || 0) < 2 || allMappingRows.length === 0) {
        return allMappingRows;
      }

      const rowsByDirection = new Map();

      allMappingRows.forEach(function (row) {
        const directionKey = row.directionKey || row.directionLabel || "";

        if (!rowsByDirection.has(directionKey)) {
          rowsByDirection.set(directionKey, []);
        }

        rowsByDirection.get(directionKey).push(row);
      });

      const rankedDirections = Array.from(rowsByDirection.entries())
        .map(function (entry) {
          const rows = entry[1] || [];
          const populatedFieldCount = rows.reduce(function (count, row) {
            return count + this._getVmRowPopulationScore(row);
          }.bind(this), 0);

          return {
            directionKey: entry[0],
            rows,
            isPreferredDirection: entry[0] === preferredDirectionKey,
            populatedFieldCount
          };
        }, this)
        .sort(function (left, right) {
          if (left.isPreferredDirection !== right.isPreferredDirection) {
            return left.isPreferredDirection ? -1 : 1;
          }

          if (right.populatedFieldCount !== left.populatedFieldCount) {
            return right.populatedFieldCount - left.populatedFieldCount;
          }

          if (right.rows.length !== left.rows.length) {
            return right.rows.length - left.rows.length;
          }

          return left.directionKey.localeCompare(right.directionKey);
        });

      return rankedDirections.length > 0
        ? rankedDirections[0].rows
        : allMappingRows;
    },

    _getVmRowPopulationScore: function (row) {
      let score = 0;

      if (row.sourceValue) {
        score += 1;
      }

      if (row.sourceEnvironmentValue) {
        score += 1;
      }

      if (row.targetEnvironmentValue) {
        score += 1;
      }

      return score;
    },

    _incrementVmSummary: function (summary, changeType) {
      switch (changeType) {
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
    },

    _buildVmGroups: function (rows) {
      const artifactMap = new Map();

      (rows || []).forEach(function (row) {
        const artifactKey = `${row.packageId}::${row.artifactId}`;

        if (!artifactMap.has(artifactKey)) {
          artifactMap.set(artifactKey, {
            packageId: row.packageId,
            artifactId: row.artifactId,
            artifactName: row.artifactName,
            artifactStatus: row.artifactStatus,
            sourceVersion: row.sourceVersion,
            targetVersion: row.targetVersion,
            differenceCount: 0,
            sameCount: 0,
            schemas: []
          });
        }

        const artifactGroup = artifactMap.get(artifactKey);

        if (row.changeType === "SAME") {
          artifactGroup.sameCount += 1;
        } else {
          artifactGroup.differenceCount += 1;
        }

        const schemaKey = [
          row.srcAgency,
          row.srcId,
          row.tgtAgency,
          row.tgtId
        ].join("::");

        let schemaGroup = artifactGroup.schemas.find(function (schema) {
          return schema.schemaKey === schemaKey;
        });

        if (!schemaGroup) {
          schemaGroup = {
            schemaKey,
            srcAgency: row.srcAgency,
            srcId: row.srcId,
            tgtAgency: row.tgtAgency,
            tgtId: row.tgtId,
            displayName: this._formatVmSchemaName(row),
            differenceCount: 0,
            sameCount: 0,
            mappingRows: []
          };

          artifactGroup.schemas.push(schemaGroup);
        }

        schemaGroup.mappingRows.push(row);

        if (row.changeType === "SAME") {
          schemaGroup.sameCount += 1;
        } else {
          schemaGroup.differenceCount += 1;
        }
      }, this);

      return Array.from(artifactMap.values())
        .map(function (artifactGroup) {
          artifactGroup.schemas.sort(function (left, right) {
            return left.displayName.localeCompare(right.displayName);
          });

          return artifactGroup;
        })
        .sort(function (left, right) {
          return left.artifactName.localeCompare(right.artifactName);
        });
    },

    _formatVmSchemaName: function (row) {
      if (!row.srcAgency && !row.srcId && !row.tgtAgency && !row.tgtId) {
        return "Artifact-level difference";
      }

      const sourceSchema = [row.srcAgency, row.srcId]
        .filter(Boolean)
        .join(" / ");

      const targetSchema = [row.tgtAgency, row.tgtId]
        .filter(Boolean)
        .join(" / ");

      return `${sourceSchema} → ${targetSchema}`;
    },

    _getVmSchemaPairKey: function (row) {
      const forwardKey = JSON.stringify([
        row.srcAgency || "",
        row.srcId || "",
        row.tgtAgency || "",
        row.tgtId || ""
      ]);
      const reverseKey = JSON.stringify([
        row.tgtAgency || "",
        row.tgtId || "",
        row.srcAgency || "",
        row.srcId || ""
      ]);

      return [forwardKey, reverseKey].sort()[0];
    },

    _formatVmSchemaPairName: function (row, isBidirectional) {
      const sourceSchema = [row.srcAgency, row.srcId]
        .filter(Boolean)
        .join(" / ");

      const targetSchema = [row.tgtAgency, row.tgtId]
        .filter(Boolean)
        .join(" / ");

      if (!sourceSchema && !targetSchema) {
        return "Artifact-level difference";
      }

      return isBidirectional
        ? `${sourceSchema} ↔ ${targetSchema}`
        : `${sourceSchema} → ${targetSchema}`;
    },

    _formatVmSchemaPairDetails: function (row, isBidirectional) {
      const sourceSchema = [row.srcAgency, row.srcId]
        .filter(Boolean)
        .join(" / ");

      const targetSchema = [row.tgtAgency, row.tgtId]
        .filter(Boolean)
        .join(" / ");

      if (!sourceSchema && !targetSchema) {
        return "Artifact-level comparison";
      }

      return isBidirectional
        ? `Bi-directional mapping pair: ${sourceSchema || "-"} | ${targetSchema || "-"}`
        : `Source schema: ${sourceSchema || "-"} | Target schema: ${targetSchema || "-"}`;
    },

    formatVmChangeText: function (changeType) {
      const labels = {
        CHANGED: "Changed",
        ADDED_IN_TARGET: "Added",
        REMOVED_FROM_TARGET: "Removed",
        SAME: "Same"
      };

      return labels[changeType] || changeType || "Unknown";
    },

    formatVmChangeState: function (changeType) {
      const states = {
        CHANGED: "Warning",
        ADDED_IN_TARGET: "Success",
        REMOVED_FROM_TARGET: "Error",
        SAME: "Information"
      };

      return states[changeType] || "None";
    },

    formatVmRowHighlight: function (changeType) {
      const highlights = {
        CHANGED: "Warning",
        ADDED_IN_TARGET: "Success",
        REMOVED_FROM_TARGET: "Error",
        SAME: "Information"
      };

      return highlights[changeType] || "None";
    },

    formatVmSchemaDetails: function (
      srcAgency,
      srcId,
      tgtAgency,
      tgtId
    ) {
      const sourceSchema = [srcAgency, srcId]
        .filter(Boolean)
        .join(" / ");

      const targetSchema = [tgtAgency, tgtId]
        .filter(Boolean)
        .join(" / ");

      if (!sourceSchema && !targetSchema) {
        return "Artifact-level comparison";
      }

      return `Source schema: ${sourceSchema || "-"} | Target schema: ${targetSchema || "-"}`;
    },

    formatVmArtifactDetails: function (
      packageId,
      sourceVersion,
      targetVersion
    ) {
      return [
        packageId || "Package: -",
        `Source version: ${sourceVersion || "-"}`,
        `Target version: ${targetVersion || "-"}`
      ].join(" | ");
    },

    onVmResultFilterPress: function (event) {
      const filterType = event.getSource().data("filter");

      this.getView()
        .getModel("vmComparison")
        .setProperty("/selectedFilter", filterType);

      this._applyVmResultFilters();
    },

    onVmResultSearch: function (event) {
      const searchText =
        event.getParameter("newValue") ||
        event.getParameter("query") ||
        "";

      this.getView()
        .getModel("vmComparison")
        .setProperty("/searchText", searchText);

      this._applyVmResultFilters();
    },

    _applyVmResultFilters: function () {
      const model = this.getView().getModel("vmComparison");
      const data = model.getData();

      const selectedFilter = data.selectedFilter || "ALL";
      const searchText = String(data.searchText || "").trim().toLowerCase();

      const filteredRows = (data.allRows || []).filter(function (row) {
        const matchesFilter =
          selectedFilter === "ALL" ||
          row.changeType === selectedFilter;

        const searchableText = [
          row.packageId,
          row.artifactId,
          row.artifactName,
          row.srcAgency,
          row.srcId,
          row.tgtAgency,
          row.tgtId,
          row.sourceValue,
          row.sourceEnvironmentValue,
          row.targetEnvironmentValue,
          row.changeType
        ].join(" ").toLowerCase();

        const matchesSearch =
          !searchText || searchableText.includes(searchText);

        return matchesFilter && matchesSearch;
      });

      model.setProperty(
        "/groups",
        this._filterVmComparisonGroups(data.allGroups || [], filteredRows)
      );
    },

    _filterVmComparisonGroups: function (groups, filteredRows) {
      const filteredRowSet = new Set(filteredRows || []);

      return (groups || []).map(function (artifactGroup) {
        const filteredArtifactGroup = {
          packageId: artifactGroup.packageId || "",
          artifactId: artifactGroup.artifactId || "",
          artifactName: artifactGroup.artifactName || artifactGroup.artifactId || "",
          artifactStatus: artifactGroup.artifactStatus || "",
          sourceVersion: artifactGroup.sourceVersion || "",
          targetVersion: artifactGroup.targetVersion || "",
          differenceCount: 0,
          sameCount: 0,
          schemas: []
        };

        (artifactGroup.schemas || []).forEach(function (schemaGroup) {
          const filteredMappingRows = (schemaGroup.mappingRows || []).filter(function (row) {
            return filteredRowSet.has(row);
          });

          const filteredSchemaGroup = {
            schemaKey: schemaGroup.schemaKey,
            srcAgency: schemaGroup.srcAgency || "",
            srcId: schemaGroup.srcId || "",
            tgtAgency: schemaGroup.tgtAgency || "",
            tgtId: schemaGroup.tgtId || "",
            displayName: schemaGroup.displayName || "",
            detailsText: schemaGroup.detailsText || "",
            schemaStatus: schemaGroup.schemaStatus || "",
            differenceCount: 0,
            sameCount: 0,
            directionCount: schemaGroup.directionCount || 0,
            directions: schemaGroup.directions || [],
            mappingRows: filteredMappingRows
          };

          filteredMappingRows.forEach(function (row) {
            if (row.changeType === "SAME") {
              filteredSchemaGroup.sameCount += 1;
            } else {
              filteredSchemaGroup.differenceCount += 1;
            }
          });

          filteredArtifactGroup.sameCount += filteredSchemaGroup.sameCount;
          filteredArtifactGroup.differenceCount += filteredSchemaGroup.differenceCount;
          filteredArtifactGroup.schemas.push(filteredSchemaGroup);
        });

        return filteredArtifactGroup;
      });
    },

    _applyParameterResultFilters: function () {
      const model = this.getView().getModel("parameterView");
      const data = model.getData();

      const selectedFilter = data.selectedFilter || "ALL";
      const searchText = String(data.searchText || "").trim().toLowerCase();

      const filteredResults = (data.allParameterResults || []).filter(function (row) {
        const matchesFilter =
          selectedFilter === "ALL" ||
          row.changeType === selectedFilter;

        const searchableText = [
          row.packageId,
          row.artifactId,
          row.artifactName,
          row.parameterKey,
          row.sourceValue,
          row.targetValue,
          row.changeType
        ].join(" ").toLowerCase();

        const matchesSearch =
          !searchText || searchableText.includes(searchText);

        return matchesFilter && matchesSearch;
      });

      model.setProperty("/parameterResults", filteredResults);
      model.setProperty(
        "/groups",
        this._buildParameterGroups(filteredResults)
      );
    },

    onComparePress: async function () {
      try {
        if (!this._sourceEnvironment) {
          MessageBox.warning("Please select a source environment.");
          return;
        }

        if (!this._targetEnvironment) {
          MessageBox.warning("Please select a target environment.");
          return;
        }

        if (this._sourceEnvironment === this._targetEnvironment) {
          MessageBox.warning("Source and target environments must be different.");
          return;
        }

        const selectedArtifacts = this._getSelectedSourceArtifacts();

        if (selectedArtifacts.length === 0) {
          MessageBox.warning("Please select at least one source iFlow.");
          return;
        }

        const payload = {
          sourceEnvironment: this._sourceEnvironment,
          targetEnvironment: this._targetEnvironment,
          selectedArtifacts: selectedArtifacts
        };

        const response = await fetch("/api/compare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error?.message || "Compare failed");
        }

        this.getView().getModel("result").setData(data);
        this._prepareParameterComparisonResults(data);
        MessageToast.show("Comparison completed");
      } catch (error) {
        MessageBox.error(error.message || "Unable to compare selected iFlows.");
        console.error(error);
      }
    },

    onVmComparePress: async function () {
      try {
        if (!this._vmSourceEnvironment) {
          MessageBox.warning("Please select a source environment.");
          return;
        }

        if (!this._vmTargetEnvironment) {
          MessageBox.warning("Please select a target environment.");
          return;
        }

        if (this._vmSourceEnvironment === this._vmTargetEnvironment) {
          MessageBox.warning("Source and target environments must be different.");
          return;
        }

        const selectedArtifacts = this._getSelectedVmArtifacts();

        if (selectedArtifacts.length === 0) {
          MessageBox.warning(
            "Please select at least one source Value Mapping artifact."
          );
          return;
        }

        const response = await fetch("/api/value-mappings/compare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceEnvironment: this._vmSourceEnvironment,
            targetEnvironment: this._vmTargetEnvironment,
            selectedArtifacts
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error?.message ||
            "Unable to compare selected Value Mapping artifacts."
          );
        }

        this._prepareVmComparisonResults(data);

        MessageToast.show("Value Mapping comparison completed.");
      } catch (error) {
        console.error("[UI] Value Mapping comparison failed", error);

        MessageBox.error(
          error.message ||
          "Unable to compare selected Value Mapping artifacts."
        );
      }
    },

    _getSelectedSourceArtifacts: function () {
      const sourcePackages = this._sourceCatalogFull || [];
      const selectedArtifacts = [];

      sourcePackages.forEach(function (pkg) {
        if (Array.isArray(pkg.iflows)) {
          pkg.iflows.forEach(function (iflow) {
            if (iflow.selected) {
              selectedArtifacts.push({
                packageId: pkg.packageId,
                packageName: pkg.packageName,
                artifactId: iflow.artifactId,
                artifactName: iflow.artifactName
              });
            }
          });
        }
      });

      return selectedArtifacts;
    },

    _getSelectedVmArtifacts: function () {
      const selectedArtifacts = [];

      (this._vmSourceCatalogFull || []).forEach(function (pkg) {
        (pkg.valueMappings || []).forEach(function (valueMapping) {
          if (!valueMapping.isPlaceholder && valueMapping.selected) {
            selectedArtifacts.push({
              packageId: pkg.packageId,
              packageName: pkg.packageName,
              artifactId: valueMapping.artifactId,
              artifactName: valueMapping.artifactName,
              version: valueMapping.version
            });
          }
        });
      });

      return selectedArtifacts;
    },

    onResultRowPress: function (event) {
      const context = event.getSource().getBindingContext("result");

      if (!context) {
        return;
      }

      const result = context.getObject();
      const differences = result.differences || [];

      const detailModel = new JSONModel({
        packageId: result.packageId,
        artifactId: result.artifactId,
        artifactName: result.artifactName,
        status: result.status,
        differences: differences
      });

      const differenceTable = new Table({
        width: "100%",
        columns: [
          new Column({
            header: new Text({ text: "Category" })
          }),
          new Column({
            header: new Text({ text: "Field" })
          }),
          new Column({
            header: new Text({ text: "Source Value" })
          }),
          new Column({
            header: new Text({ text: "Target Value" })
          }),
          new Column({
            header: new Text({ text: "Result" })
          })
        ]
      });

      differenceTable.setModel(detailModel, "detail");

      differenceTable.bindItems({
        path: "detail>/differences",
        template: new ColumnListItem({
          cells: [
            new Text({ text: "{detail>category}", wrapping: true }),
            new Text({ text: "{detail>field}", wrapping: true }),
            new Text({ text: "{detail>sourceValue}", wrapping: true }),
            new Text({ text: "{detail>targetValue}", wrapping: true }),
            new ObjectStatus({
              text: "{detail>result}",
              state: "{= ${detail>result} === 'DIFFERENT' ? 'Error' : 'Warning' }"
            })
          ]
        })
      });

      const dialog = new Dialog({
        title: `Comparison Details — ${result.artifactName || result.artifactId}`,
        contentWidth: "80%",
        contentHeight: "55%",
        resizable: true,
        draggable: true,
        content: [differenceTable],
        beginButton: new Button({
          text: "Close",
          press: function () {
            dialog.close();
          }
        }),
        afterClose: function () {
          dialog.destroy();
        }
      });

      dialog.setModel(detailModel, "detail");
      dialog.open();
    },

    formatChangeText: function (changeType) {
      const labels = {
        CHANGED: "Changed",
        ADDED_IN_TARGET: "Added",
        REMOVED_FROM_TARGET: "Removed",
        SAME: "Same"
      };

      return labels[changeType] || changeType || "Unknown";
    },

    formatChangeState: function (changeType) {
      const states = {
        CHANGED: "Warning",
        ADDED_IN_TARGET: "Success",
        REMOVED_FROM_TARGET: "Error",
        SAME: "Information"
      };

      return states[changeType] || "None";
    },

    formatRowHighlight: function (changeType) {
      const highlights = {
        CHANGED: "Warning",
        ADDED_IN_TARGET: "Success",
        REMOVED_FROM_TARGET: "Error",
        SAME: "Information"
      };

      return highlights[changeType] || "None";
    }

  });
});