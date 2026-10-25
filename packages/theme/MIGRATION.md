# Migration and version plan

## No release has occurred

The historical npm latest is `0.6.0`. Its gitHead, manifest and tag lineage was inconsistent in OSS-002. This slice does not claim binary or API identity with that tarball. No npm dist-tag or deprecation message has changed.

`0.7.0-alpha.0` identifies this local/private candidate; `private: true` prevents accidental publication. Proposed path: review this slice, run OSS-004 platform/consumer validation, resolve public security/license gates, then obtain an explicit publication decision for a prerelease. A stable `0.7.0` requires an approved compatibility assessment. No date is promised. No existing version will be overwritten.

## Changes to review

- ESM-only entry point, Node >=22.13; CommonJS and historical deep imports are not supplied.
- `createTheme` and generators reject missing/cyclic aliases and invalid input. Fix invalid source data explicitly instead of relying on old silent defaults.
- RGB, HSL and OKLCH are accepted alongside HEX. Transparent/out-of-sRGB WCAG contrast is explicitly unavailable without a compositing/gamut policy.
- `generateTailwind` now emits Tailwind v4 CSS rather than a v3 JavaScript config.
- `generateW3C` is an alias of `generateDTCG`: structured 2025.10 color/dimension values, mode-qualified light/dark groups and preserved aliases. Update consumers expecting flat HEX `$value` strings. `readDTCG` supports only the documented emitted subset.
- Accessibility audit and contrast-fix APIs are deliberately scoped; inspect coverage and `notEvaluated`, do not rely solely on process exit status. The old full-theme automatic fixer and old reports are not compatibility exports.
- Legacy schema/default/CSS helpers were selectively retained. Icons, assets, premium modules, runtime verification, CLI and MCP are absent. No PRO tier exists in this new package.

Before adopting, pack this exact checkout, install the tarball in an isolated React/TypeScript project, compile and execute it, review generated CSS and audit findings, and record the commit plus tarball SHA-256. The example consumer demonstrates this procedure, not UI visual acceptance.
