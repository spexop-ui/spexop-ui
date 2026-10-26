# SPX-OSS-005E — correctness and semantic decision acceptance

Date: 2026-10-26. Private engineering delivery, not public/npm readiness or M3 owner acceptance.

## Source and merge chain

- PR #4 was reviewed at the expected `bc35a96fcd2a59018a96d3192fe78d12e5a8cb73`.
- Correctness fix `413b6b3a5395df17d5041aa2292fbeba69eb17e7` passed 204 tests, build, lint, typecheck and isolated frozen/offline installation. Earlier failing attempts are retained in local evidence.
- Normal PR #4 merge: `c9f4a2a3b6c1c0de5a48aba86ba74c70ec00d14f`, 2026-10-26 06:30:41 UTC. Main passed 204 tests. No protection bypass/force push.
- New branch: `feat/oss-005e-semantic-review`. Implementation `e829289cf4ef5e24558200de2b7c8841d200880e`; independent finding corrected in `d41630705cfb0dcae389a24b16b578ac5f9f6f4b`.
- Final implementation passed **211/211 tests**, build, lint and typecheck, both locally and from an isolated Git archive with frozen/offline install. Theme source, package/dependency definitions and provenance are unchanged.

## Correctness repairs in the merged base

1. Root aliases inherited into a descendant dark scope are no longer re-evaluated as if defined in that scope.
2. Non-inline Tailwind aliases are unsupported until definition-time computation can be proven; inline aliases keep reference chains.
3. Competing root/shared declarations, unknown file order and incompatible dark selectors do not receive invented priority.
4. CSS-wide/context-dependent values and `@property` registrations are reported as unsupported, including references to registered properties.
5. Sharing a scalar source does not equate semantic roles. Unknown alias roles remain separate; primary/link identities are preserved. Only proven namespace/source duplicates are grouped.

The model records selector, mode, ancestors/layer information, source order and file/line/column. It supports a bounded root/dark/inline subset, not a complete cascade, import graph or dynamic JS analyzer. Layered/unsupported declarations remain visible. Cross-file traversal order is not CSS load order. Resolution means evidence within the declared static context, not proof of runtime usage.

