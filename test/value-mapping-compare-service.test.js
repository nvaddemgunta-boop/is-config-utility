const assert = require("node:assert/strict");

const {
  compareMappingEntries,
  getSchemaKey
} = require("../srv/lib/value-mapping-compare-service");

function run() {
  const sourceEntries = [
    { SrcValue: "", TgtValue: "source-empty" },
    { SrcValue: "dup", TgtValue: "source-one" },
    { SrcValue: "dup", TgtValue: "source-two" }
  ];

  const targetEntries = [
    { SrcValue: "", TgtValue: "target-empty" },
    { SrcValue: "dup", TgtValue: "source-one" },
    { SrcValue: "dup", TgtValue: "target-two" },
    { SrcValue: "extra", TgtValue: "target-extra" }
  ];

  const rows = compareMappingEntries(sourceEntries, targetEntries);

  assert.equal(rows.length, 4);
  assert.equal(rows.filter((row) => row.sourceValue === "").length, 1);
  assert.equal(rows.filter((row) => row.sourceValue === "dup").length, 2);
  assert.equal(rows.filter((row) => row.sourceValue === "extra").length, 1);
  assert.equal(
    rows.find((row) => row.sourceValue === "").changeType,
    "CHANGED"
  );
  assert.equal(
    rows.find((row) => row.sourceValue === "extra").changeType,
    "ADDED_IN_TARGET"
  );

  const liveShapeRows = compareMappingEntries(
    [
      { Id: "alpha-row", Value: { SrcValue: "alpha", TgtValue: "dev-one" } },
      { Id: "beta-row", Value: { SrcValue: "beta", TgtValue: "shared" } }
    ],
    [
      { Id: "alpha-row", Value: { SrcValue: "alpha", TgtValue: "qas-one" } },
      { Id: "beta-row", Value: { SrcValue: "beta", TgtValue: "shared" } }
    ]
  );

  assert.deepEqual(liveShapeRows, [
    {
      sourceValue: "alpha",
      sourceEnvironmentValue: "dev-one",
      targetEnvironmentValue: "qas-one",
      changeType: "CHANGED"
    },
    {
      sourceValue: "beta",
      sourceEnvironmentValue: "shared",
      targetEnvironmentValue: "shared",
      changeType: "SAME"
    }
  ]);

  const schemaKeyA = getSchemaKey({
    SrcAgency: "A::B",
    SrcId: "C",
    TgtAgency: "D",
    TgtId: "E"
  });

  const schemaKeyB = getSchemaKey({
    SrcAgency: "A",
    SrcId: "B::C",
    TgtAgency: "D",
    TgtId: "E"
  });

  assert.notEqual(schemaKeyA, schemaKeyB);

  console.log("value-mapping-compare-service.test.js passed");
}

run();
