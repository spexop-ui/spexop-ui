# Slice 1 provenance and gate decision

The user authorized private Theme implementation and private repository/PR operations on 2026-10-25. This is a scoped continuation, not closure of the global public-release gates.

- Manifest v2: 231 Theme candidates, 135 destinations, 96 differing-content collisions. 106 package-repo candidates and 125 Nx candidates. Every destination has a retained/adapted or excluded decision in theme-selection.json. Fifteen package source files selected; 120 destinations excluded. No Nx/PRO content was imported.
- Selected bytes matched both the recorded SHA-256 and remote Git blob from `7741e1667d00416347eb538c0c3d01a75f2eb1ee`. The local package checkout has an older HEAD; it was not assumed identical. Only individually verified files were read/copied. Source files, old repositories and snapshots remain intact.
- GATE-S1: selected source and package scans found no configured credential patterns; no environment or history was imported. Historical credential revocation/rotation is still owner-blocked. No candidate credential was tested or changed. Pattern scans are not exhaustive proof of absence.
- GATE-L1: selected package files carry the existing MIT copyright; notices retained. No conflicting third-party ownership was identified in this selected source inspection. This is evidence for private work, not an independent legal ownership warranty. Nx/PRO sources remain excluded pending rights evidence.
- GATE-L2: no icon/font/photo assets selected. Runtime dependency is colorjs.io 0.7.1, MIT, with notice preserved. dependency-licenses.json inventories the installed development graph separately. MPL-2.0 lightningcss is a test-tool dependency, not bundled in the Theme tarball. Six dev packages have license declarations without standalone license files in their installed package; those tools are not redistributed in the tarball. Cross-platform optional binaries need their own inventory when distributed. No blanket approval is given to unrelated legacy assets.
- No old Git graph, npm tarball or generated legacy build was copied. This repository starts with a new root commit. No npm publishing workflow exists; package private flag remains enabled.

The original OSS-002 markdown report was not present at the requested path. Its existing evidence/lineage/gates JSON and the supplied owner handoff were used, with selected-file verification performed again. OSS-002B/C and Engineering Master ADR-001/002/008/009/010 and S1/L1/L2 records were read.

## PR review regression pass

The first 77-test result was insufficient for several legacy component paths. Fifteen independent PR findings were evaluated against new tests: the initial regression run failed 21 of 24 new scenarios (80/101 total passing). All reported behaviors were corrected, with additional negative controls for font parsing and normalized token names. The final suite contains 107 tests. See `packages/theme/test/review-regressions.test.ts` (R01–R15). This replaces the initial technical-closeout assumption; no review finding was dismissed merely because CI had passed.

## OSS-004 acceptance corrections

Independent acceptance at `70749833` reverified all 15 selected source hashes against remote Git blobs. Optional emitted values could bypass validation (invalid component colors, negative dimensions, malformed containers), and the subset DTCG reader accepted invalid metadata and an unnamed document-root token. The first added regression run failed 25/27 cases; the fixes and three additional width controls bring the suite to 137 tests. Only the selected validator and DTCG generator were adapted; no additional legacy source, asset, dependency or history was imported. The selection manifest retains original source hashes and updates the resulting file hashes. Technical acceptance does not close the global security/rights gates or authorize merge/public/npm release.