Normative rationale: [CSS custom-property computation and inheritance](https://www.w3.org/TR/css-variables/) and [Tailwind inline theme references](https://tailwindcss.com/docs/theme#referencing-other-variables). Chrome independently reproduced inherited red aliases and normal-red versus inline-blue dark descendant behavior; this is a manual acceptance fixture, not a new runtime verification product.

## New developer review contract

`pnpm foundation <project>` retains dry-run, `--answers`, `--decisions`, `--prepare-answers` and exclusive `--write` behavior. Its JSON now exposes:

- `discoveredSources`: exact declaration, context and provenance.
- `resolvedAliases`: only supported resolutions, traceable chains and canonical sources.
- `semanticProposals`: editable name-derived suggestions, applied modes and graph/value blockers; never asserted product semantics.
- `requiredDecisions`: pending decisions, source chains, reasons, possible actions and affected outputs.
- `unsupportedExcluded`: unresolved computations, reference blockers, explicit exclusions and coverage limits.
- `outputImpact`: conditional CSS/Tailwind/DTCG targets and blocked files. Unassigned roles do not invent output names. Wildcards describe families, not a complete downstream dependency closure.

Known-name proposals can be corrected with explicit `map:<sourceId>` answers without rewriting input CSS. Template guidance IDs exactly match pending decisions; recorded answers remain separate. Alias chain display is bounded to 32 steps with a link to remaining graph edges.

Example: `src/styles/theme.css:2:3 --radius` offers `borders.radiusSubtle` or `borders.radiusRelaxed`; corresponding `--theme-radius-*` and light/dark DTCG paths are conditional. Until reviewed, all three output files are blocked. Unsupported CSS computations cannot be repaired by arbitrary semantic answers.

## Same algorithm across four projects

| Project | Declarations / aliases | Resolved / derived / unsupported / ambiguous records | Automatic mappings | Pending decisions in untouched run | Result |
| --- | --- | --- | --- | --- | --- |
| Fieldwork | 30 / 0 | 30 / 0 / 0 / 0 | 28, prior verified mappings retained | 6 initially; 7 answers in reviewed successful replay | Three output hashes unchanged |
| shadcn-admin | 92 / 40 | 116 / 6 / 16 / 0 | 8, exact prior mappings retained | 54 = 42 mapping + 12 proposal | Raw production blocked |
| tailadminlte-react | 35 / 0 | 40 / 2 / 14 / 0 | 2, exact prior mappings retained | 33 = 18 mapping + 14 proposal + 1 inheritance | Raw production blocked |
| Pomify, fourth blind | 155 / 45 | 145 / 34 / 0 / 29 | 8 name proposals, intent not owner-confirmed | 83 = 71 mapping + 12 proposal | Raw production blocked |

Resolution records are per node/mode, not unique source counts. Mapping counts do not prove the author's intended semantics. No wrong name-rule mapping was observed; independent fourth-project semantic intent remains unconfirmed.

- Fixed source SHAs: shadcn `e16c87f213a5ba5e45964e9b67c792105ec74d26`; tailadmin `89465562cfc5f30e65b33ec72286cb87968c5fe4`; [MIT Pomify](https://github.com/Blazehue/Pomify/tree/5c8c5f1d377932c48943dd13dd0e6aae4d12fb4e) `5c8c5f1d377932c48943dd13dd0e6aae4d12fb4e`.
- Historical shadcn 81 uncertainties / 97 decisions and 005D 53 decisions remain recorded. Current 54 is not a regression hidden by counting: 16 formerly resolved records are now unsupported; distinct semantic roles remain separate. These 16 downgrades are conservative uncertainty, not 16 browser-proven wrong values.
- Redundant alias declaration decisions grouped: Fieldwork 0, shadcn 23, tailadmin 0, Pomify 32. Different from historical mode/export-conflict counts; do not subtract directly from the old 81.
- Unique source IDs in unsupported/excluded review: 1 / 19 / 16 / 44. These include downstream validation/reference blockers, not just graph `unsupported` statuses. Unsupported sources are not random mapping questions.
- The fourth worker selected and inventoried Pomify before implementation READY, without previous answers. First run exit 1 is preserved. All 155 declarations and 208 resolution records were independently reviewed: **0 observed false resolved, 0 unreviewed records**, within the static contract.
- Fourth audit found one local report inconsistency: `--spacing: 0.25rem` showed no proposal blocker while `unsupportedExcluded` correctly reported `UNSUPPORTED_UNIT`. Generic fix adds diagnostic blockers next to proposals; regression test added. Second read-only run changed only four proposal blocker arrays. All graph/mapping/decision data and source hashes stayed unchanged.
- First-run failures are preserved. No answers or special source-name rules were added for Pomify. No source project was modified during discovery.

## Output and browser evidence

Fieldwork reviewed replay retains 28 mappings / 7 answers and hashes:

| Output | SHA-256 |
| --- | --- |
| CSS | `f16d91090cf6f8565bb97823cd62de644189f9292ad713e337320551632bfdf7` |
| Tailwind | `b82a605931d969ae9470deed693c3ac20d6f72391d54f550bd367a08e010d7f0` |
| DTCG | `322e61bc97b9ea7fa75284b1f54fec1360d0961507d31e76eb81cef253e191e7` |

A separate shadcn copy reused the explicitly reviewed 005C expert color adapter. Current engine wrote fresh outputs; all three hashes match the earlier adapter output. App TypeScript/build passed. Chrome at 1470px verified light/dark, Dashboard → Tasks and filtering to TASK-9366, with no captured warning/error logs. This limited expert integration is **not** raw onboarding success. Original source and historical upstream tailadmin TS6/dev React failures remain untouched; no fresh tailadmin browser pass is claimed. Mobile/full accessibility are not re-accepted in this slice.

## Acceptance recommendation

**Technical GO for this bounded correctness/reporting slice**, subject to normal owner PR review. Existing negative tests cover cycle/missing/context collisions/alias chains/derived expressions/semantic conflicts/provenance/answers/overwrite; new tests cover report alignment, editable suggestions, separate roles, real output impact and downstream blockers. This is not universal CSS support or proof that all possible false resolution cases are absent.

**M3 user experience NO-GO.** External raw runs still block with 54/33/83 decisions and unsupported computations. No novice human study was performed. M3 remains open; M4/M5/M6 and global security/license/public/npm gates are unchanged.

Smallest proposed next slice, not started: explicit semantic role inventory and safe output-scope decisions. Let a user review preserved custom roles and deliberate exclusions without forcing each card/popover/sidebar role into the current smaller Theme model. Establish how many decisions this can legitimately remove using the preserved first runs; retain unsupported computations as technical limits, not preference questions. Any expansion of Theme's public model needs a separate scope/architecture decision.

Evidence stays in workspace `outputs/oss-005e/`: pre/post-fix reproductions, PR4 review/merge, main tests, final-clean logs, final three-project JSON, independent fourth audit/first/final runs, mapping/hash comparisons, browser screenshots and behavior JSON. These local artifacts are not automatically available to remote PR readers; this committed note records the reproducible scope and results.
