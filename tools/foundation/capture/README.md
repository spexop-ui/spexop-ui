# Canonical Capture API — SPX-OSS-005G

Repository-local Node API, schema version `0.1`. It reads CSS design declarations without projecting them into `SpexopThemeConfig`. No package is published and no UI role is assigned from a token name. This module is deliberately a separate entrypoint from the legacy Foundation index, which imports Theme generators.

## Use

From the monorepo, install locked dependencies and build the capture entrypoint:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec tsc -p tools/foundation/tsconfig.capture.json
```

```ts
import { captureDesignFoundation } from './tools/foundation/dist/capture/index.js';

const result = captureDesignFoundation({
  projectRoot: '/path/to/react-project',
  namespace: 'my-project', // optional; default "project", independent of absolute path
  // cssFiles: ['src/theme.css'], // optional explicit relative scope
  // sourceCommit: '...', // optional full hash, CALLER assertion; Git is not executed
});
console.log(JSON.stringify(result, null, 2));
```

The function is synchronous and read-only. `CaptureOptions`, `CaptureResult` and canonical model types are exported from this entrypoint; declarations are built alongside JavaScript. Invalid API options throw `TypeError`; source/read/parse problems return structured diagnostics and `ok: false`. `ok` means capture has no error diagnostics and contains tokens, not that all types/references/exports are usable.

## Result contract

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `namespace` | Versioned source contract; identity is snapshot-local, not stable across file edits. |
| `sources` | Inspected, parse-error, excluded and rejected file/scope records; inspected bytes and SHA-256. Token-free CSS is included. |
| `tokens` | Declaration identity, original name and value, typed literal or preserved expression, type evidence, context ID, references, provenance, separate declared/proposed semantics. |
| `references` | Lexical reference records associated with source token IDs; fallback text is retained. |
| `resolutions` | Per evaluation scope, direct targets, terminal source when proven, status and reason. `resolved` proves bounded source resolution, not full CSS runtime semantics. |
| `contexts`, `evaluationScopes` | Selectors, ancestors/layers, source order, known light/dark and Tailwind context. Unsupported scope survives without invented brand/theme meaning. |
| `diagnostics` | Code, severity (`error`, `warning`, `info`, `unsupported`), explanation, token/location when known and suggested action. |
| `coverage` | Declaration/type/reference counts, status, zero mandatory Theme projection, and `outputGeneration: not-evaluated`. |
| `limits` | Explicit source/parser/context/type/runtime and filesystem boundaries. |

Color/number/dimension/percentage/duration/cubicBezier literals are recognized by supported syntax. `known` with `evidence: value-syntax` certifies the parsed value type only; it is not explicit author-declared token metadata or a UI semantic role. Alias types stay ambiguous in the source record; a resolved terminal can be inspected separately. Unknown font/shadow/composite text is retained, never guessed as color/string. Semantic proposals and declarations stay empty for CSS names. `card`, `popover`, `sidebar`, `chart` need no new schema field or mapping answer.

Direct and multistep aliases, missing targets and cycles remain traceable. Fallback and calc are `derived`; unsupported context, CSS-wide values, registered properties, ambiguous declarations and non-ASCII/escaped reference interpretation cannot acquire a fabricated canonical source. Root/dark and documented Tailwind normal/inline differences reuse the bounded graph. The model does not evaluate imports, full cascade/layer ordering, JS/TSX/config, composite values, DTCG input/Resolver or application computed styles.

## Source and filesystem safety

Each regular CSS file is opened read-only once into a bounded byte snapshot. Discovery, type inference and provenance use that same snapshot. No subprocess, project script, package installation, import fetching, source writing or exporter runs inside capture.

The selected root must be a real directory. Ancestor platform aliases (for example macOS `/tmp`) are canonicalized once. In-project symlink components and leaves are refused; auto-discovery reports skipped links. Hardlinks, FIFOs/devices, invalid UTF-8, oversized or observed-changing files are refused. Reads use `O_NOFOLLOW`, `O_NONBLOCK`, descriptor type/identity checks, bounded buffers and post-read identity/size/time checks. This is **not an adversarial filesystem sandbox against concurrent directory replacement by another process with the same access**; use a stable checkout. File hashes prove the captured bytes; `sourceCommit` is only caller asserted until an external acceptance harness compares Git provenance.

Limits: 200 CSS files, 1 MiB per file, 10,000 directory entries and 64 directory levels. Hidden/generated/dependency directories are excluded. Non-CSS files are not read or exhaustively listed; explicit `cssFiles` scopes are not expanded through imports. Source locations follow PostCSS's 1-based line/UTF-16-column convention; an initial BOM is treated as an encoding marker. Hashes include the original BOM bytes, while `rawDeclaration` uses the parser's exact exclusive-end source span.

## Relationship to 005F and legacy Foundation

Promoted source model/adapter from local prototype `663ca6dbbb00e90c07d8f2e45b374c18189d9674`. Prototype exporters were not promoted. The neutral color algorithm is reused from `packages/theme/src/utils/color.ts` at `5466b715`; it depends directly on the existing Color.js 0.7.1 dependency, now explicitly declared for workspace tooling. There is no internal Theme import, Theme build dependency, generator invocation or new npm package. Theme source and its MIT/third-party notices remain unchanged.

Shared `parse-css.ts` and `source-types.ts` isolate parsing/types from IO and Theme contracts. Legacy discovery still uses its prior scope/hash rules and passes parsed values to the same Theme projection. `pnpm foundation`, `--answers`, `--prepare-answers`, `--decisions` and `--write` remain unchanged. The old fixed Theme output-impact paths are compatibility projections, **not the canonical model contract**.

005F comparison has one intentional provenance correction: the prototype sliced PostCSS's end offset with `+1`, capturing the next character; BOM could also shift the slice. Capture uses `input.css.slice(start.offset, end.offset)`. The verification harness records every corrected `rawDeclaration`, verifies exact spans against source parsing and compares all other token/context/reference fields to the pinned baseline. Historical 005F evidence is retained.

## Acceptance and boundaries

Run `pnpm check` for Theme/Foundation/capture regressions. `scripts/verify-capture.mjs` accepts the existing four-project manifest, the 005F baseline directory and a NEW artifact directory. It checks 312 declarations, exact corrected source slices, types, contexts, provenance, references, determinism and unchanged file hashes. Source fixtures are local and never copied into this repo.

Pure capture does not generate a visual app; no browser acceptance is implied. 312/312 representation does not mean 312 exporter-ready tokens or known application semantics. M3 user acceptance stays open. A later separately approved Theme integration could add one generic CSS export planner with explicit coverage; no exporter migration is included here.
