# Design Foundation first-user acceptance fixture

SPX-OSS-005A (requested as OSS-005; that ID already denotes the independent UI verification pilot in Engineering Master). Private acceptance fixture, not a new Spexop product or publishable workspace package.

Fieldwork is a synthetic, realistic solo-developer project: Overview, Projects and Workspace settings; filtering, native form validation, session-only form state, navigation, light/dark and responsive layout. No backend, account, external asset or deployment is required.

## Run from the repository root

Tested with Node 22.23.3, npm 10.9.9, TypeScript 5.9.3, Vite 8.3.5, React 18.3.1 and Tailwind 4.3.3. This is a tested fixture combination, not an approved product support matrix.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @spexop/theme build
pnpm --filter @spexop/theme pack --pack-destination examples/design-foundation-journey/artifacts
cd examples/design-foundation-journey
npm ci --ignore-scripts
npm run build
npm run faults
npm run preview
```

Open the printed local preview URL. `npm run dev` is also available after installation. No npm registry release of this alpha is assumed. The tarball stays ignored; pack it before `npm ci`. The lockfile pins its integrity, so intentionally updating the Theme candidate requires reinstalling that exact tarball and reviewing the new lockfile.

## What the developer actually did

1. Read `src/legacy.css` manually. It contains 30 CSS variable declarations across `:root` and `[data-theme="dark"]`. Theme does not discover a project, parse this stylesheet or infer token meaning.
2. Assign semantic names and modes in `theme/input.json`. `theme/manual-mapping.json` records 31 mapping decisions. Twenty-nine preserve semantic values; the deliberately low-contrast light muted color changes from `#94a3b8` to `#475569`, and card padding is intentionally aligned from 18px to the existing 16px scale. These are evaluator decisions, not inferred or owner-approved product defaults.
3. Supply missing model conventions explicitly: font scale, weights, line heights, border widths, aliases and enabled dark mode. Numeric pixels must be converted to numbers in the legacy TypeScript model.
4. Wire seven files: package manifest, Vite plugin configuration, theme input, generation helper, CSS import, component bindings and application CSS. Mapping and fault scripts are additional research evidence, not necessary product setup files. The generator helper is handwritten fixture glue, not a supplied Spexop CLI.
5. Run `createTheme` **and** `auditThemeAccessibility`. CSS generation alone is not a contrast acceptance gate. The helper exits nonzero on either validation failure or an unsuccessful/incomplete audit, before writing output.
6. Import generated Tailwind CSS and use semantic classes/variables in the existing React app. Responsive layout, form behavior and theme switching remain application code.

The Tailwind Vite plugin scans class names; that is Tailwind functionality, not Spexop project discovery. See the [official Tailwind Vite setup](https://tailwindcss.com/docs/installation/using-vite).

## Fault experiment

`npm run faults` injects independent variants without changing the valid input and writes raw API responses to `artifacts/fault-results.json`.

| Fault | Theme result |
|---|---|
| Missing alias | Validation/generation error names missing target; no source file/line |
| Circular alias | Error includes reference chain; no source file/line |
| Insufficient text contrast | Audit error gives mode/token pair and ratio; generation alone accepts it |
| Invalid color | Error includes mode/token and underlying parser message |
| Missing dark mode | General validation/audit accept light-only config; explicit dark resolution throws |
| Empty dark override palette | Inherits light colors; cannot know the developer intended a distinct dark palette |
| Hardcoded TSX style | Not inspected; audit passes despite the intentional inline badge |

`injectedAt` and `evaluatorFix` in the report are manual evaluator annotations. They must not be presented as diagnostics produced by Theme. The `runtime` warning reports limited coverage; it is not a successful runtime test. The styled badge in Overview intentionally retains padding 13px and a hardcoded purple to make this coverage gap inspectable.

## Outputs and repeatability

- `artifacts/theme.css`: generated vanilla custom properties.
- `src/generated.css`: Tailwind import plus Spexop v4 theme bindings.
- `artifacts/theme.tokens.json`: supported DTCG subset.
- `artifacts/generation.json`: audit, output hashes and generator execution time. This time excludes manual mapping and is not a novice completion-time measurement.

Copy only this fixture's source/lockfile and the verified tarball into an empty directory; repeat `npm ci --ignore-scripts`, `npm run build`, `npm run faults`. Compare the three generated output SHA-256 values. Browser checks belong to the acceptance report, not to the Theme audit.

This expert-assisted experiment proves that a manually mapped theme can drive an app. It does not establish that an unfamiliar solo developer can complete the journey without documentation. Engineering Master retains M3 as incomplete; no new scanner, production CLI/MCP or component package was implemented.
