# Build and load evidence (005K)

This read-only evidence layer consumes two independent Canonical Captures: authored
sources and compiled CSS. Capture both with `cssContext: true` and explicit files.
It never runs a project, reads a config, follows a map URL, or writes an output.
There is no new filesystem reader: Capture's bounded, link-refusing reader applies.

`inspectBuildContext({ source, compiled, compiler, maps?, observation?, manifest? })`
returns artifact hashes, positional source-map links, preserved compiled identities,
contexts/references, observed slots, diagnostics and limits. `planBuildCSS(...)`
additionally returns the existing native CSS export plan when the supplied snapshot
can establish a complete document stylesheet order. It never authorizes replacement.

## Certainty contract

- **Proven** is restricted to a mechanically checked fact (e.g. bytes hash to X).
- Source-map declaration-start links are **partial positional evidence**, even when
  exact generated/original positions and embedded source contents match. A map is
  not an authenticated build receipt. Missing, stale or unmatched maps remain unknown.
- Browser snapshots are **caller-supplied observations**, not independently trusted
  telemetry. Byte identity is checked against captured artifacts; URLs alone prove
  nothing. Slot order is retained, including repeated stylesheets. Future/dynamic
  order and closed shadow roots are not inferred from a document snapshot.
- Vite manifest imports/CSS relationships are compiler-declared metadata, not actual
  browser load order. Unsupported compilers do not silently become Vite.
- Source preservation, structural preservation and computed-style equivalence are
  different claims. Neither a map nor matching hashes establishes browser equivalence.
- Partial token CSS cannot replace a complete stylesheet. `placementSafety` and
  `behavioralEquivalence` remain `not-proven`, including a complete export plan.

## Supported boundary

Flat v3 source maps with exact declaration-start segments and embedded CSS sources;
no indexed maps, remote fetches, approximate GLB mapping, transformed-name guessing,
or file-basename inference. Map bindings are explicit source-map identifiers to
captured source paths, checked against full source bytes. These bindings are not
semantic token mappings. A changed value can retain positional provenance but is
never called a behavior-preserving transformation.

Document `link` sheets with empty/all media, enabled, non-alternate, no runtime
mutation, and complete supplied snapshot are the narrow export-order boundary.
Style/adopted/shadow/dynamic/conditional sheets are recorded but block order-based
export. CSS context support remains the existing exporter boundary. Full import,
cascade, media evaluation and runtime injection are not implemented.

References checked 2026-10-26: [Vite manifest](https://vite.dev/guide/backend-integration),
[ECMA-426](https://tc39.es/ecma426/), [CSSOM](https://www.w3.org/TR/cssom-1/).
No claim of complete conformance or all React projects being supported.
