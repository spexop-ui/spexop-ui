# Review and integrate canonical CSS

This is a private workspace developer tool, not a published npm command. It reads
CSS custom properties, explains which declarations can be exported and previews
CSS without asking you to map names to a fixed Theme schema.

**Keep your original stylesheets.** Output contains only a supported token subset.
It does not replace ordinary rules, fonts, Tailwind utilities or excluded tokens.
Adding it can still change the cascade. Spexop has not analyzed active imports,
component usage or the full application, even when the report says `ready`.

## First run

From the Spexop monorepo (Node 22.13+ and the pinned pnpm):

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm foundation:review /absolute/path/to/react-project
```

No project code is executed by review and no file is written. The concise report
shows discovered/exportable/excluded counts, exclusion reasons, output selectors,
source files to keep, reference counts, risks and integration steps. Unknown values
remain visible. `blocked` means no usable output; `partial` means some declarations
are excluded; `ready` means only that all captured declarations fit the exporter.
None of these statuses is a whole-app safety certificate.

Use JSON for individual token names, raw values, selectors, references, file and
line/column. A reason-group count can overlap another group; excluded count counts
each declaration once.

```sh
pnpm --silent foundation:review /absolute/project --json
```

Select source CSS explicitly once you know which files the application uses.
Use paths relative to that project. This also avoids capturing generated output
on subsequent runs. `--css` can be repeated; selection is a user decision, not an
assertion that unselected/imported/external CSS is safe or unnecessary.

```sh
pnpm foundation:review /absolute/project --css src/index.css
pnpm --silent foundation:review /absolute/project --css src/index.css --preview
```

Preview prints CSS to stdout only. It fails closed on blocked or partial plans.
For a **reviewed partial experiment**, add `--allow-partial`. This permission does
not mean you can remove original CSS. Do not feed JSON back to render as a plan;
call the API to get a fresh in-process plan.

```sh
pnpm --silent foundation:review /absolute/project --css src/index.css --preview --allow-partial
pnpm foundation:review /absolute/project --css src/index.css --write spexop-preview --allow-partial
```

Explicit write re-captures current sources and creates **a new directory** in the
project containing `tokens.css` and `plan.json`. Existing directories/files are
refused, including links. Nothing is automatically imported or changed. If files
changed since review, review them again before integration. A write failure may
leave a new partial directory for diagnosis; it does not report success.

`--theme-literals` separately opts into ordinary/static Tailwind literal
materialization at `:root, :host`. It is a context transformation, not a Tailwind
exporter. Inline declarations, utility generation and pruning are not reproduced.
Do not enable it merely to improve coverage numbers.

## Manual integration experiment

1. Use a disposable branch/copy and record the original app's behavior. Inspect
   the CSS imports and the source files named in the report. Keep all of them,
   including excluded declarations and Tailwind processing.
2. Preview and write a new artifact as above. Inspect `plan.json` for the exact
   emitted selectors and declarations. Duplicate variable names may affect existing
   overrides. There is **no automatic or universally correct import position**.
3. Add one import of the generated `tokens.css` manually in your app's CSS/TSX
   entrypoint. Determine the relative path and position from that app, rather than
   copying a universal snippet. Do not delete source declarations or restructure
   components/configuration. Record the one import and chosen order.
4. Compare source-only and additive-output versions in the browser: light/dark,
   at least two screens, navigation and a form/filter. Inspect computed colors,
   border/radius, padding/gaps, fonts and relevant aliases on actual components.
   A snapshot alone or unchanged appearance alone is not sufficient proof.
5. If anything changes unexpectedly, remove the new import, retain the original
   app and report the difference. Do not repair upstream CSS to make Spexop pass.
   If values match, acceptance is limited to those styles and interactions in that
   app. An identical duplicate export is not evidence of a new visual feature.

The report cannot tell you which components consume a token; that requires manual
inspection. Missing/cyclic aliases, fallback/calc, complex selectors/layers,
unknown value types and unproven cross-file precedence remain excluded. Escaped
identifiers block export because their identity could overlap included names.
The tool does not solve full cascade, JavaScript themes or an import graph.

## Programmatic use

```ts
import { reviewFoundation, formatIntegrationReview } from './tools/foundation/dist/integration/index.js';
import { renderCanonicalCSS, writeCanonicalCSS } from './tools/foundation/dist/css-export/index.js';
const options = { projectRoot: '/absolute/project', cssFiles: ['src/index.css'] };
const { review, plan } = reviewFoundation(options);
console.log(formatIntegrationReview(review));
// Only after inspecting exclusions and agreeing to a partial experiment:
const preview = renderCanonicalCSS(plan, { allowPartial: true });
// Explicit write, not invoked by review or preview:
writeCanonicalCSS(options, { outputDirectory: 'spexop-preview', allowPartial: true });
```

`review` is JSON-serializable and deterministic for unchanged input. `exportable`
and `excluded` retain every plan entry, not merely a displayed sample.
`dependencies` retains every reference-bearing entry and its disposition;
`preserveSources` is the inspected CSS inventory, not the full import graph.
The generated CSS bytes are unchanged from the canonical exporter.

Exit codes: `0` completed review/operation within scope (partial review may return
0), `2` blocked or unaccepted partial output, `1` invalid arguments or IO failure.
Always read status and exclusions. Existing `pnpm foundation`, `--answers`,
`--prepare-answers` and legacy `--write` remain separate and unchanged.

### Native context inspection

`pnpm foundation:review /project --css tokens.css --native-context --preview`
opts into native CSS structure preservation. This is mutually exclusive with
`--theme-literals`. Multi-file native order is available through the programmatic
`sourceOrder` option only; the command does not guess application import order.
Native review explains original-slot/layer requirements and deliberately does not
offer an additive import as an equivalent transformation. Compiler/import blockers
cannot be overridden by `--allow-partial`. No source file is rewritten.
