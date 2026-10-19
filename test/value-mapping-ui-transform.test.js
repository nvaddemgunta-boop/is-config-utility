const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadController() {
  const controllerPath = path.join(
    __dirname,
    "../app/iflow-compare-ui/webapp/controller/App.controller.js"
  );

  const source = fs.readFileSync(controllerPath, "utf8");
  const dependencies = new Map([
    ["sap/ui/core/mvc/Controller", {
      extend: function (_name, definition) {
        function FakeController() {}

        FakeController.prototype = Object.assign(
          Object.create(null),
          definition
        );

        return FakeController;
      }
    }],
    ["sap/ui/model/json/JSONModel", function () {}],
    ["sap/m/MessageToast", { show: function () {} }],
    ["sap/m/MessageBox", { warning: function () {}, error: function () {} }],
    ["sap/m/Dialog", function () {}],
    ["sap/m/Table", function () {}],
    ["sap/m/Column", function () {}],
    ["sap/m/ColumnListItem", function () {}],
    ["sap/m/Text", function () {}],
    ["sap/m/Button", function () {}],
    ["sap/m/ObjectStatus", function () {}]
  ]);

  const context = {
    console,
    sap: {
      ui: {
        define: function (deps, factory) {
          context.exportedModule = factory(
            ...deps.map(function (dep) {
              return dependencies.get(dep);
            })
          );
        }
      }
    },
    exportedModule: null
  };

  vm.runInNewContext(source, context, { filename: controllerPath });

  return context.exportedModule;
}

function createModel(initialData) {
  return {
    data: initialData,
    getData: function () {
      return this.data;
    },
    setData: function (data) {
      this.data = data;
    },
    setProperty: function (path, value) {
      if (path === "/groups") {
        this.data.groups = value;
      }
    }
  };
}

function run() {
  const ControllerClass = loadController();
  const controller = new ControllerClass();
  const model = createModel({
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
  });

  controller.getView = function () {
    return {
      getModel: function () {
        return model;
      }
    };
  };

  controller._prepareVmComparisonResults({
    sourceEnvironment: "DEV",
    targetEnvironment: "QAS",
    results: [
      {
        packageId: "PKG",
        artifactId: "ART",
        artifactName: "Artifact",
        status: "DIFFERENT",
        sourceVersion: "1.0.0",
        targetVersion: "1.0.1",
        schemas: [
          {
            status: "DIFFERENT",
            schema: {
              srcAgency: "A",
              srcId: "B",
              tgtAgency: "C",
              tgtId: "D"
            },
            mappingComparisons: [
              {
                sourceValue: "",
                sourceEnvironmentValue: "left-empty",
                targetEnvironmentValue: "right-empty",
                changeType: "CHANGED"
              },
              {
                sourceValue: "dup",
                sourceEnvironmentValue: "same",
                targetEnvironmentValue: "same",
                changeType: "SAME"
              }
            ]
          },
          {
            status: "SAME",
            schema: {
              srcAgency: "C",
              srcId: "D",
              tgtAgency: "A",
              tgtId: "B"
            },
            mappingComparisons: [
              {
                sourceValue: "reverse",
                sourceEnvironmentValue: "reverse-same",
                targetEnvironmentValue: "reverse-same",
                changeType: "SAME"
              }
            ]
          },
          {
            status: "SAME",
            schema: {
              srcAgency: "X",
              srcId: "Y",
              tgtAgency: "Z",
              tgtId: "W"
            },
            mappingComparisons: []
          }
        ]
      }
    ]
  });

  let data = model.getData();
  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0].schemas.length, 2);
  assert.equal(data.groups[0].schemas[0].directionCount, 2);
  assert.match(data.groups[0].schemas[0].displayName, /↔/);
  assert.equal(data.groups[0].schemas[1].mappingRows.length, 0);
  assert.equal(data.groups[0].schemas[0].mappingRows.length, 2);
  assert.equal(
    data.groups[0].schemas[0].mappingRows[0].directionLabel,
    "A / B → C / D"
  );
  assert.equal(data.allRows.length, 2);
  assert.equal(data.summary.changed, 1);
  assert.equal(data.summary.same, 1);

  controller._applyVmResultFilters();
  data = model.getData();
  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0].schemas[0].mappingRows.length, 2);
  assert.equal(data.groups[0].schemas[1].mappingRows.length, 0);
  assert.equal(data.groups[0].schemas[0].mappingRows[0].directionLabel.length > 0, true);

  data.selectedFilter = "CHANGED";
  data.searchText = "";
  model.data = data;
  controller._applyVmResultFilters();

  data = model.getData();
  assert.equal(data.groups[0].schemas[0].mappingRows.length, 1);
  assert.equal(data.groups[0].schemas[1].mappingRows.length, 0);

  data.searchText = "does-not-match";
  model.data = data;
  controller._applyVmResultFilters();

  data = model.getData();
  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0].schemas[0].mappingRows.length, 0);
  assert.equal(data.groups[0].schemas[1].mappingRows.length, 0);

  console.log("value-mapping-ui-transform.test.js passed");
}

run();
