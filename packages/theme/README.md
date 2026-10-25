# @spexop/theme — Design Foundation (private prerelease)

This is the first selectively recovered Spexop OSS foundation slice. It is **not published to npm**. The historical npm `0.6.0` package is not this build. The repository remains private pending the security and rights gates.

## Use the locally built package

Node.js 22.13 or newer, ESM and TypeScript are supported. From the workspace run `pnpm install --frozen-lockfile`, `pnpm check`, then `pnpm pack --pack-destination /absolute/output/path` from `packages/theme`. Install that tarball in a separate consumer; do not substitute the registry package. See `examples/react-consumer` for the reproducible React/TypeScript consumer check.

```ts
import { createTheme, defaultTheme, generateCSS, generateDTCG,
  generateTailwind, auditThemeAccessibility } from '@spexop/theme';

const theme = createTheme(defaultTheme);
const css = generateCSS(theme);
const tokens = generateDTCG(theme);
const tailwind = generateTailwind(theme);
const audit = auditThemeAccessibility(theme);
// Inspect audit.passed, issues and summary.notEvaluated before accepting a theme.
```

`createTheme` validates and clones the input; it does not silently repair colors, references or contrast. The historical default is a readable example, **not an accessibility-approved theme**. `resolveToken` and `resolveTheme` resolve legacy `colors.text` and `{colors.text}` aliases; missing, circular, unsafe and object references fail explicitly. The numeric fields in the legacy TypeScript model remain numeric; JSON inputs can use scalar aliases where the validator resolves them, such as named spacing values.

Optional component color fields are validated after alias/mode resolution. Border widths accept nonnegative pixel numbers, bare numeric strings, literal CSS length units, or `thin`/`medium`/`thick`; expressions such as `calc()` and `var()` are outside this bounded validator. Optional radii, breakpoints and durations must be nonnegative; opacity is in [0,1] and z-index is an integer. This is not a general CSS grammar validator for every legacy string field.

## Output and supported scope

- HEX, RGB, HSL and OKLCH are parsed through Color.js. Source color strings are preserved in CSS. Legacy `-rgb` companion properties are clipped to sRGB explicitly; they are fallback coordinates, not contrast evidence. No color fallback to black occurs.
- `generateCSS` emits custom properties and enabled light/dark modes. `generateTailwind` emits Tailwind v4 CSS-first theme bindings, including custom spacing and typography. Append/import it into a Tailwind v4 input; it is not a Tailwind v3 JavaScript configuration. Named custom spacing overrides the base spacing multiplier.
- `generateDTCG` / `generateW3C` emit a DTCG 2025.10 **Format/Color subset**, with independent `light` and `dark` groups. Alias paths are mode-qualified and retained when their targets are represented. Unexported alias targets fail rather than flatten silently. Core colors, dimensions, typography and numeric border tokens are emitted. Full source configuration is retained in the `com.spexop.theme` extension; legacy component configuration is not misrepresented as standardized DTCG component tokens.
- `readDTCG` validates and returns this emitted subset without flattening aliases. It does not implement the full DTCG Resolver module, remote `$ref`, every token type, or arbitrary third-party DTCG documents. Independent tests use `@terrazzo/parser` with its core validation enabled, including invalid-document controls.
- Accessibility checks cover declared text/secondary/muted/optional-link on surface, in both enabled modes. Critical failures are errors. Alpha/composited and out-of-sRGB contrast are **not evaluated** and cannot yield a passing audit. Runtime layout, focus, keyboard, semantics and other component states require separate verification. This is not a WCAG conformance certificate.
- `fixContrast` proposes a bounded foreground change without changing the input theme. Its result must meet the unrounded requested contrast ratio; a constrained failed repair returns `success: false`.

Run `pnpm check` for typecheck, lint, positive/negative fixtures, actual Tailwind compilation and independent DTCG parsing. No CLI, MCP, React component library, icons, renderer or runtime verifier is included.

## Source and licensing

Selected MIT files come from `spexop-ui/spexop-packages` commit `7741e1667d00416347eb538c0c3d01a75f2eb1ee`; file hashes, collision decisions and adaptation reasons are in `provenance/theme-selection.json`. Existing notices are retained. Unlicensed Nx/PRO candidates, historical Git data, credentials and assets were excluded. See LICENSE and THIRD_PARTY_NOTICES.md. Global historical credential rotation and other source rights remain separate release gates.
