# Canonical CSS Export (005H)

Read-only plan and preview over the Canonical Design Model. No Theme-role projection,
semantic guesses, token renaming, Tailwind utility generator or DTCG exporter.

```ts
import { captureDesignFoundation } from '../capture/index.js';
import { planCanonicalCSS, renderCanonicalCSS, writeCanonicalCSS } from './index.js';
const capture = captureDesignFoundation({ projectRoot: '/project', cssFiles: ['src/tokens.css'] });
const plan = planCanonicalCSS(capture); // no IO; all included/excluded tokens retained
// Defaults fail closed if anything is excluded or source capture failed.
const preview = renderCanonicalCSS(plan);
// Explicit action only, re-captures current sources and reserves a NEW directory:
writeCanonicalCSS({ projectRoot: '/project', cssFiles: ['src/tokens.css'] }, { outputDirectory: 'new-css' });
```

`plan.status`: `ready` means all captured declarations fit this bounded export scope;
`partial` means eligible rules exist but excluded declarations remain; `blocked` means
source errors or no eligible rules. `ready` does not certify full application behavior.
`renderCanonicalCSS(plan, {allowPartial:true})` explicitly previews a labeled partial
artifact. The writer accepts the same flag. Never replace a whole source stylesheet
with partial output: retain excluded declarations, imports and ordinary rules separately.

## Contract and guarantees

- `schemaVersion`, `namespace`, `entries`, `rules`, `blockers`, `coverage`, `limits`.
- Each entry carries token identity, exact source name/raw value, references, context,
  file/hash/line/column provenance, disposition, output selector and exclusion reasons.
- `exact-preservation`: included declaration name/value/reference and supported selector
  are preserved. Whitespace/comments and entire original stylesheet are not reproduced.
- `safe-transformation`: only explicit `themeLiterals:'materialize'` top-level `@theme`
  or `@theme static` **literal** variables become unlayered `:root, :host` declarations.
  Actual Tailwind 4.3.3 compiler tests prove this declaration placement. This does not
  reproduce usage-based pruning, utilities, arbitrary layer order or full Tailwind behavior.
  `@theme inline` is excluded, even for literals: its variables need not be emitted.
- `unsupported`: source record stays visible; no blind raw-expression copying.
- Literal colors/dimensions/numbers/percentage/duration/bezier with consistent capture
  evidence; simple ASCII `var(--name)` aliases and multi-step chains; root and documented
  dark selectors supported by capture. Values and alias chains are **not flattened**.
- Same-name unproven scope collisions/cross-file precedence, unsupported overrides,
  missing/cyclic aliases, incomplete/inconsistent graph proof and excluded dependencies
  block the affected family/chain. No implicit namespace-prefix or rename policy.
- Unknown types, fallback/calc, CSS-wide values, `@property`, nested/layer/media/complex
  selector contexts stay excluded. Names alone never establish types or semantics.
- Full CSS imports/cascade, registered-property inheritance, component placement and
  actual computed styles outside the separately tested fixture are not certified.
- Plans are immutable in-process values. JSON is the audit format, not an executable
  plan interchange format; render requires an original `planCanonicalCSS` result.
- Model provenance is evidence supplied by the caller; consistency checks do not provide
  cryptographic authenticity of a caller-authored model against an external source file.

## Safe IO

Preview never writes. `writeCanonicalCSS` re-captures sources, validates before IO and
creates only a NEW relative directory with `tokens.css` and `plan.json` (source-to-output
manifest). Existing files/directories/symlinks/hardlinks are never reused. Parents must
already exist and be real directories; traversal and absolute paths are rejected.
Capture's read-only, bounded, no-evaluation safeguards apply. Stable local filesystem
is required; not a sandbox against a hostile process swapping directories concurrently.
A filesystem failure after reservation throws and may leave the NEW partial output for
diagnosis; it is never reported successful or silently cleaned using uncertain paths.

## Existing generator assessment

`packages/theme/src/generators/css.ts:generateCSS` validates/resolves a SpexopThemeConfig,
expands fixed palette/spacing/typography/component roles, synthesizes `--theme-*` names,
RGB companions and dark/media blocks. Those transformations would lose canonical source
identity/aliases and are not used here. Its generic mechanism is declaration formatting
and joining blocks; sharing its role-bound helpers would introduce coupling for a few
lines. This module reuses the existing canonical parser, graph and type evidence, then
uses the existing PostCSS dependency for declaration validation and serialization
round-trip checks. No Theme generator code, legacy CLI option or package is changed.

## Validation and limits of acceptance

Four fixed projects retain the 005G capture baseline. A separate Lightning CSS parser
validates actual emitted syntax; source name/value/selector/provenance relations and
hashes are checked by `scripts/verify-canonical-css.mjs`.

Browser acceptance uses a COPY of the existing Fieldwork React app. Legacy token values
are consumed by explicit header/panel bindings in both variants; two synthetic alias
probes are separately labeled. Excluded font declarations and existing Theme/Tailwind
styles remain in both copies. This proves supported replacement behavior in that
integration, not untouched-app automation or successful first-user onboarding.
The first attempt to capture the existing generated Theme stylesheet excluded its
complex dark selectors/media and aliases; that limitation is preserved in evidence.

References:
- https://www.w3.org/TR/css-variables-1/ (alias computation/inheritance)
- https://tailwindcss.com/docs/theme (inline versus ordinary theme variables)

## 005I identity safety repair

Escaped property/at-rule/registration identities now block export when exclusion
closure cannot be proved (including escaped leading dashes that were not inventoried
as `--` declarations). Registration names are checked case-insensitively. This is a
conservative restriction, not an escape decoder or full cascade engine. Diagnostics
retain source locations. See [CSS identifier escaping](https://www.w3.org/TR/css-syntax-3/#escaping).
