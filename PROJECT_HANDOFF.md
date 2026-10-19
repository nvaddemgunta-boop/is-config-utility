# SAP BTP IS - Configuration Tool — Project Handoff
 
## 1. Purpose of This Document
 
This document provides project context, implementation progress, known issues,
and the next implementation steps for an AI coding assistant working directly
with this repository.
 
IMPORTANT:
- Inspect the actual repository before changing code.
- Previous development guidance was supplied through chat; the chat assistant
  did not inspect repository files or execute the application.
- Some suggested snippets may have been modified during implementation.
- Treat the repository as the authority for existing implementation details.
- Distinguish user-confirmed working behavior from unverified suggestions.
- Do not overwrite working functionality merely to match examples here.
 
## 2. Project Overview
 
Application name:
 
    SAP BTP IS - Configuration Tool
 
Purpose:
 
A read-only, multi-environment SAP Integration Suite configuration dashboard.
 
Primary modules:
 
1. Integration Flow Configuration Comparison
2. Value Mapping Comparison
 
Future feature placeholders:
 
3. Deployment Version Comparison
4. Configuration Export
5. Tenant Configuration Search
6. YAML Validator
7. Payload Tools
 
These future modules are placeholders, not implemented functionality.
 
Technology stack:
 
- SAPUI5 Freestyle frontend
- CAP Node.js backend
- SAP Cloud SDK for destination-based HTTP connectivity
- SAP Business Application Studio development environment
- SAP BTP Destination service
- Planned Cloud Foundry deployment
 
Do not replace the CAP backend with ABAP.
 
Project root:
 
    /home/user/integrate-360-app
 
UI namespace:
 
    chs.iflowcompare
 
Supported environment identifiers:
 
    DEV
    QAS
    UAT
    PROD
 
DEV and QAS connectivity have been confirmed.
Do not assume UAT or PROD connectivity is configured.
 
## 3. Development Preferences
 
The developer is relatively new to SAPUI5/BTP UI development.
 
When explaining changes:
 
- Give exact file paths.
- Identify the function or XML section being changed.
- State whether code is added or replaced.
- Prefer complete functions over ambiguous partial insertions.
- Explain prerequisites and test steps.
- Keep changes incremental.
- Preserve existing working iFlow functionality.
- Avoid repeated large UI rewrites.
- Provide actual verification results when tools are available.
- Do not claim tests passed unless executed.
 
## 4. Expected Repository Structure
 
Verify these paths and existing exports before editing.
 
    integrate-360-app/
    ├── app/iflow-compare-ui/webapp/
    │   ├── index.html
    │   ├── Component.js
    │   ├── manifest.json
    │   ├── controller/App.controller.js
    │   ├── view/App.view.xml
    │   └── css/style.css
    ├── srv/
    │   ├── iflow-service.cds
    │   └── lib/
    │       ├── environment-config.js
    │       ├── mock-catalog-service.js
    │       ├── mock-compare-service.js
    │       ├── integration-suite-client.js
    │       ├── catalog-service.js
    │       ├── compare-service.js
    │       ├── value-mapping-catalog-service.js
    │       └── value-mapping-compare-service.js
    ├── server.js
    ├── package.json
    └── .cdsrc-private.json
 
Never commit `.cdsrc-private.json` or other binding/credential files.
 
Relevant dependencies used or previously instructed:
 
- @sap/cds
- express
- @sap-cloud-sdk/connectivity
- @sap-cloud-sdk/http-client
- Optional development tooling: @sap/cds-dk
 
Confirm actual dependencies and scripts in package.json.
 
Expected scripts:
 
    start: cds-serve
    watch: cds watch
    watch:hybrid: cds watch --profile hybrid
 
A minimal CDS service was introduced so CAP could start:
 
    namespace chs.integrate360;
 
    service IFlowCompareService @(path: '/odata/v4/iflow') {
      entity Health {
        key ID : String;
        status : String;
      }
    }
 
## 5. Architecture
 
Frontend:
 
    SAPUI5 XML view
      → App.controller.js
      → backend REST endpoints
 
Backend:
 
    server.js
      → catalog / comparison business services
      → integration-suite-client.js
      → SAP BTP Destination
      → Integration Suite OData API
 
