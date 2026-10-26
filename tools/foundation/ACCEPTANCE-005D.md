# SPX-OSS-005D — bounded graph acceptance

Implementation source: `0cff735031c8de69d0cd80ba1407eacf348a700f`; private main after PR #3: `188aada651ddcc5f9042abc56b19d3ad38852187`. New PR requires separate review and merge. No Theme source, dependencies, versions or provenance selection changed.

## Observed results

| Measure | Fieldwork | shadcn-admin | tailadminlte-react |
|---|---:|---:|---:|
| Raw declarations | 30 | 92 | 35 |
| Literal / alias / derived nodes | 30 / 0 / 0 | 49 / 40 / 3 | 34 / 0 / 1 |
| Resolved alias-mode records | 0 | 80 | 0 |
| Conditional mappings reviewed correct / wrong | 28 / 0 | 8 / 0 | 2 / 0 |
| Real unknown source roles | 2 | 41 | 18 |
| Mapping/conflict questions | 2 | 41 | 19 |
| Duplicate alias decisions grouped | 0 | 40 | 0 |
| Initial required answers | 6 | 53 | 34 |
| Completed answers | 7 | no successful raw output | 43 in scoped expert experiment |

A source declaration is a parsed CSS declaration, not proof of active usage. The third project's nineteenth mapping question is a literal shadow expression classified as derived in the graph; it was explicitly ignored in the scoped experiment. Its 14 component-scoped declarations remain unsupported. Zero observed wrong mappings is limited to the reviewed mappings above, not a universal correctness claim. Names remain proposed conventions.

The original shadcn 81 ambiguities split exactly into **36 duplicate alias questions + 4 root/export conflicts + 41 genuine source choices**. Its three `calc()` expressions were outside that old 81 and still block raw generation. Mandatory answers decrease 97→53, not to zero. The prior failed experiment and expert adapter are not reclassified as generic success.

Fieldwork keeps 28 golden-provenance mappings and seven reviewed choices. CSS, Tailwind and DTCG hashes are identical to 005C. Original inputs are unchanged. The same algorithm, without project-name branches, runs on all three projects.

## Pinned independent inputs

- shadcn-admin: MIT, `satnaing/shadcn-admin@e16c87f213a5ba5e45964e9b67c792105ec74d26`.
- Third worker selected MIT `wilocampo/tailadminlte-react@89465562cfc5f30e65b33ec72286cb87968c5fe4` before implementation readiness. All 157 original file hashes remain unchanged. The worker had no implementation/tests or previous answer files. The authorized README displayed its historical Fieldwork section; this limits the strict blindness claim, and is disclosed.
- Third first run: exit 1, 35 declarations, 34 pending answers. Existing app.css-only second experiment: 21 declarations, 43 explicit answers (19 ignores, 14 values, 10 dark choices). First answered preview still failed with nine newly exposed dark choices; second preview/write passed. Generated outputs were manually bridged into body/card/primary/font areas. No engine changes for that project. No whole-app automatic migration claim.

## Validation and failures

Node 22 frozen-lockfile, ignore-scripts, offline clean install from a Git archive: build/typecheck/lint and **197/197 tests passed**, preserving all 186 existing tests. Eleven new graph tests cover chains/provenance, modes/shared aliases, scope/layers, duplicate declarations, cycles, missing references, fallback/calc, unsupported Tailwind, semantic confidence, role collisions and explicit old answers. Existing tests preserve invalid color/contrast, bad answers and overwrite refusal. Main after merge passed 186 tests. GitHub CI is supplementary, not required.

Raw shadcn reports and Fieldwork outputs are deterministic. Third preview/write/rerun hashes match. The Theme generators and independent parser tests are unchanged.

Chrome at native 1470px: new outputs replayed through the existing explicit shadcn color adapter, Dashboard light/dark and Tasks filter/navigation passed. Third project's generated-theme Vite **bundle preview** passed Dashboard/Data Tables light/dark, navigation, Engineering+Alice filter = one result. The third upstream full build still fails TS6 `baseUrl` deprecation; both original and integrated **dev mode** fail with React `Cannot add property current, object is not extensible`. Direct Vite bundling passes; no upstream refactor hides these failures. Desktop partial integration is not mobile/full accessibility acceptance.

## Contract and decision boundary

See [graph.ts](./graph.ts) and [README](./README.md#canonical-token-graph-schemaversion-1). There is no full cascade/import evaluation, expression calculation, dynamic JS discovery or DTCG input graph adapter. Theme DTCG output/round-trip subset is retained. Graph edges preserve source relationships; generated Theme namespace does not automatically reproduce every original alias export.

**Bounded technical recommendation: CONDITIONAL GO for review. M3 user onboarding: NO-GO, remains OPEN.** Next smallest proposal: present unresolved source groups with affected outputs and an explicit whole-scope versus selected-scope review, preserving exclusions and manual semantics. No new slice has started. M4/M5/M6 and global public/npm/security/licensing gates remain separate.

## Reproduction and evidence

From a clean monorepo checkout: `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm check`, then `pnpm --silent foundation <pinned-source-copy>`. First dry-run must remain exit 1 for the two external whole-project inputs. `--prepare-answers`, `--answers`, `--decisions` and safe `--write` are unchanged.

Detailed local evidence under `outputs/oss-005d/`: `verification.json`, `main-check.log`, `graph-check.log`, `clean-checkout.json`, `clean-install.log`, `clean-check.log`, `fieldwork-regression.json`, `shadcn-classification.json` (all 81 decisions), `third-acceptance.json`, `third-independent-audit.json`, `third-manual-integration.patch`, `shadcn-browser.json`, `third-browser.json`, and screenshots. Engineering Master holds the canonical roadmap/gates; this file is evidence only.
