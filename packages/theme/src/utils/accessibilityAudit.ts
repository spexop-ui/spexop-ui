import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
import { validateTheme } from "../validators/validateTheme.js";
import { resolveTheme } from "./tokenResolver.js";
import { calculateContrastRatio } from "./contrastChecker.js";
export interface AccessibilityIssue {
  severity: "error" | "warning";
  field: string;
  message: string;
}
export interface AccessibilityAuditResult {
  passed: boolean;
  level: "AA" | "AAA";
  issues: AccessibilityIssue[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    notEvaluated: number;
  };
  coverage: string[];
}
export function auditThemeAccessibility(
  theme: SpexopThemeConfig,
  level: "AA" | "AAA" = "AA",
): AccessibilityAuditResult {
  if (!["AA", "AAA"].includes(level)) throw new Error("Unknown WCAG level");
  const issues: AccessibilityIssue[] = [];
  const summary = {
    totalChecks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    notEvaluated: 0,
  };
  const validation = validateTheme(theme);
  if (!validation.valid)
    return {
      passed: false,
      level,
      issues: validation.errors,
      summary: { ...summary, notEvaluated: 1 },
      coverage: [],
    };
  for (const mode of [
    "light",
    ...(theme.darkMode?.enabled ? ["dark"] : []),
  ] as ("light" | "dark")[]) {
    const colors = resolveTheme(theme, mode).colors;
    for (const key of ["text", "textSecondary", "textMuted", "link"] as const) {
      if (colors[key] === undefined) continue;
      summary.totalChecks++;
      try {
        const ratio = calculateContrastRatio(colors[key]!, colors.surface);
        if (ratio < (level === "AAA" ? 7 : 4.5)) {
          summary.failed++;
          issues.push({
            severity: "error",
            field: `${mode}.colors.${key}/surface`,
            message: `Insufficient text contrast: ${ratio.toFixed(3)}:1`,
          });
        } else summary.passed++;
      } catch (e) {
        summary.notEvaluated++;
        issues.push({
          severity: "error",
          field: `${mode}.colors.${key}/surface`,
          message: `Not evaluated: ${String(e)}`,
        });
      }
    }
  }
  // A theme cannot establish keyboard, DOM semantics, actual font size, or every composited surface.
  summary.warnings++;
  issues.push({
    severity: "warning",
    field: "runtime",
    message:
      "Only declared text/surface pairs checked; actual UI states, compositing, focus and semantics require runtime verification.",
  });
  return {
    passed: summary.failed === 0 && summary.notEvaluated === 0,
    level,
    issues,
    summary,
    coverage: [
      "Declared text, secondary, muted and optional link on surface; light and enabled dark mode",
    ],
  };
}