Backend REST routes are registered inside:
 
    cds.on("bootstrap", (app) => {
      // Routes
    });
 
The server uses express.json() and exports cds.server.
 
Keep remote Integration Suite requests in integration-suite-client.js.
 
Do not put destination credentials or remote tenant authentication logic in
the frontend.
 
## 6. Connectivity — Confirmed Foundation
 
Environment-to-destination mapping:
 
| Environment | Destination |
|-------------|-------------|
| DEV         | IS_DEV      |
| QAS         | IS_QAS      |
| UAT         | IS_UAT      |
| PROD        | IS_PROD     |
 
Destination configuration pattern:
 
- Authentication: OAuth2ClientCredentials
- ProxyType: Internet
- Destination URL ends with /api/v1
- Client requests use paths relative to that URL
 
Example relative path:
 
    /IntegrationPackages
 
Do not accidentally duplicate /api/v1 in constructed URLs.
 
Local BAS connectivity uses hybrid Destination service binding.
 
Typical setup commands, only if required:
 
    cf target
    cf services
    cds bind -2 integrate360-destination:integrate360-destination-key
    cds watch --profile hybrid
 
Service/service-key creation was previously used when not already present:
 
    cf create-service destination lite integrate360-destination
    cf create-service-key integrate360-destination integrate360-destination-key
 
Do not recreate services or keys unnecessarily.
 
If the CF token expires:
- Authenticate against the correct Cloud Foundry API.
- Select the correct organization and space.
- Do not request or expose passwords in chat.
 
## 7. Application Startup Requirements
 
On initial application launch:
 
- Initialize UI models.
- Load available environments from GET /api/environments.
- Do not automatically load DEV or QAS package catalogs.
- Do not load VM schemas or mapping entries.
- Leave source and target environment selections blank.
 
Normal UI static-resource requests are expected; the restriction concerns
application backend data calls.
 
Selecting a feature alone must not trigger artifact or mapping-entry loading.
 
Selecting an environment:
- Loads packages for that module and side only.
 
Expanding a package:
- Loads the relevant artifact metadata for that package.
 
Comparing:
- Loads the selected artifacts' comparison detail.
 
## 8. Feature Navigation Requirements
 
Current visual preference:
 
- Seven independent feature modules in one row at desktop width.
- No arrows, connectors, or process-flow meaning.
- Circular outlined SAP icons.
- Full readable labels below the icons.
- Only the selected implemented feature has a blue-filled circle.
- Other icons remain outlined.
- No horizontal scrollbar at the target desktop viewport.
- Reasonable responsive behavior at smaller widths.
- Preserve keyboard focus visibility.
 
IconTabHeader was tried and abandoned because labels were truncated and layout
became cramped.
 
Current implementation uses:
- Panel
- HBox
- VBox per module
- SAPUI5 Button for icon
- Text below icon
 
Relevant CSS names introduced:
 
    featureModulePanel
    featureModuleRow
    featureModule
    featureModuleCircle
    featureModuleCircleActive
 
Active styling was confirmed working after applying the active class directly
to the icon button rather than only its parent.
 
Expected button IDs:
 
    btnIflowConfig
    btnValueMapping
    btnDeploymentVersion
    btnConfigExport
    btnTenantSearch
    btnYamlValidator
    btnPayloadTools
 
Verify actual IDs.
 
Feature keys:
 
    IFLOW_CONFIG
    VALUE_MAPPING
    DEPLOYMENT_VERSION
    CONFIG_EXPORT
    TENANT_SEARCH
    YAML_VALIDATOR
    PAYLOAD_TOOLS
 
Relevant controller methods:
 
    onFeatureButtonPress()
    _setActiveFeatureStep()
 
Active feature is stored in:
 
    view>/activeFeature
 
Supported feature navigation currently includes:
- IFLOW_CONFIG
- VALUE_MAPPING
 
Future feature clicks should clearly indicate that the feature is not available.
Do not imply that all seven modules work.
 
## 9. iFlow Comparison — Existing Baseline
 
The existing iFlow module is the behavior and visual reference for VM comparison.
 
Implemented/reported working behavior includes:
 
