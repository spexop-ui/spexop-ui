// Controlled fault injection; labels/expected fixes below are the evaluator's
// knowledge. They are NOT diagnostic capabilities supplied by Theme.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  createTheme,
  validateTheme,
  generateCSS,
  auditThemeAccessibility,
  resolveTheme,
} from "@spexop/theme";
const baseline = JSON.parse(fs.readFileSync("theme/input.json", "utf8"));
assert.equal(auditThemeAccessibility(baseline).passed, true);
const scenarios = [
  [
    "missing-alias",
    (x) => (x.colors.primary = "{colors.brandMissing}"),
    "colors.primary",
    "Point to a defined color or define colors.brandMissing",
    true,
  ],
  [
    "circular-alias",
    (x) => {
      x.colors.text = "{colors.textSecondary}";
      x.colors.textSecondary = "{colors.text}";
    },
    "colors.text / colors.textSecondary",
    "Break the reference cycle with an actual color",
    true,
  ],
  [
    "low-contrast",
    (x) => (x.colors.textMuted = "#94a3b8"),
    "colors.textMuted / surface",
    "Choose a text color with at least 4.5:1 against surface",
    true,
  ],
  [
    "invalid-color",
    (x) => (x.colors.primary = "rgb(broken)"),
    "colors.primary",
    "Use a parseable HEX/RGB/HSL/OKLCH color",
    true,
  ],
  [
    "missing-dark-mode",
    (x) => {
      delete x.darkMode;
    },
    "darkMode",
    "Define and enable the intended dark palette",
    false,
  ],
  [
    "incomplete-dark-palette",
    (x) => {
      x.darkMode.colors = {};
    },
    "darkMode.colors",
    "Review inherited colors against intended dark design",
    false,
  ],
  [
    "hardcoded-style",
    () => {},
    "src/App.tsx intentional inline badge",
    "Use semantic token bindings; requires source inspection outside Theme",
    false,
  ],
];
const results = scenarios.map(
  ([id, mutate, injectedAt, evaluatorFix, expectedDetected]) => {
    const input = structuredClone(baseline);
    mutate(input);
    const validation = validateTheme(input),
      audit = auditThemeAccessibility(input);
    let generationError = null,
      darkRequestError = null;
    try {
      generateCSS(createTheme(input));
    } catch (error) {
      generationError = String(error);
    }
    try {
      resolveTheme(input, "dark");
    } catch (error) {
      darkRequestError = String(error);
    }
    const themeDetected = !validation.valid || !audit.passed;
    assert.equal(themeDetected, expectedDetected, id);
    return {
      id,
      injectedAt,
      themeDetected,
      validation,
      audit,
      generationError,
      darkRequestError,
      sourceFileLocationProvidedByTheme: false,
      evaluatorFix,
      attribution:
        "injectedAt/evaluatorFix are manual test annotations, not Theme output",
    };
  },
);
// The same unbound token creates different effects; the theme model has no source-project view.
const legacy = fs.readFileSync("src/legacy.css", "utf8");
assert.ok(legacy.includes("--space-card: 18px"));
assert.ok(fs.readFileSync("src/App.tsx", "utf8").includes("padding: 13"));
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/fault-results.json",
  JSON.stringify(
    {
      expectedScenarios: 7,
      detected: results.filter((r) => r.themeDetected).length,
      results,
    },
    null,
    2,
  ),
);
console.log(
  results.map((r) => ({
    id: r.id,
    detected: r.themeDetected,
    generationError: r.generationError,
    darkRequestError: r.darkRequestError,
  })),
);
