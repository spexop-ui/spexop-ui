# Design Foundation discovery & onboarding — bounded development tool

SPX-OSS-005D. A local, single-purpose module over the existing Theme API. Not a new npm package, general CLI framework, project refactorer or trusted UI verifier. Theme source is unchanged.

## Quickstart

Use Node 22.13+ and the repository's pinned pnpm. From the private monorepo:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm --silent foundation /path/to/react-project > /tmp/foundation-review.json
```

The first command against an unreviewed project normally exits **1**: missing decisions and contrast problems block generation. It writes no project files. The JSON report contains `scope`, exact `found` values/locations, inferred `mappings`, `proposed` values, `manual_decisions`, diagnostics, and the three `plannedOutputPaths`. It does not read a previous Theme input JSON or rewrite application code.

Review `found` and `mappings` first. Missing scalar fields use three visible classes:

- **A — safe documented default:** numeric CSS normal/bold weight. Applied only when absent; shown with origin/reason and editable via `value:<token>`.
- **B — editable proposal:** starter border/type rhythm values, never claimed as discovered. Applied in the preview without a mandatory question; all are visible in `proposed` and `answerTemplate.optionalProposals`. Add the listed `editableVia` key with a `{ "value": ... }` answer to change it.
- **C — required user choice:** semantic colors, font/base size/type scale/spacing grid/corner identity, ambiguous mappings, conflicts, missing dark values and contrast repairs. These block generation until explicitly resolved. Source values are never replaced by A/B completion.

Create a ready-to-edit answer skeleton rather than constructing JSON by hand:

```sh
pnpm --silent foundation /path/to/react-project --prepare-answers foundation-answers.json > /tmp/foundation-review.json
# Edit /path/to/react-project/foundation-answers.json using its per-decision guidance.
pnpm --silent foundation /path/to/react-project --answers /path/to/react-project/foundation-answers.json > /tmp/foundation-preview.json
# Only after ok:true and reviewing outputs:
pnpm --silent foundation /path/to/react-project --answers /path/to/react-project/foundation-answers.json --write
```

`--prepare-answers` is an explicit write of a NEW in-project JSON file; existing files and symlink parents are refused. Empty `{}` answers deliberately remain invalid. It can be combined with existing answers to prepare a refreshed template at a different new filename; it cannot be combined with output `--write`. The default dry-run already includes `answerTemplate` in memory and writes nothing. Pending decisions have reason, source, suggested value and options when available. A missing suggestion must not be invented as a discovered value.

Answer shapes: proposal/override `{ "value": <scalar> }`; mapping `{ "target": "<supported Theme path>" }` or explicit `{ "ignore": true }`; conflict `{ "source": "<listed source id>" }`; inheritance `{ "inherit": true }` or `{ "value": "<dark color>" }`. New decisions can appear after mapping makes additional checks possible: rerun preview, inspect guidance, and update the answers. Overrides use `override:light.<token>` / `override:dark.colors.<name>` and always count as manual decisions.

`--decisions` remains a compatible alias for `--answers`; schemaVersion 1, inputHash and old reviewed answer files still work. A known scalar proposal superseded by a real source mapping produces `SUPERSEDED_PROPOSAL` info instead of forcing deletion of the stale default answer; the source wins, and an intentional change requires an override. Other unknown/stale/malformed answers are errors. An `ignore:true` choice counts and produces a warning. No accept-all facility or interactive framework is added.

`--write` re-analyzes current sources. It only creates a **new** `.spexop/foundation/` containing `theme.css`, `tailwind.css`, `theme.tokens.json`. Existing directories/files are refused, including empty output directories. No force flag. Sources, existing CSS and application imports remain untouched. Use a new test copy or explicitly manage previously generated outputs yourself before regenerating; the tool never removes them. Input hashes bind decisions to CSS contents, paths and expected modes.

Integrate **one** output: vanilla `theme.css`, or Tailwind `tailwind.css` (already includes `@import "tailwindcss"`). Update the application import yourself and retain its existing Tailwind v4/Vite setup. Theme switching remains app code using the generated Theme CSS conventions. DTCG is the existing Theme 2025.10 subset, not full standard coverage.

## Scope and confidence

- Inventory: `.css` files under the selected directory; excludes dot directories, node_modules, dist, build, coverage, artifacts and `.spexop`. Symlinks are not followed. Max 200 CSS files / 1 MiB per file. `--css src/tokens.css` can be repeated to select a smaller scope.
- Only **top-level** `:root`, `.dark`, `html.dark`, `:root.dark`, `[data-theme="dark"]`, `html[data-theme="dark"]`, `:root[data-theme="dark"]`; the attribute forms also support single quotes. Whitespace around a whole selector is accepted. Selector lists, nesting, `@layer`, media queries, `!important`, other attribute syntaxes and specificity/cascade inference are unsupported.
- Top-level Tailwind v4 `@theme`, `@theme inline`, `@theme static` declarations are inventoried. Color namespace `--color-*`, `--spacing-N`, `--spacing`, `--font-sans`, `--text-base` have bounded rules. Wildcard resets, arbitrary theme/config/plugin variants and imported framework defaults are not interpreted.
- Literal HEX/RGB/HSL/OKLCH values are preserved in the Theme configuration; Theme validation decides validity. DTCG serialization uses its typed color representation. Numeric Theme values accept px or unitless numbers; rem, em, %, calc/env/color-mix/light-dark and fallback/compound vars are unsupported rather than guessed.
- Simple `var(--name)` color aliases between mapped color tokens are retained as Theme aliases. Missing/cyclic/ambiguous CSS references have original locations. Numeric alias support is limited by the current Theme scalar validators; no broader support is claimed.
- A found value is a parsed declaration, **not proof that it is imported/active in the app**. JS/TSX, CSS-in-JS, dynamic themes and hardcoded styles are not scanned. CSS imports are reported and not followed; the report is limited to its enumerated source files.

Name rules are **semantic conventions**, not facts proven by CSS: `brand/primary → colors.primary`, `background/surface → colors.surface`, `foreground/ink/text → colors.text`, `surface-soft → surfaceSecondary`, `ink-muted → textMuted`, `line/border → border`, plus explicit secondary/strong/subtle forms. They are tested on Fieldwork, not asserted universally. `--muted` and generic `--radius` are ambiguous. Equal values in multiple tokens are not deduplicated; multiple declarations competing for one semantic target require a decision even when values match.

Dark palette omissions never silently pass as complete: approve each inheritance or supply a value. Shared spacing/typography remain shared; dark non-color declarations are unsupported in this slice. Default expected modes are light+dark; `--light-only` is explicit and reports excluded dark values.

## Diagnostics and acceptance boundary

`error` blocks valid outputs; `warning` records non-blocking design issues; `info` is reserved for informational results; `unsupported` states an unimplemented check. Unsupported token structures block this tool. Import resolution, skipped symlinks and runtime verification are explicit **non-blocking coverage limits**, not successful checks. Inspect them before accepting the design foundation.

One operation performs raw CSS alias checks, Theme validation, expected mode decisions, contrast audit and all three generators. Contrast failure is an error with a manual correction decision. No colors are automatically repaired. Cross-mode aliases whose semantic slot refers to a different CSS variable are blocked. Inheriting a light alias into dark is unsupported; supply an explicit dark value or an intentional dark alias. Dark non-color overrides are rejected, not silently discarded. Diagnostics carry code, explanation, token, source location when known and a next action. A missing proposed value has no invented CSS location. Declared contrast pairs do not prove actual UI contrast, focus, states, semantics or full WCAG compliance.

## Historical Fieldwork replay (005B baseline retained)

Use a clean copy of `examples/design-foundation-journey` from this branch (exclude ignored old `src/generated.css`, node_modules, dist and artifacts). Its committed `foundation-decisions.json` reviews the original `src/app.css` + `src/legacy.css` scope. The source hash must match. On a dirty/previously generated copy, inspect the scope or select CSS explicitly and produce fresh reviewed answers.

The example preserves `space-card:18px` as named spacing and explicitly maps radius to `radiusSubtle`; a separate proposed `radiusRelaxed:8` is approved. It corrects muted light text to `#475569`. These are fixture evaluator choices, not owner-approved universal defaults. The original 005A baseline remains 31 manual mappings / 29 preserved / 2 corrected. The initial report asks 19 questions; choosing a radius mapping supersedes one default proposal. Browser review then exposed missing link colors, requiring two additional explicit light/dark link-alias choices. Final result: 28 automatic mappings, 2 user mappings and **20 final decisions** (2 mappings + 15 proposed scalar values + 1 contrast correction + 2 link-alias choices). Do not call all 20 “mapping decisions” or equate this to a novice usability study.