- Source and target environment selection.
- Package-first catalogs.
- Lazy loading of iFlows on package expansion.
- Package labels show artifact count after loading, e.g. Package Name (7).
- Source artifact selection.
- Target match indication.
- Comparison of externalized parameters.
- Summary counters:
  - Changed
  - Added
  - Removed
  - Same
- Search and status filtering.
- Expandable results grouped by iFlow.
- Side-by-side source and target values.
- Color-coded statuses and row accents.
 
Parameter result structure:
 
    parameterSummary
    parameterComparisons
    differences
 
parameterComparisons contains all rows, including SAME.
 
differences contains nonmatching rows and existing metadata differences.
 
Status codes:
 
    CHANGED
    ADDED_IN_TARGET
    REMOVED_FROM_TARGET
    SAME
 
Meaning:
 
- CHANGED: key exists in both, values differ.
- ADDED_IN_TARGET: key exists only in target.
- REMOVED_FROM_TARGET: key exists only in source.
- SAME: key and values match.
 
Do not break the existing differences array or dialogs that depend on it.
 
## 10. Value Mapping UX Requirements
 
VM comparison must follow the SAME package-first pattern as iFlow comparison.
 
Required flow:
 
1. Select Value Mapping Comparison.
2. Select source environment.
3. Load source packages only.
4. Expand a package.
5. Load VM artifacts belonging to that package.
6. Update package label with VM count.
7. Select one or more source VM artifacts.
8. Select target environment.
9. Expand target package to see matching VM artifacts.
10. Indicate matching target selections.
11. Compare selected source artifacts against their target counterparts.
12. Display expandable, grouped comparison results.
 
Do not replace the package trees with a flat global VM list.
 
Package count is the count of VM artifacts, not schemas or mapping entries.
 
Search should clearly distinguish:
- Package metadata search.
- Search of VM metadata already loaded.
 
Do not fetch every package's detailed artifacts or mapping entries merely to
support a search.
 
Target-side matching currently uses package ID plus artifact ID.
Confirm intended behavior for artifacts moved between packages before changing
that matching rule.
 
## 11. Value Mapping Backend — Confirmed Working Parts
 
User confirmed that DEV and QAS calls work for:
 
    GET /api/debug/value-mappings
 
    GET /api/debug/value-mapping-schemas
      ?environment=...
      &artifactId=...
      &version=...
 
User also confirmed these package-lazy-load APIs work:
 
    GET /api/value-mapping-catalog?environment=DEV
 
    GET /api/value-mapping-package-artifacts
      ?environment=DEV
      &packageId=...
 
Equivalent QAS calls also work.
 
Business service:
 
    srv/lib/value-mapping-catalog-service.js
 
Functions previously introduced:
 
    getValueMappingPackageCatalog(environmentId)
    getValueMappingsForPackage(environmentId, packageId)
    clearValueMappingCache(environmentId)
 
Current catalog approach:
 
- Initial catalog loads integration packages only.
- Package expansion obtains VM artifact metadata.
- VM metadata is filtered by package ID.
- A short, process-local metadata cache was introduced per environment.
- Proposed TTL: five minutes.
 
Inspect actual implementation before assuming cache behavior.
 
Any admin/debug cache-clear route must be removed or properly protected before
production deployment.
 
Package model pattern:
 
    {
      packageId,
      packageName,
      displayName,
      selected,
      valueMappingsLoaded,
      valueMappingCount,
      valueMappings: [...]
    }
 
Initial placeholder children provide a tree expand control.
 
Placeholder rows must not be selectable or counted as artifacts.
 
## 12. Value Mapping API Client
 
Dedicated entity set:
 
    /ValueMappingDesigntimeArtifacts
 
Schemas:
 
    /ValueMappingDesigntimeArtifacts(
      Id='<artifactId>',
      Version='<version>'
    )/ValMapSchema
 
Entries for a schema:
 
    /ValueMappingDesigntimeArtifacts(
      Id='<artifactId>',
      Version='<version>'
    )/ValMapSchema(
      SrcAgency='<sourceAgency>',
      SrcId='<sourceIdentifier>',
      TgtAgency='<targetAgency>',
      TgtId='<targetIdentifier>'
    )/ValMaps
 
