# 005K acceptance boundary

Base: private main `c8ecae2c02bb79d81fbdf7e60a80c08a6a14d16d`, owner merge
of PR #9; same tree as accepted `1fe069a`. Main passed 369 local tests;
independent PR9 review reran 58 targeted tests and typecheck.

## Root cause: FocusForge

Pinned source `8e256e0944672be089e1ab119adda5a90023e609`:
`src/main.tsx:5` imports `src/styles/globals.css`. This file has 39 custom
property declarations, HSL channel streams and Tailwind 3 `@layer`/`@tailwind`
directives. A separate `src/index.css` contributes 23 discovered declarations;
the discovery inventory is not the actual entrypoint/import graph. Vite config
uses React and PWA; PostCSS config uses Tailwind/autoprefixer. The inspected prior
controlled build generated one 24,900-byte CSS bundle containing 192 declarations.
Raw capture remains 62, raw export 0; compiled native export remains 39/192.

The compiled HTML links `assets/index-C-tZf4E9.css`. Chrome CSSOM observed that link
at document slot 0 in Dashboard/Tasks, light/dark. CDP response bytes hash-match
the captured bundle, including a service-worker-cache response. No map/manifest
exists in the artifact: individual authored-to-compiled links remain **unknown**.
Similar HSL values and shared names were not used to invent provenance.

## Independent blind application

`zahrabayatt/to-do-app`, MIT, source `060c7ccd636fb39d5400563a61d4943734aba991`;
prebuilt gh-pages `238f6247d4518701df3aa9f9867cd35bd3262152`. An independent worker
selected it without mapping preparation. Authored CSS uses Tailwind utilities,
so capture finds 0 authored custom properties; compiled capture has 163 declarations.
No source map or manifest establishes source-to-build lineage. This is an honest
negative blind result, not a zero-token successful onboarding result.

Chrome observed Google Fonts CSS at slot 0 and app CSS at slot 1, in tasks/categories
and light/dark. The local bundle bytes match, but the external stylesheet is outside
the captured inventory. Order-based export is blocked; no stylesheet is substituted.
66 original source-file hashes and the first blind evidence are unchanged. No foreign
install or build ran. Existing compiled JS was statically inspected before local UI
verification; this is not a comprehensive security audit.

## Technical evidence and limits

- Five historical source captures: 30/92/35/155/62. Default exports 29/47/0/79/0;
  prior native plan hashes remain identical. No project/token-specific engine branch.
- New unit/negative cases cover map absence/staleness/positions/content, bundle hashes,
  duplicate identity/slots, reversed order, media/supports, dynamic/style/adopted/shadow,
  unknown compiler, manifest relationships and immutable capture.
- Independent review found and closed an implicit PostCSS sourceMappingURL file read
  (2 reads -> 0) and unchecked reference-summary projection. References now come from
  verified tokens. No open independent findings remain; eight adversarial checks pass.
- The four current FocusForge observations bind the same canonical CSS hash
  `bbda066731a8093812034545c883fb92797b777465cecf94688be0c6df71ded4`
  to the existing 005J 224/224 computed-style proof. Those 224 comparisons are historical,
  not a new test run. New evidence is CSSOM order, response bytes and current UI states.
- No new source-to-output browser equivalence is claimed. Source-map links in positive
  micro fixtures are partial positional evidence, never an authenticated build receipt.
- Existing exporter may conservatively refuse a terminal declaration with trailing
  whitespace and no semicolon. This pre-existing false-negative remains a limitation;
  the task did not normalize source values to hide it.

Build/load evidence correctness: GO within the documented supplied-evidence boundary.
Full source -> bundle -> browser equivalence and independent onboarding: NO-GO.
M3 remains open. Next bounded proposal: an explicitly invoked, inspected build-evidence
collector binding CSS/map/source snapshots to one build execution, then evaluate
transformations rather than upgrading positional maps to behavior proof.

Detailed logs, preserved first failures, browser snapshots, fixture hashes and clean
verification live under `outputs/oss-005k/` in the engineering workspace. Engineering
Master is the sole roadmap/gate authority. No Actions/Copilot/public/npm/prod action.
