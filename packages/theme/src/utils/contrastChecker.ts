/**
 * WCAG Contrast Checker
 * Calculate contrast ratios and validate WCAG 2.1 compliance
 */

import type { RGB } from "./colorManipulation.js";
import { contrastRgb as hexToRgb } from "./color.js";

/**
 * WCAG contrast levels
 */
export enum ContrastLevel {
  AAA = "AAA", // 7:1 for normal text, 4.5:1 for large text
  AA = "AA", // 4.5:1 for normal text, 3:1 for large text
  AA_LARGE = "AA_LARGE", // 3:1 for large text only
  ENHANCED = "ENHANCED", // 10:1 or higher for enhanced accessibility
  FAIL = "FAIL", // Below minimum standards
}

/**
 * Contrast check result
 */
export interface ContrastResult {
  ratio: number;
  AA: boolean;
  AAA: boolean;
  AALarge: boolean;
  AAALarge: boolean;
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula
 */
function calculateLuminance(rgb: RGB): number {
  const { r, g, b } = rgb;

  // Normalize RGB values
  const normalize = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const rLum = normalize(r);
  const gLum = normalize(g);
  const bLum = normalize(b);

  // Calculate luminance using WCAG formula
  return 0.2126 * rLum + 0.7152 * gLum + 0.0722 * bLum;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio from 1:1 (no contrast) to 21:1 (maximum contrast)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = calculateLuminance(rgb1);
  const lum2 = calculateLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 */
export function checkContrast(
  foreground: string,
  background: string,
): ContrastResult {
  const ratio = calculateContrastRatio(foreground, background);

  // WCAG 2.1 Level AA requirements
  const minNormalAA = 4.5;
  const minLargeAA = 3.0;

  // WCAG 2.1 Level AAA requirements
  const minNormalAAA = 7.0;
  const minLargeAAA = 4.5;

  // Determine pass/fail for each level
  const AA = ratio >= minNormalAA;
  const AAA = ratio >= minNormalAAA;
  const AALarge = ratio >= minLargeAA;
  const AAALarge = ratio >= minLargeAAA;

  return {
    ratio: Math.round(ratio * 100) / 100, // Round to 2 decimals
    AA,
    AAA,
    AALarge,
    AAALarge,
  };
}

/**
 * Get a description of the contrast ratio
 */
export function getContrastDescription(ratio: number): string {
  if (ratio >= 15) {
    return "Excellent contrast - exceptional accessibility";
  }
  if (ratio >= 7) {
    return "Good contrast - WCAG AAA compliant";
  }
  if (ratio >= 4.5) {
    return "Acceptable contrast - WCAG AA compliant";
  }
  if (ratio >= 3) {
    return "Poor contrast - only suitable for large text";
  }
  return "Fails WCAG standards - insufficient contrast";
}

/**
 * Get color representation for contrast level
 */
export function getContrastLevelColor(level: ContrastLevel): string {
  switch (level) {
    case ContrastLevel.AAA:
      return "#10b981"; // Green
    case ContrastLevel.AA:
      return "#3b82f6"; // Blue
    case ContrastLevel.AA_LARGE:
      return "#f59e0b"; // Amber
    case ContrastLevel.ENHANCED:
      return "#059669"; // Emerald
    case ContrastLevel.FAIL:
      return "#ef4444"; // Red
    default:
      return "#6b7280"; // Gray
  }
}

/**
 * Suggest a color adjustment to meet minimum contrast
 */
export function suggestContrastFix(
  foreground: string,
  background: string,
  targetRatio = 4.5,
): string | null {
  const currentRatio = calculateContrastRatio(foreground, background);

  if (currentRatio >= targetRatio) {
    return null;
  }

  // Calculate luminance
  const bgRgb = hexToRgb(background);
  const bgLum = calculateLuminance(bgRgb);

  // For dark backgrounds, suggest white text
  if (bgLum < 0.5) {
    return "Lighten the foreground color or use white for better contrast";
  }

  // For light backgrounds, suggest black text
  return "Darken the foreground color or use black for better contrast";
}

/**
 * Check multiple color combinations
 */
export interface ColorCombination {
  foreground: string;
  background: string;
}

export function checkMultipleContrasts(
  combinations: ColorCombination[],
): Array<{ combination: ColorCombination; result: ContrastResult }> {
  return combinations.map((combo) => ({
    combination: combo,
    result: checkContrast(combo.foreground, combo.background),
  }));
}

/**
 * Generate a contrast matrix for a color palette
 */
export function generateContrastMatrix(
  colors: string[],
): Record<string, Record<string, ContrastResult>> {
  // Use Object.create(null) to prevent prototype pollution attacks
  // This creates objects without Object.prototype, so __proto__ cannot be used
  const matrix = Object.create(null) as Record<
    string,
    Record<string, ContrastResult>
  >;

  for (const fgColor of colors) {
    // Create prototype-less inner objects as well
    matrix[fgColor] = Object.create(null) as Record<string, ContrastResult>;
    for (const bgColor of colors) {
      matrix[fgColor][bgColor] = checkContrast(fgColor, bgColor);
    }
  }

  return matrix;
}

/**
 * Find the best text color for a background
 */
export function getAccessibleTextColor(
  backgroundColor: string,
  darkText = "#000000",
  lightText = "#ffffff",
  minRatio = 4.5,
): string {
  const darkContrast = calculateContrastRatio(darkText, backgroundColor);
  const lightContrast = calculateContrastRatio(lightText, backgroundColor);

  // Return the one that meets minimum ratio, preferring higher contrast
  if (darkContrast >= minRatio) return darkText;
  if (lightContrast >= minRatio) return lightText;

  // If neither meets minimum, return the one with better contrast
  return lightContrast > darkContrast ? lightText : darkText;
}

/**
 * Check if a color meets minimum contrast requirements
 */
export function meetsMinimumContrast(
  foreground: string,
  background: string,
  level: ContrastLevel,
  isLargeText = false,
): boolean {
  const ratio = calculateContrastRatio(foreground, background);

  switch (level) {
    case ContrastLevel.AAA:
      return ratio >= (isLargeText ? 4.5 : 7.0);
    case ContrastLevel.AA:
      return ratio >= (isLargeText ? 3.0 : 4.5);
    case ContrastLevel.AA_LARGE:
      return ratio >= 3.0;
    case ContrastLevel.ENHANCED:
      return ratio >= 10.0;
    default:
      return false;
  }
}

/**
 * Batch contrast checking options
 */
export interface BatchContrastOptions {
  /** Minimum contrast ratio to consider passing */
  minRatio?: number;
  /** Check for large text requirements */
  isLargeText?: boolean;
  /** WCAG level to check against */
  level?: ContrastLevel;
  /** Parallel processing threshold */
  parallelThreshold?: number;
}

/**
 * Batch contrast check result
 */
export interface BatchContrastResult {
  /** Total combinations checked */
  total: number;
  /** Number of passing combinations */
  passing: number;
  /** Number of failing combinations */
  failing: number;
  /** Results for each combination */
  results: Array<{
    combination: ColorCombination;
    result: ContrastResult;
    passes: boolean;
  }>;
  /** Summary statistics */
  stats: {
    minRatio: number;
    maxRatio: number;
    avgRatio: number;
    aaCompliant: number;
    aaaCompliant: number;
  };
}

/**
 * Batch check multiple color combinations with optimization
 *
 * @param combinations - Array of color combinations to check
 * @param options - Batch checking options
 * @returns Batch contrast check results
 *
 * @example
 * ```typescript
 * const results = batchCheckContrast([
 *   { foreground: "#000000", background: "#ffffff" },
 *   { foreground: "#333333", background: "#ffffff" },
 * ], { minRatio: 4.5 });
 * ```
 */
export function batchCheckContrast(
  combinations: ColorCombination[],
  options: BatchContrastOptions = {},
): BatchContrastResult {
  const { minRatio, isLargeText = false, level = ContrastLevel.AA } = options;

  if (
    minRatio !== undefined &&
    (!Number.isFinite(minRatio) || minRatio < 1 || minRatio > 21)
  )
    throw new Error("minRatio must be between 1 and 21");
  if (!combinations.length)
    throw new Error("At least one contrast pair is required");
  const results: BatchContrastResult["results"] = [];
  const ratios: number[] = [];

  for (const combo of combinations) {
    const result = checkContrast(combo.foreground, combo.background);
    const passes =
      minRatio !== undefined
        ? calculateContrastRatio(combo.foreground, combo.background) >= minRatio
        : meetsMinimumContrast(
            combo.foreground,
            combo.background,
            level,
            isLargeText,
          );

    results.push({
      combination: combo,
      result,
      passes,
    });

    ratios.push(result.ratio);
  }

  const passing = results.filter((r) => r.passes).length;
  const failing = results.length - passing;
  const aaCompliant = results.filter((r) => r.result.AA).length;
  const aaaCompliant = results.filter((r) => r.result.AAA).length;

  return {
    total: combinations.length,
    passing,
    failing,
    results,
    stats: {
      minRatio: Math.min(...ratios),
      maxRatio: Math.max(...ratios),
      avgRatio: ratios.reduce((a, b) => a + b, 0) / ratios.length,
      aaCompliant,
      aaaCompliant,
    },
  };
}

/**
 * Optimize contrast for a theme by checking all color combinations
 *
 * @param colors - Theme colors object
 * @returns Optimization report with recommendations
 *
 * @example
 * ```typescript
 * const report = optimizeThemeContrast(theme.colors);
 * ```
 */
export function optimizeThemeContrast(colors: Record<string, string>): {
  compliant: Array<{ foreground: string; background: string; ratio: number }>;
  nonCompliant: Array<{
    foreground: string;
    background: string;
    ratio: number;
    suggestion: string;
  }>;
  recommendations: string[];
} {
  const colorArray = Object.values(colors);
  if (colorArray.length < 2) throw new Error("At least two colors required");
  const matrix = generateContrastMatrix(colorArray);

  const compliant: Array<{
    foreground: string;
    background: string;
    ratio: number;
  }> = [];
  const nonCompliant: Array<{
    foreground: string;
    background: string;
    ratio: number;
    suggestion: string;
  }> = [];
  const recommendations: string[] = [];

  // Check all combinations
  for (const fgColor of colorArray) {
    for (const bgColor of colorArray) {
      if (fgColor === bgColor) continue;

      const result = matrix[fgColor][bgColor];
      const isCompliant = result.AA;

      if (isCompliant) {
        compliant.push({
          foreground: fgColor,
          background: bgColor,
          ratio: result.ratio,
        });
      } else {
        const suggestion = suggestContrastFix(fgColor, bgColor);
        nonCompliant.push({
          foreground: fgColor,
          background: bgColor,
          ratio: result.ratio,
          suggestion: suggestion || "Adjust colors for better contrast",
        });
      }
    }
  }

  // Generate recommendations
  if (nonCompliant.length > 0) {
    recommendations.push(
      `Found ${nonCompliant.length} non-compliant color combinations`,
    );
    recommendations.push(
      "Consider adjusting colors to meet WCAG AA standards (4.5:1 for normal text)",
    );
  }

  if (nonCompliant.length > compliant.length) {
    recommendations.push(
      "More than half of color combinations fail contrast checks. Consider a theme redesign.",
    );
  }

  return {
    compliant,
    nonCompliant,
    recommendations,
  };
}

/**
 * Find accessible color combinations from a palette
 *
 * @param foregroundColors - Array of foreground colors
 * @param backgroundColors - Array of background colors
 * @param minRatio - Minimum contrast ratio (default: 4.5)
 * @returns Array of accessible color combinations
 *
 * @example
 * ```typescript
 * const accessible = findAccessibleCombinations(
 *   ["#000000", "#333333"],
 *   ["#ffffff", "#f0f0f0"],
 *   4.5
 * );
 * ```
 */
export function findAccessibleCombinations(
  foregroundColors: string[],
  backgroundColors: string[],
  minRatio = 4.5,
): Array<{
  foreground: string;
  background: string;
  ratio: number;
  level: ContrastLevel;
}> {
  const accessible: Array<{
    foreground: string;
    background: string;
    ratio: number;
    level: ContrastLevel;
  }> = [];

  for (const fg of foregroundColors) {
    for (const bg of backgroundColors) {
      const ratio = calculateContrastRatio(fg, bg);
      if (ratio >= minRatio) {
        let level: ContrastLevel;
        if (ratio >= 7) {
          level = ContrastLevel.AAA;
        } else if (ratio >= 4.5) {
          level = ContrastLevel.AA;
        } else if (ratio >= 3) {
          level = ContrastLevel.AA_LARGE;
        } else {
          level = ContrastLevel.FAIL;
        }

        accessible.push({
          foreground: fg,
          background: bg,
          ratio,
          level,
        });
      }
    }
  }

  return accessible;
}