The prior React/Tailwind wiring is already present. Two onboarding files were changed/added manually: a decisions file and the CSS import in `src/main.tsx`. A separate existing fixture defect in `src/App.tsx` was repaired so the skip link focuses main without changing the current route (three source/config files in total). Three output files were generated. The tool itself changes zero existing source files. First technically valid preview: initial dry-run → edit answers → approved dry-run. Explicit write is separate. The actual experiment needed a second answer revision for link aliases and another preview/write cycle before browser acceptance; do not count the first technical preview as complete UI acceptance. Installation/build and application integration are additional steps, documented in the acceptance report.

## Programmatic API and checks

After `pnpm build`, import `analyzeProject` or explicit `writeFoundation` from `tools/foundation/dist/index.js`. Both take a project directory and `Options`; neither needs a browser, service or private backend. Root `pnpm check` builds Theme + tool, typechecks implementation/tests, lints and runs Theme regressions + onboarding tests. Existing private PR CI uses the same check. Independent output tests use the already installed PostCSS and Terrazzo parser; no new external dependency was added.

Sources: [PostCSS parsing/source positions](https://postcss.org/api/), [Tailwind theme variables](https://tailwindcss.com/docs/theme). This is an M3 development slice; M4 hardcoded-style detection and M8 public/npm release remain separate.

## Canonical Token Graph (schemaVersion 1)

The report now includes `graph` and `aliasDecisionReduction`. `graph.nodes` retains **every** inventoried declaration, even unsupported ones. A node is a literal source, a single `var(--name)` alias, or a derived expression. Its context records selector, light/dark/shared mode, Tailwind origin, ancestor scopes and support status. Provenance is the original file, line and column. A declaration ID never stands for multiple selectors.

`graph.resolutions` records per-mode direct target IDs, resolution status and terminal `canonicalSourceId` when known. Follow direct edges to reconstruct the complete reference chain. Tailwind exports are resolved for light and dark separately; dark lookup can fall back to a light declaration, but this is **conditional model resolution, not proof of CSS computed-value inheritance or active imports**. Multiple applicable declarations remain ambiguous. Missing targets, cycles, fallback expressions, calculations and unsupported scopes never become invented literal values. Derived expressions retain references for inspection but are not evaluated.

`candidates` are explicitly `proposed` with `name-rule` evidence. They are not verified UI semantics. Source roles without a convention still require a mapping decision. `graph.uncertainties` distinguishes reference failure, unsupported evaluation and unknown semantic role; a source/graph repair is not disguised as a scalar answer. The existing `manual_decisions` remains the authoritative list of answers needed by the Theme projection; its unresolved entries block outputs. Generation still uses the original Theme validators and generators.

Resolved aliases without a competing known role are grouped with their canonical source instead of creating another independent scalar decision. Known aliases proposing the same role as their root no longer cause artificial mapping conflicts. A different known role, duplicate real declarations, unresolved reference or explicit existing answer stays subject to the existing checks. `aliasDecisionReduction` lists every grouped alias and its source IDs. Grouping does **not** claim that an unknown alias has a verified semantic role, that original CSS exports will be regenerated, or that source tokens may be deleted. The graph retains those relationships for inspection; Foundation outputs remain the Theme model's namespace. Existing explicit alias answers remain supported.

There is no project-name detection, graph database, new package or alternate output generator. DTCG **input** is not yet a graph adapter; the existing Theme DTCG output/round-trip subset is unchanged. Full cascade, layer ordering, import graphs and runtime styles remain outside this slice. The raw `found` inventory and historical decision counts remain available for comparison; a reduced duplicate count is not user acceptance.

## Defaults policy evidence

The 15 scalar answers in the 005B baseline classify as **2 A / 11 B / 2 C**. A: regular=400 and bold=700 ([CSS weight definitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-weight)). C: typography scale and relaxed radius. B: medium/semibold, four line-heights, three border widths, pill radius and border style. Full per-token value, classification and rationale live in `defaults.ts`; none has a fabricated source location. Existing values always win. Font family/base size, spacing unit and subtle radius are also C when absent; they were sourced/mapped rather than among those 15 approvals. There is no automatic link alias or contrast correction.
