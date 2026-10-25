/** Explicit contrast proposal; never changes the input theme. */
import { parseColor, contrastRgb } from "./color.js";
import { calculateContrastRatio } from "./contrastChecker.js";
export interface ContrastFixOptions {
  maxAdjustment?: number;
  preserveHue?: boolean;
}
export interface FixResult {
  original: string;
  fixed: string;
  success: boolean;
  adjustment: number;
  finalRatio: number;
}
export function fixContrast(
  foreground: string,
  background: string,
  targetRatio = 4.5,
  options: ContrastFixOptions = {},
): FixResult {
  if (!Number.isFinite(targetRatio) || targetRatio < 1 || targetRatio > 21)
    throw new Error("Contrast target must be between 1 and 21");
  const max = options.maxAdjustment ?? 50;
  if (!Number.isFinite(max) || max < 0 || max > 100)
    throw new Error("Invalid maxAdjustment");
  contrastRgb(foreground);
  contrastRgb(background);
  const originalRatio = calculateContrastRatio(foreground, background);
  if (originalRatio >= targetRatio)
    return {
      original: foreground,
      fixed: foreground,
      success: true,
      adjustment: 0,
      finalRatio: originalRatio,
    };
  const original = parseColor(foreground).to("hsl");
  const originalL = original.coords[2] as number;
  let best: FixResult = {
    original: foreground,
    fixed: foreground,
    success: false,
    adjustment: 0,
    finalRatio: originalRatio,
  };
  for (let step = 1; step <= Math.floor(max * 10); step++)
    for (const direction of [-1, 1]) {
      const l = originalL + (direction * step) / 10;
      if (l < 0 || l > 100) continue;
      const candidate = original.clone();
      candidate.coords[2] = l;
      if (options.preserveHue === false) candidate.coords[1] = 0;
      const fixed = candidate.to("srgb").toString({ format: "hex" });
      const ratio = calculateContrastRatio(fixed, background);
      if (ratio >= targetRatio)
        return {
          original: foreground,
          fixed,
          success: true,
          adjustment: step / 10,
          finalRatio: ratio,
        };
      if (ratio > best.finalRatio)
        best = {
          original: foreground,
          fixed,
          success: false,
          adjustment: step / 10,
          finalRatio: ratio,
        };
    }
  return best;
}