These paths represent the implementation tested so far.
Validate exact response shapes and API capabilities against actual responses
and approved documentation when needed.
 
Relevant client methods:
 
    getValueMappingArtifacts()
    getValueMappingArtifactById(artifactId)
    getValueMappingSchemas(artifactId, version)
    getValueMappingEntries(artifactId, version, schema)
 
Relevant existing helpers may include:
 
    escapeODataString()
    extractODataResults()
    getValueMappingArtifactVersion()
 
Do not assume existing helper signatures or exports without inspecting them.
 
Handle OData string escaping and URI encoding correctly.
 
Verify pagination support for every collection used:
- Packages
- VM artifacts
- Schemas
- Mapping entries
 
An incomplete first page must not silently be treated as the entire dataset.
 
## 13. Critical Version Requirement
 
VM versions can differ between environments.
 
Example:
 
    DEV: 1.8.9
    QAS: 1.8.7
 
Never use the source version for target schema or entry reads.
 
Required behavior:
 
- Source schemas: source artifact's version.
- Source entries: source artifact's version.
- Target schemas: target artifact's version.
- Target entries: target artifact's version.
 
The earlier implementation incorrectly reused the source version for target
entry reads and caused HTTP 404 errors.
 
A fix was supplied to resolve target metadata independently by artifact ID.
 
Resolve metadata independently for BOTH environments and record the versions
actually compared.
 
If catalog selection has become stale, fail clearly or explicitly refresh
metadata. Do not silently compare a different version without informing the UI.
 
If metadata returns multiple versions:
- Do not pick an arbitrary first record.
- Resolve the version corresponding to the artifact selection/catalog policy.
 
Version mismatch alone is not a mapping-value difference.
Display both versions as context.
 
## 14. VM Compare Endpoint and Response
 
Endpoint:
 
    POST /api/value-mappings/compare
 
Request pattern:
 
    {
      "sourceEnvironment": "DEV",
      "targetEnvironment": "QAS",
      "selectedArtifacts": [
        {
          "packageId": "<package-id>",
          "artifactId": "<vm-id>",
          "artifactName": "<display-name>",
          "version": "<source-version>"
        }
      ]
    }
 
The backend independently discovers the target version.
 
Response pattern:
 
    {
      "sourceEnvironment": "DEV",
      "targetEnvironment": "QAS",
      "comparedAt": "<timestamp>",
      "summary": {
        "totalArtifacts": 1,
        "sameArtifacts": 0,
        "differentArtifacts": 0,
        "missingInTarget": 0,
        "errors": 0,
        "changed": 0,
        "addedInTarget": 0,
        "removedFromTarget": 0,
        "same": 0
      },
      "results": [
        {
          "packageId": "...",
          "artifactId": "...",
          "artifactName": "...",
          "sourceVersion": "...",
          "targetVersion": "...",
          "status": "...",
          "mappingSummary": {},
          "schemas": [
            {
              "schema": {
                "srcAgency": "...",
                "srcId": "...",
                "tgtAgency": "...",
                "tgtId": "..."
              },
              "status": "...",
              "mappingComparisons": [],
              "mappingSummary": {}
            }
          ],
          "errors": []
        }
      ]
    }
 
## 15. Current Blocking Issue
 
The latest compare response contains:
 
- One artifact.
- Multiple schemas.
- Empty mappingComparisons arrays for every schema.
- All mapping counters zero.
- Artifact incorrectly or prematurely reported as SAME.
 
Example observed shape:
 
    status: "SAME"
    schemas: [
      {
        status: "SAME",
        mappingComparisons: [],
        mappingSummary: {
          changed: 0,
          addedInTarget: 0,
          removedFromTarget: 0,
          same: 0
        }
      }
    ]
 
The UI consequently displays:
- Zero counters.
- No artifact groups / No data.
 
This is NOT yet proven to be only a UI binding issue.
 
Potential causes requiring investigation:
 
1. ValMaps API genuinely returns no entries.
2. OData extraction loses returned entries.
3. Actual entry field names differ from assumed names.
4. buildEntryMap silently drops entries because the source value is unresolved.
5. Empty source values are incorrectly discarded.
6. Pagination is not followed.
7. Response nesting differs from the assumed structure.
 
