/**
 * Fluid Typography Utilities
 * Generate responsive, fluid typography using CSS clamp()
 *
 * @module @spexop/theme/utils
 */

import type { FluidTypography } from "../types/SpexopThemeConfig.js";

/**
 * Generate CSS clamp() value for fluid typography
 *
 * @param minSize - Minimum font size in pixels
 * @param maxSize - Maximum font size in pixels
 * @param minViewport - Minimum viewport width in pixels (default: 320)
 * @param maxViewport - Maximum viewport width in pixels (default: 1280)
 * @returns CSS clamp() string
 *
 * @example
 * ```typescript
 * const fluidSize = generateFluidSize(16, 24, 320, 1280);
 * // Returns: "clamp(16px, calc(16px + (24 - 16) * ((100vw - 320px) / (1280 - 320))), 24px)"
 * ```
 */
export function generateFluidSize(
  minSize: number,
  maxSize: number,
  minViewport = 320,
  maxViewport = 1280,
): string {
  // Calculate the slope of the fluid sizing
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const yAxisIntersection = -minViewport * slope + minSize;

  return `clamp(${minSize}px, ${yAxisIntersection.toFixed(4)}px + ${(slope * 100).toFixed(4)}vw, ${maxSize}px)`;
}

/**
 * Generate fluid typography scale from base configuration
 *
 * @param baseSize - Base font size in pixels
 * @param scale - Typography scale ratio
 * @param config - Fluid typography configuration
 * @returns Object with fluid size values for each scale
 *
 * @example
 * ```typescript
 * const fluidSizes = generateFluidTypographyScale(16, 1.25, {
 *   enabled: true,
 *   minViewport: 320,
 *   maxViewport: 1280,
 *   minSizeMultiplier: 0.8,
 *   maxSizeMultiplier: 1.2,
 * });
 * ```
 */
export function generateFluidTypographyScale(
  baseSize: number,
  scale: number,
  config: FluidTypography,
): Record<string, string> {
  const {
    minViewport = 320,
    maxViewport = 1280,
    minSizeMultiplier = 0.8,
    maxSizeMultiplier = 1.2,
    customSizes = {},
  } = config;

  const sizes: Record<string, string> = {};

  // Standard scale sizes
  const scaleSteps = {
    xs: -2,
    sm: -1,
    base: 0,
    lg: 1,
    xl: 2,
    "2xl": 3,
    "3xl": 4,
    "4xl": 5,
    "5xl": 6,
    "6xl": 7,
  };

  for (const key of new Set([
    ...Object.keys(scaleSteps),
    ...Object.keys(customSizes),
  ])) {
    const step = scaleSteps[key as keyof typeof scaleSteps] ?? 0;
    // Check if custom size is defined
    if (customSizes[key]) {
      sizes[key] = generateFluidSize(
        customSizes[key].min,
        customSizes[key].max,
        minViewport,
        maxViewport,
      );
    } else {
      // Calculate min and max sizes based on multipliers
      const targetSize = baseSize * scale ** step;
      const minSize = Math.round(targetSize * minSizeMultiplier);
      const maxSize = Math.round(targetSize * maxSizeMultiplier);

      sizes[key] = generateFluidSize(
        minSize,
        maxSize,
        minViewport,
        maxViewport,
      );
    }
  }

  return sizes;
}

/**
 * Check if browser supports CSS clamp()
 *
 * @returns Boolean indicating clamp support
 */
export function supportsClamp(): boolean {
  // Check if running in browser environment
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { window?: unknown }).window === "undefined"
  ) {
    // Node.js environment - assume modern browser support
    return true;
  }

  try {
    // Browser environment - check actual support
    const cssAPI = (
      globalThis as {
        CSS?: { supports?: (prop: string, value: string) => boolean };
      }
    ).CSS;
    if (cssAPI?.supports) {
      return cssAPI.supports("font-size", "clamp(1rem, 2vw, 3rem)");
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Generate fallback for browsers that don't support clamp()
 *
 * @param baseSize - Base font size in pixels
 * @returns CSS string with media query fallbacks
 *
 * @example
 * ```typescript
 * const fallback = generateFluidFallback(16);
 * // Returns CSS with @media queries
 * ```
 */
export function generateFluidFallback(baseSize: number): string {
  return `
    font-size: ${baseSize}px; /* Fallback */

    @media (min-width: 768px) {
      font-size: ${Math.round(baseSize * 1.1)}px;
    }

    @media (min-width: 1024px) {
      font-size: ${Math.round(baseSize * 1.2)}px;
    }
  `;
}

/**
 * Convert fluid typography to CSS custom properties
 *
 * @param fluidSizes - Fluid size mappings
 * @returns CSS string with custom properties
 *
 * @example
 * ```typescript
 * const css = fluidTypographyToCSS({
 *   base: "clamp(16px, 1.5vw, 20px)",
 *   lg: "clamp(20px, 2vw, 28px)",
 * });
 * ```
 */
export function fluidTypographyToCSS(
  fluidSizes: Record<string, string>,
): string {
  return Object.entries(fluidSizes)
    .map(([key, value]) => `  --theme-font-size-${key}: ${value};`)
    .join("\n");
}

/**
 * Validate fluid typography configuration
 *
 * @param config - Fluid typography configuration to validate
 * @returns Validation result with errors if any
 */
export function validateFluidTypography(config: FluidTypography): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (
    !config ||
    typeof config !== "object" ||
    typeof config.enabled !== "boolean"
  )
    return {
      valid: false,
      errors: ["Expected fluid config with enabled boolean"],
    };
  if (!config.enabled) return { valid: true, errors };
  const ranges = [
    ["viewport", config.minViewport ?? 320, config.maxViewport ?? 1280],
    [
      "multiplier",
      config.minSizeMultiplier ?? 0.8,
      config.maxSizeMultiplier ?? 1.2,
    ],
  ] as const;
  for (const [name, min, max] of ranges)
    if (
      typeof min !== "number" ||
      typeof max !== "number" ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min <= 0 ||
      max <= min
    )
      errors.push(`${name}: expected positive finite increasing range`);
  if (config.customSizes !== undefined) {
    if (
      !config.customSizes ||
      typeof config.customSizes !== "object" ||
      Array.isArray(config.customSizes)
    )
      errors.push("Expected customSizes object");
    else
      for (const [key, size] of Object.entries(config.customSizes))
        if (
          !size ||
          typeof size.min !== "number" ||
          typeof size.max !== "number" ||
          !Number.isFinite(size.min) ||
          !Number.isFinite(size.max) ||
          size.min <= 0 ||
          size.max <= size.min
        )
          errors.push(`${key}: expected positive finite increasing min/max`);
  }
  return { valid: errors.length === 0, errors };
}