Do not guess property aliases or declare success without verifying the actual
sanitized response shape.
 
## 16. Immediate Diagnostic Task
 
Test:
 
    GET /api/debug/value-mapping-entries
      ?environment=<DEV-or-QAS>
      &artifactId=<selected-vm-id>
      &version=<that-environment-version>
      &srcAgency=<schema-source-agency>
      &srcId=<schema-source-identifier>
      &tgtAgency=<schema-target-agency>
      &tgtId=<schema-target-identifier>
 
For each environment determine:
 
- HTTP status.
- Raw response envelope property names.
- Extracted entry count.
- Entry property names only.
- Normalized entry count.
- Compared row count.
 
Do not log or share actual mapping values.
 
Use diagnostic counts to identify exactly where records disappear:
 
    raw API collection count
      → extracted entry count
      → normalized map count
      → comparison row count
 
Remove temporary diagnostic logging after resolution.
 
## 17. Comparison Correctness Requirements
 
Within a schema, the initially proposed identity is the source mapping value.
 
Schema identity includes:
 
    SrcAgency
    SrcId
    TgtAgency
    TgtId
 
Use collision-safe composite keys, such as JSON.stringify on a tuple, rather
than delimiter joining when identifiers could contain the delimiter.
 
Mapping result states:
 
- SAME
- CHANGED
- ADDED_IN_TARGET
- REMOVED_FROM_TARGET
 
Artifact-level states must distinguish:
- Same
- Different
- Missing in target
- Error
- Empty/no entries when applicable
 
Important corrections needed in earlier sample code:
 
### A. Preserve exact values
 
Do not trim mapping values automatically.
 
Whitespace, empty strings, case, zero, and false may be meaningful.
 
Do not use:
 
    value || ""
 
when that could replace valid false/zero values.
 
Use explicit validation or nullish handling as appropriate.
 
### B. Do not silently discard unresolved fields
 
An unrecognized response shape is a parsing error, not an empty mapping.
 
### C. Handle duplicate identities
 
Do not silently overwrite duplicate source values with Map.set().
Verify API semantics and either:
- Compare the appropriate full identity/multivalue structure, or
- Return a clear validation error for unexpected duplicates.
 
### D. One-sided schemas
 
Earlier code counted a missing schema as one added/removed mapping while not
retrieving its entries.
 
Instead:
- Retrieve entries from the existing side.
- Classify actual entries as added/removed.
- Track schema-level differences separately.
- Do not mix schema counts with mapping-entry counts.
 
### E. Missing artifacts
 
Display missing artifacts explicitly.
Do not invent a fake mapping row just to make the UI show something.
 
### F. Errors and empty data
 
Do not report SAME simply because arrays are empty after a parse failure.
 
A genuinely empty artifact/schema can be displayed as empty only after
successful retrieval and validated parsing.
 
## 18. VM Frontend State
 
Models previously introduced:
 
    view
    vmSource
    vmTarget
    vmComparison
 
A raw vmResult model was also proposed earlier; inspect whether it remains.
 
Controller state variables:
 
    _vmSourceEnvironment
    _vmTargetEnvironment
    _vmSourceCatalogFull
    _vmTargetCatalogFull
    _vmSourceSearchText
    _vmTargetSearchText
 
Relevant methods:
 
    onVmSourceEnvironmentChange()
    onVmTargetEnvironmentChange()
    _loadVmCatalog()
    onVmSourceTreeToggle()
    onVmTargetTreeToggle()
    _loadVmArtifactsForPackage()
    onVmSourceCheckboxSelect()
    _syncVmTargetSelection()
    _getSelectedVmArtifacts()
    _updateVmSelectionText()
    onVmSourceSearch()
    onVmTargetSearch()
    _applyVmSourceFilter()
    _applyVmTargetFilter()
    _filterVmPackages()
    onVmComparePress()
 
Results methods proposed:
 
    _prepareVmComparisonResults()
    _buildVmGroups()
    _incrementVmSummary()
    _formatVmSchemaName()
    onVmResultFilterPress()
    onVmResultSearch()
    _applyVmResultFilters()
 
Formatters proposed:
 
    formatVmChangeText()
    formatVmChangeState()
    formatVmRowHighlight()
    formatVmSchemaDetails()
    formatVmArtifactDetails()
 
Verify actual implementation and remove duplicate method definitions if present.
 
## 19. UI Result Structure Required
 
Results must show:
 
1. Global mapping-entry counters.
2. Status filters.
3. Search.
4. Expandable artifact groups.
5. Source and target versions.
6. Expandable schema groups.
7. Side-by-side mapping values and status.
 
Example:
 
    Value Mapping Comparison Results
 
    2 Changed | 1 Added | 1 Removed | 12 Same
 
    [All] [Changed] [Added] [Removed] [Same]
    [Search values, schemas, packages, artifacts]
 
    ▼ Mapping Artifact — 4 differences
      DEV version: 1.2.0 | QAS version: 1.1.0
 
      ▼ SourceAgency / SourceIdentifier → TargetAgency / TargetIdentifier
 
      Source Value | Mapped Value (DEV) | Mapped Value (QAS) | Status
 
Status colors:
 
| Status  | UI5 state   |
|---------|-------------|
| Changed | Warning     |
| Added   | Success     |
| Removed | Error       |
| Same    | Information |
 
Do not rely on color alone; keep text status.
 
Missing and empty values must be distinguishable:
- Missing side: em dash or explicit missing indicator.
- Existing empty value: explicit empty-value display if needed.
 
## 20. Required UI Transformation Fix
 
Earlier _buildVmGroups() created groups only from flattened mapping rows.
 
That loses:
- Empty artifacts.
- Empty schemas.
- Missing artifacts.
- Failed artifacts.
- Schema-only differences.
 
Build the base display hierarchy from response.results and schemas first.
Then attach mapping rows.
 
Do not create synthetic SAME/CHANGED/REMOVED mapping rows merely to preserve
artifact visibility.
 
Do not increment mapping-entry counters for empty-schema informational messages.
 
Keep separate concepts:
- Mapping-entry totals.
- Schema differences.
- Missing artifacts.
- Failed artifacts.
 
Filters should clearly indicate whether displayed difference counts are:
- Total counts, or
- Counts within the active filter.
 
Preserve original totals separately if needed.
 
## 21. UI5/XML Issues Already Encountered
 
### Invalid width on IconTabHeader
 
sap.m.IconTabHeader does not support a width property.
It is no longer the recommended navigation control.
 
### Malformed customData snippets
 
Correct form:
 
    <customData>
      <core:CustomData
        key="filter"
        value="REMOVED_FROM_TARGET"
        writeToDom="false" />
    </customData>
 
Do not use:
 
    <customData key="..." value="..." />
 
Ensure root namespace:
 
    xmlns:core="sap.ui.core"
 
### Broken expression binding
 
A previous expression omitted a closing brace on an embedded binding.
 
Incorrect:
 
    ${vmComparison>tgtId }
 
Correct:
 
    ${vmComparison>tgtId}
 
The error was not caused merely by using multiple lines.
 
Formatters were introduced for longer schema/version display strings.
Keep them for readability.
 
### Bound aggregation template warning
 
Browser console showed:
 
    Assertion failed: list bindings support only a single template object
 
Inspect nested List and Table XML.
Each bound items aggregation must have exactly one template.
 
Do not assume this warning is harmless; resolve it before declaring UI complete.
 
### Component-preload.js warning
 
A development console also showed a missing Component-preload.js/MIME error.
 
Investigate separately.
It may be related to development bootstrap/build configuration, but do not
assume it caused missing mapping entries without evidence.
 
## 22. Lazy-Loading and Selection Risks to Review
 
Earlier search code creates shallow package copies.
 
If lazy loading or package selection modifies a filtered copy rather than the
canonical catalog, updates may disappear when search is cleared.
 
Requirements:
 
- Keep canonical state keyed by environment, package ID, artifact ID.
- Update canonical state, then regenerate filtered display state.
- Do not lose selections when filtering.
- Keep package selection consistent with child selections.
- Selecting an unloaded package must not falsely imply all children selected.
- Prevent duplicate concurrent package loads.
- Ignore stale responses after an environment change.
- Reset or invalidate outdated comparison results when selections/environments change.
- Do not require the target tree to be expanded for backend comparison to work.
 
Target tree expansion is a visual metadata operation, not a prerequisite for
backend target artifact resolution.
 
## 23. Security and Data Handling
 
All internal artifacts and mapping data are confidential.
 
- No credentials in source, frontend, logs, screenshots, or prompts.
- Use destinations and service bindings.
- Keep private binding files out of Git.
- Never log full mapping entries or comparison response values.
- Remove earlier console.log statements that print complete comparison data.
- Do not return raw upstream response bodies in user-facing errors.
- Use safe status/code messages and correlation identifiers.
- Validate environments against backend configuration.
- Validate request body shape, artifact IDs, and selection limits.
- Protect backend endpoints according to the deployment authentication model.
- Secure/remove debug endpoints before production.
- Do not send proprietary data to unapproved external tools/services.
- Keep this application read-only against Integration Suite.
- Do not introduce deploy, update, delete, or upsert operations.
 
A POST to the local compare endpoint is acceptable because comparison is
read-only with respect to remote Integration Suite data.
 
## 24. Recommended Next Implementation Order
 
### Phase A — Inspect and diagnose
 
1. Inspect actual repository files and exports.
2. Check current branch and working tree; preserve uncommitted work.
3. Reproduce VM comparison.
4. Inspect sanitized ValMaps response structure.
5. Identify where entries disappear.
6. Confirm independent source/target versions.
7. Fix extraction/normalization without guessing.
 
### Phase B — Correct backend comparison
 
1. Preserve exact mapping values.
2. Handle empty values and duplicates.
3. Handle pagination.
4. Compare one-sided schema entries.
5. Distinguish missing artifact, empty data, and errors.
6. Separate entry counts from schema/artifact status counts.
7. Return deterministic sorted results.
8. Add tests.
 
### Phase C — Correct UI
 
1. Ensure onVmComparePress calls _prepareVmComparisonResults(data).
2. Preserve artifact/schema hierarchy even without rows.
3. Fix aggregation template warnings.
4. Show missing/error/empty states.
5. Render real mapping rows and counters.
6. Keep status text and colors.
7. Preserve search/filter behavior.
8. Add busy state and prevent duplicate compare clicks.
9. Prevent stale compare results after changing environment.
10. Remove full-response console logging.
 
### Phase D — Regression and hardening
 
1. Verify startup loads environments only.
2. Verify package lazy loading on both modules.
3. Verify iFlow comparison unchanged.
4. Verify feature active-icon state.
5. Verify target version differing from source.
6. Verify responsive layout and keyboard navigation.
7. Secure/remove debug routes.
8. Review authentication, limits, and safe errors.
 
Defer new feature modules until VM comparison works end-to-end.
 
## 25. Test Matrix
 
| Scenario | Expected outcome |
|----------|------------------|
| Equal entries | SAME rows |
| Different mapped value | CHANGED row |
| Entry only in target | ADDED_IN_TARGET |
| Entry only in source | REMOVED_FROM_TARGET |
| Different source/target versions | Each environment's version used |
| Missing target artifact | Explicit artifact-level missing state |
| Schema only on one side | Actual entries classified; schema tracked separately |
| Empty schema on both sides | Visible empty state; no fabricated entry counts |
| Unexpected payload shape | Explicit parsing error |
| Empty-string source value | Preserved or validated per actual API semantics |
| Whitespace difference | Preserved and compared exactly |
| Duplicate normalized key | No silent overwrite |
| Paginated entries | All pages included |
| One artifact fails | Other results retained; failed artifact visible |
| Search active during selection | Canonical selection remains correct |
| Environment changed during request | Stale response not applied |
| Target tree not expanded | Backend comparison still works |
| Click feature navigation | Only selected implemented module blue-filled |
| Initial launch | Environments backend call only |
| iFlow regression | Existing behavior remains intact |
 
Use synthetic mapping data in tests.
 
## 26. Validation Commands
 
Assumptions:
- BAS Linux terminal.
- Node.js dependencies already installed.
- Valid hybrid destination binding.
 
Read-only syntax checks:
 
    node --check server.js
    node --check srv/lib/integration-suite-client.js
    node --check srv/lib/value-mapping-catalog-service.js
    node --check srv/lib/value-mapping-compare-service.js
    node --check app/iflow-compare-ui/webapp/controller/App.controller.js
 
These checks do not validate XML bindings or runtime API behavior.
 
Inspect package.json for existing lint/test scripts before choosing test commands.
 
Start development server:
 
    cds watch --profile hybrid
 
Browser:
- Hard refresh after frontend changes.
- Check Console and Network.
- Confirm actual rows and status counts, not just HTTP 200.
 
Do not overwrite private configuration or recreate cloud resources as part of
routine testing.
 
## 27. Completion Criteria for the Current Work
 
VM comparison is complete only when:
 
- Actual mapping entries are retrieved and correctly normalized.
- Each environment uses its own artifact version.
- Mapping-entry counts match actual compared rows.
- Empty/error/missing states are explicit.
- Artifacts and schemas remain visible even without mapping rows.
- Grouped results render correctly.
- Search and filters work.
- No unresolved aggregation template warnings remain.
- No full confidential payloads are logged.
- iFlow functionality remains working.
- Startup loading behavior remains unchanged.
- Tests and remaining limitations are documented.
 
## 28. Reusable AI Coding Assistant Prompt
 
Use this prompt after attaching or referencing this handoff file:
 
    You are assisting with the SAPUI5 Freestyle + CAP Node.js project in this
    repository: SAP BTP IS - Configuration Tool.
 
    First read PROJECT_HANDOFF.md and inspect the actual repository.
    Do not assume earlier chat snippets exactly match current code.
 
    Preserve uncommitted changes and existing working iFlow functionality.
    Do not perform destructive Git operations, expose credentials, or log
    confidential mapping values.
 
    Current task:
    Complete and correct the Value Mapping comparison backend and UI.
 
    Confirmed:
    - DEV/QAS connectivity works.
    - Environment selection loads packages.
    - Package expansion loads VM artifacts with counts.
    - Source selections and target matching work.
    - Selected feature icon highlighting works.
    - POST /api/value-mappings/compare returns artifacts and schemas.
 
    Current blocker:
    mappingComparisons is empty for every schema, counters are zero, and the
    UI displays No data. The backend currently reports SAME despite no
    compared entry rows.
 
    Investigate first:
    1. Inspect integration-suite-client.js and the actual ValMaps response
       extraction.
    2. Verify raw/extracted/normalized entry counts using safe diagnostics.
    3. Determine actual field names without exposing mapping values.
    4. Check buildEntryMap for silent record dropping.
    5. Verify pagination and source/target version handling.
    6. Review XML bound aggregation template warnings.
 
    Implementation requirements:
    - Use each environment's own artifact version.
    - Preserve exact values, including whitespace and valid empty strings.
    - Do not guess response fields or silently treat parse failures as empty.
    - Do not silently overwrite duplicate keys.
    - Retrieve and compare entries in one-sided schemas.
    - Separate entry counts from schema and missing-artifact statuses.
    - Preserve artifact/schema hierarchy independently of mapping rows.
    - Do not create fake comparison rows to make groups visible.
    - Show Changed/Added/Removed/Same plus explicit empty/missing/error states.
    - Keep source/target package trees and iFlow behavior intact.
    - Keep seven independent navigation modules with only the selected
      implemented feature blue-filled.
    - Keep initial backend loading limited to environments.
    - Add busy/error handling and stale-response protection where needed.
    - Remove full-response logging.
 
    Working approach:
    1. Inspect files and give a short evidence-based diagnosis.
    2. List a minimal file-level implementation plan.
    3. Make targeted changes in the workspace if permitted.
    4. Add synthetic-data tests for comparison and UI transformations.
    5. Run available syntax/test/lint checks.
    6. Report files changed, checks actually run, results, and remaining risks.
 
    If live API access is unavailable, implement tests with synthetic
    fixtures and clearly label tenant behavior as unverified.
    Ask for sanitized field names/counts only if they cannot be determined
    from approved repository fixtures or a safe local diagnostic.
 
    Do not start future feature modules until VM comparison is validated
    end-to-end.