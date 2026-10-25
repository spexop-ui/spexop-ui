/**
 * CSS Variables Generator
 * Converts SpexopThemeConfig to CSS custom properties
 *
 * @module @spexop/theme/generators
 */

import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
import {
  expandColors,
  expandSpacing,
  tokenName,
  cssLength,
} from "../utils/foundationTokens.js";
import { parseColor } from "../utils/color.js";
import { assertTheme } from "../validators/validateTheme.js";
import { resolveTheme } from "../utils/tokenResolver.js";
import {
  fluidTypographyToCSS,
  generateFluidTypographyScale,
} from "../utils/fluidTypography.js";
import { resolveToken } from "../utils/tokenResolver.js";

/**
 * Generate spacing tokens from theme config
 */
function generateSpacingTokens(spacing: SpexopThemeConfig["spacing"]): string {
  const spacingValues = expandSpacing(spacing);

  return Object.entries(spacingValues)
    .map(([key, value]) => `  --theme-spacing-${key}: ${value}px;`)
    .join("\n");
}

/**
 * Generate typography scale from theme config
 */
function generateTypographyScale(
  typography: SpexopThemeConfig["typography"],
  fluidConfig?: SpexopThemeConfig["fluidTypography"],
): string {
  const { baseSize, scale, sizes } = typography;

  // If fluid typography is enabled, use clamp() values
  if (fluidConfig?.enabled) {
    const fluidSizes = generateFluidTypographyScale(
      baseSize,
      scale,
      fluidConfig,
    );
    return fluidTypographyToCSS(fluidSizes);
  }

  // Use custom sizes if provided, otherwise generate from scale ratio
  const typographySizes = sizes || {
    xs: Math.round(baseSize / (scale * scale)),
    sm: Math.round(baseSize / scale),
    base: baseSize,
    lg: Math.round(baseSize * scale),
    xl: Math.round(baseSize * scale * scale),
    "2xl": Math.round(baseSize * scale * scale * scale),
    "3xl": Math.round(baseSize * scale * scale * scale * scale),
    "4xl": Math.round(baseSize * scale ** 5),
    "5xl": Math.round(baseSize * scale ** 6),
    "6xl": Math.round(baseSize * scale ** 7),
  };

  return Object.entries(typographySizes)
    .map(([key, value]) => `  --theme-font-size-${key}: ${value}px;`)
    .join("\n");
}

/**
 * Generate font weight tokens
 */
function generateFontWeights(
  weights: SpexopThemeConfig["typography"]["weights"],
): string {
  return Object.entries(weights)
    .map(([key, value]) => `  --theme-font-weight-${key}: ${value};`)
    .join("\n");
}

/**
 * Generate line height tokens
 */
function generateLineHeights(
  lineHeights: SpexopThemeConfig["typography"]["lineHeights"],
): string {
  if (!lineHeights) {
    return "";
  }
  return Object.entries(lineHeights)
    .map(([key, value]) => `  --theme-line-height-${key}: ${value};`)
    .join("\n");
}

/**
 * Convert camelCase to kebab-case
 */
const camelToKebab = tokenName;
function generatePalette(colors: SpexopThemeConfig["colors"]): string {
  return Object.entries(expandColors(colors))
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, value]) => {
      const rgb = parseColor(value).to("srgb").toGamut({ method: "clip" })
        .coords as number[];
      return `  --theme-${tokenName(key)}: ${value};\n  --theme-${tokenName(key)}-rgb: ${rgb.map((v) => Math.round(v * 255)).join(", ")};`;
    })
    .join("\n");
}

/**
 * Generate breakpoint tokens
 */
function generateBreakpoints(
  breakpoints?: Partial<SpexopThemeConfig["breakpoints"]>,
): string {
  if (!breakpoints) return "";

  return Object.entries(breakpoints)
    .map(([key, value]) => `  --theme-breakpoint-${key}: ${value}px;`)
    .join("\n");
}

/**
 * Generate button styling tokens
 * Resolves token references to actual values before generating CSS
 */
function generateButtonStyles(
  buttons?: SpexopThemeConfig["buttons"],
  config?: SpexopThemeConfig,
): string {
  if (!buttons || !config) return "";

  const variants: string[] = [];

  for (const [variant, styles] of Object.entries(buttons)) {
    if (!styles) continue;

    const variantStyles: string[] = [];

    if (styles.background) {
      const resolved = resolveToken(styles.background, config);
      variantStyles.push(`  --theme-button-${variant}-bg: ${resolved};`);
    }
    if (styles.text) {
      const resolved = resolveToken(styles.text, config);
      variantStyles.push(`  --theme-button-${variant}-text: ${resolved};`);
    }
    if (styles.border) {
      const resolved = resolveToken(styles.border, config);
      variantStyles.push(`  --theme-button-${variant}-border: ${resolved};`);
    }
    if (styles.backgroundHover) {
      const resolved = resolveToken(styles.backgroundHover, config);
      variantStyles.push(`  --theme-button-${variant}-bg-hover: ${resolved};`);
    }
    if (styles.textHover) {
      const resolved = resolveToken(styles.textHover, config);
      variantStyles.push(
        `  --theme-button-${variant}-text-hover: ${resolved};`,
      );
    }
    if (styles.borderHover) {
      const resolved = resolveToken(styles.borderHover, config);
      variantStyles.push(
        `  --theme-button-${variant}-border-hover: ${resolved};`,
      );
    }
    if (styles.backgroundActive) {
      const resolved = resolveToken(styles.backgroundActive, config);
      variantStyles.push(`  --theme-button-${variant}-bg-active: ${resolved};`);
    }
    if (styles.textActive) {
      const resolved = resolveToken(styles.textActive, config);
      variantStyles.push(
        `  --theme-button-${variant}-text-active: ${resolved};`,
      );
    }
    if (styles.borderActive) {
      const resolved = resolveToken(styles.borderActive, config);
      variantStyles.push(
        `  --theme-button-${variant}-border-active: ${resolved};`,
      );
    }
    if (styles.borderStyle) {
      variantStyles.push(
        `  --theme-button-${variant}-border-style: ${styles.borderStyle};`,
      );
    }
    if (styles.borderColor) {
      const resolved = resolveToken(styles.borderColor, config);
      variantStyles.push(
        `  --theme-button-${variant}-border-color: ${resolved};`,
      );
    }
    if (styles.borderWidth !== undefined) {
      const resolved = resolveToken(styles.borderWidth, config);
      variantStyles.push(
        `  --theme-button-${variant}-border-width: ${cssLength(resolved)};`,
      );
    }
    if (styles.borderHoverWidth !== undefined) {
      const resolved = resolveToken(styles.borderHoverWidth, config);
      variantStyles.push(
        `  --theme-button-${variant}-border-width-hover: ${cssLength(resolved)};`,
      );
    }

    if (variantStyles.length > 0) {
      variants.push(variantStyles.join("\n"));
    }
  }

  return variants.join("\n");
}

/**
 * Generate extended radius system tokens
 */
function generateRadiiTokens(radii?: SpexopThemeConfig["radii"]): string {
  if (!radii) return "";

  const tokens: string[] = [];

  if (radii.none !== undefined) {
    tokens.push(`  --theme-radius-none: ${radii.none}px;`);
  }
  if (radii.sm !== undefined) {
    tokens.push(`  --theme-radius-sm: ${radii.sm}px;`);
  }
  if (radii.md !== undefined) {
    tokens.push(`  --theme-radius-md: ${radii.md}px;`);
  }
  if (radii.lg !== undefined) {
    tokens.push(`  --theme-radius-lg: ${radii.lg}px;`);
  }
  if (radii.xl !== undefined) {
    tokens.push(`  --theme-radius-xl: ${radii.xl}px;`);
  }
  if (radii["2xl"] !== undefined) {
    tokens.push(`  --theme-radius-2xl: ${radii["2xl"]}px;`);
  }
  if (radii.full !== undefined) {
    tokens.push(`  --theme-radius-full: ${radii.full}px;`);
  }

  return tokens.length > 0 ? tokens.join("\n") : "";
}

/**
 * Generate shadow system tokens
 */
function generateShadowTokens(shadows?: SpexopThemeConfig["shadows"]): string {
  if (!shadows) return "";

  const tokens: string[] = [];

  if (shadows.none !== undefined) {
    tokens.push(`  --theme-shadow-none: ${shadows.none};`);
  }
  if (shadows.sm !== undefined) {
    tokens.push(`  --theme-shadow-sm: ${shadows.sm};`);
  }
  if (shadows.md !== undefined) {
    tokens.push(`  --theme-shadow-md: ${shadows.md};`);
  }
  if (shadows.lg !== undefined) {
    tokens.push(`  --theme-shadow-lg: ${shadows.lg};`);
  }
  if (shadows.xl !== undefined) {
    tokens.push(`  --theme-shadow-xl: ${shadows.xl};`);
  }

  return tokens.length > 0 ? tokens.join("\n") : "";
}

/**
 * Generate z-index layering tokens
 */
function generateZIndexTokens(zIndex?: SpexopThemeConfig["zIndex"]): string {
  if (!zIndex) return "";

  const tokens: string[] = [];

  if (zIndex.base !== undefined) {
    tokens.push(`  --theme-z-base: ${zIndex.base};`);
  }
  if (zIndex.dropdown !== undefined) {
    tokens.push(`  --theme-z-dropdown: ${zIndex.dropdown};`);
  }
  if (zIndex.select !== undefined) {
    tokens.push(`  --theme-z-select: ${zIndex.select};`);
  }
  if (zIndex.sticky !== undefined) {
    tokens.push(`  --theme-z-sticky: ${zIndex.sticky};`);
  }
  if (zIndex.fixed !== undefined) {
    tokens.push(`  --theme-z-fixed: ${zIndex.fixed};`);
  }
  if (zIndex.modal !== undefined) {
    tokens.push(`  --theme-z-modal: ${zIndex.modal};`);
  }
  if (zIndex.popover !== undefined) {
    tokens.push(`  --theme-z-popover: ${zIndex.popover};`);
  }
  if (zIndex.tooltip !== undefined) {
    tokens.push(`  --theme-z-tooltip: ${zIndex.tooltip};`);
  }
  if (zIndex.toast !== undefined) {
    tokens.push(`  --theme-z-toast: ${zIndex.toast};`);
  }

  return tokens.length > 0 ? tokens.join("\n") : "";
}

/**
 * Generate card variant tokens
 */
function generateCardTokens(
  cards: SpexopThemeConfig["cards"],
  config: SpexopThemeConfig,
): string {
  if (!cards) return "";

  const tokens: string[] = [];

  for (const [variant, style] of Object.entries(cards)) {
    if (!style) continue;

    const variantKebab = camelToKebab(variant);

    if (style.background) {
      tokens.push(
        `  --theme-card-${variantKebab}-bg: ${resolveToken(style.background, config)};`,
      );
    }

    if (style.border) {
      tokens.push(
        `  --theme-card-${variantKebab}-border: ${resolveToken(style.border, config)};`,
      );
    }

    if (style.backgroundHover) {
      tokens.push(
        `  --theme-card-${variantKebab}-bg-hover: ${resolveToken(style.backgroundHover, config)};`,
      );
    }

    if (style.borderHover) {
      tokens.push(
        `  --theme-card-${variantKebab}-border-hover: ${resolveToken(style.borderHover, config)};`,
      );
    }

    if (style.borderStyle) {
      tokens.push(
        `  --theme-card-${variantKebab}-border-style: ${style.borderStyle};`,
      );
    }

    if (style.borderWidth !== undefined) {
      tokens.push(
        `  --theme-card-${variantKebab}-border-width: ${cssLength(resolveToken(style.borderWidth, config))};`,
      );
    }
  }

  return tokens.join("\n");
}

/**
 * Generate divider color variant tokens
 */
function generateDividerTokens(
  dividers: SpexopThemeConfig["dividers"],
  config: SpexopThemeConfig,
): string {
  if (!dividers) return "";

  const tokens: string[] = [];

  for (const [variant, style] of Object.entries(dividers)) {
    if (!style) continue;

    const variantKebab = camelToKebab(variant);

    if (style.color) {
      tokens.push(
        `  --theme-divider-${variantKebab}-color: ${resolveToken(style.color, config)};`,
      );
    }
  }

  return tokens.join("\n");
}

/**
 * Generate form field tokens
 */
function generateFormTokens(
  forms: SpexopThemeConfig["forms"],
  config: SpexopThemeConfig,
): string {
  if (!forms) return "";

  const tokens: string[] = [];

  // Input field tokens
  if (forms.input) {
    if (forms.input.background) {
      tokens.push(
        `  --theme-form-input-bg: ${resolveToken(forms.input.background, config)};`,
      );
    }
    if (forms.input.border) {
      tokens.push(
        `  --theme-form-input-border: ${resolveToken(forms.input.border, config)};`,
      );
    }
    if (forms.input.text) {
      tokens.push(
        `  --theme-form-input-text: ${resolveToken(forms.input.text, config)};`,
      );
    }
    if (forms.input.placeholder) {
      tokens.push(
        `  --theme-form-input-placeholder: ${resolveToken(forms.input.placeholder, config)};`,
      );
    }
    if (forms.input.focusBorder) {
      tokens.push(
        `  --theme-form-input-focus-border: ${resolveToken(forms.input.focusBorder, config)};`,
      );
    }
    if (forms.input.focusRing) {
      tokens.push(
        `  --theme-form-input-focus-ring: ${resolveToken(forms.input.focusRing, config)};`,
      );
    }
    if (forms.input.errorBorder) {
      tokens.push(
        `  --theme-form-input-error-border: ${resolveToken(forms.input.errorBorder, config)};`,
      );
    }
    if (forms.input.disabledBackground) {
      tokens.push(
        `  --theme-form-input-disabled-bg: ${resolveToken(forms.input.disabledBackground, config)};`,
      );
    }
  }

  // Label tokens
  if (forms.label) {
    if (forms.label.text) {
      tokens.push(
        `  --theme-form-label-text: ${resolveToken(forms.label.text, config)};`,
      );
    }
    if (forms.label.requiredColor) {
      tokens.push(
        `  --theme-form-label-required: ${resolveToken(forms.label.requiredColor, config)};`,
      );
    }
    if (forms.label.optionalColor) {
      tokens.push(
        `  --theme-form-label-optional: ${resolveToken(forms.label.optionalColor, config)};`,
      );
    }
  }

  // Validation tokens
  if (forms.validation) {
    if (forms.validation.successColor) {
      tokens.push(
        `  --theme-form-validation-success: ${resolveToken(forms.validation.successColor, config)};`,
      );
    }
    if (forms.validation.errorColor) {
      tokens.push(
        `  --theme-form-validation-error: ${resolveToken(forms.validation.errorColor, config)};`,
      );
    }
    if (forms.validation.warningColor) {
      tokens.push(
        `  --theme-form-validation-warning: ${resolveToken(forms.validation.warningColor, config)};`,
      );
    }
    if (forms.validation.infoColor) {
      tokens.push(
        `  --theme-form-validation-info: ${resolveToken(forms.validation.infoColor, config)};`,
      );
    }
  }

  return tokens.join("\n");
}

/**
 * Generate animation tokens (durations, easings, transitions)
 */
function generateAnimationTokens(
  animations?: SpexopThemeConfig["animations"],
): string {
  if (!animations) return "";

  const tokens: string[] = [];

  // Durations
  if (animations.durations) {
    if (animations.durations.fast !== undefined) {
      tokens.push(`  --theme-duration-fast: ${animations.durations.fast}ms;`);
    }
    if (animations.durations.normal !== undefined) {
      tokens.push(
        `  --theme-duration-normal: ${animations.durations.normal}ms;`,
      );
    }
    if (animations.durations.slow !== undefined) {
      tokens.push(`  --theme-duration-slow: ${animations.durations.slow}ms;`);
    }
    if (animations.durations.slower !== undefined) {
      tokens.push(
        `  --theme-duration-slower: ${animations.durations.slower}ms;`,
      );
    }
  }

  // Easings
  if (animations.easings) {
    for (const [key, value] of Object.entries(animations.easings)) {
      if (value) {
        tokens.push(`  --theme-easing-${camelToKebab(key)}: ${value};`);
      }
    }
  }

  // Transitions
  if (animations.transitions) {
    for (const [key, value] of Object.entries(animations.transitions)) {
      if (value) {
        tokens.push(`  --theme-transition-${camelToKebab(key)}: ${value};`);
      }
    }
  }

  return tokens.length > 0 ? tokens.join("\n") : "";
}

/**
 * Generate opacity tokens
 */
function generateOpacityTokens(opacity?: SpexopThemeConfig["opacity"]): string {
  if (!opacity) return "";

  const tokens: string[] = [];

  for (const [key, value] of Object.entries(opacity)) {
    if (value !== undefined) {
      tokens.push(`  --theme-opacity-${camelToKebab(key)}: ${value};`);
    }
  }

  return tokens.length > 0 ? tokens.join("\n") : "";
}

/**
 * CSS generation options
 */
export interface CSSGenerationOptions {
  /** CSS selector scope (default: ":root") */
  scope?: string;
  /** Minimal output - exclude unused tokens */
  minimal?: boolean;
  /** Compress/minify output */
  compress?: boolean;
  /** Custom property prefix (default: "theme") */
  prefix?: string;
  /** Include dark mode styles */
  includeDarkMode?: boolean;
}

/**
 * Generate CSS variables from theme configuration
 *
 * @param config - Spexop theme configuration
 * @param scopeOrOptions - CSS selector scope or options object (default: ':root')
 * @returns CSS string with custom properties
 *
 * @example
 * ```typescript
 * import { generateCSS } from '@spexop/theme/generators';
 * import { myTheme } from './theme.config';
 *
 * const css = generateCSS(myTheme);
 * // Inject into page or save to file
 *
 * // Or scope to a specific container
 * const scopedCss = generateCSS(myTheme, '.theme-preview');
 *
 * // With options
 * const minimalCss = generateCSS(myTheme, { minimal: true, compress: true });
 * ```
 */
export function generateCSS(
  config: SpexopThemeConfig,
  scopeOrOptions: string | CSSGenerationOptions = ":root",
): string {
  assertTheme(config);
  const originalDark = config.darkMode;
  const dark = originalDark?.enabled ? resolveTheme(config, "dark") : undefined;
  config = {
    ...resolveTheme(config),
    ...(dark
      ? {
          darkMode: {
            ...originalDark!,
            colors: dark.colors,
            buttons: dark.buttons,
            cards: dark.cards,
            dividers: dark.dividers,
          },
        }
      : {}),
  };
  // Handle legacy string scope parameter
  const options: CSSGenerationOptions =
    typeof scopeOrOptions === "string"
      ? { scope: scopeOrOptions }
      : scopeOrOptions;

  const scope = options.scope ?? ":root";
  const prefix = options.prefix ?? "theme";
  const includeDarkMode = options.includeDarkMode ?? true;
  if (!/^[a-z][a-z0-9-]*$/i.test(prefix)) throw new Error("Invalid CSS prefix");
  if (!/^(:root|[.#][a-zA-Z_][a-zA-Z0-9_-]*)$/.test(scope))
    throw new Error("Unsupported CSS scope");
  const {
    colors,
    spacing,
    typography,
    fluidTypography,
    borders,
    radii,
    shadows,
    zIndex,
    buttons,
    cards,
    dividers,
    forms,
    breakpoints,
    darkMode,
    animations,
    opacity,
  } = config;

  const darkDeclarations = dark
    ? [
        generatePalette(dark.colors),
        generateButtonStyles(dark.buttons, dark),
        generateCardTokens(dark.cards, dark),
        generateDividerTokens(dark.dividers, dark),
        generateFormTokens(dark.forms, dark),
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  // Generate CSS with prefix support
  let css = `
/**
 * ${config.meta.name} - Theme Variables
 * Generated by @spexop/theme
 * Version: ${config.meta.version}
 */

${scope} {
  /* === Colors === */
${generatePalette(colors)}

  /* === Spacing === */
${generateSpacingTokens(spacing)}

  /* === Typography === */
  /* Font Families */
  --theme-font-family: ${typography.fontFamily};
  --theme-font-family-heading: ${typography.fontFamilyHeading || typography.fontFamily};
  ${typography.fontFamilyMono ? `--theme-font-family-mono: ${typography.fontFamilyMono};` : ""}

  /* Font Sizes */
${generateTypographyScale(typography, fluidTypography)}

  /* Font Weights */
${generateFontWeights(typography.weights)}
  --theme-font-weight-normal: ${typography.weights.regular}; /* Alias for regular */

  /* Line Heights */
${generateLineHeights(typography.lineHeights)}

  /* === Borders === */
  /* Widths */
  ${borders.thin !== undefined ? `--theme-border-thin: ${borders.thin}px;` : ""}
  --theme-border-width: ${borders.default}px;
  ${borders.thick !== undefined ? `--theme-border-thick: ${borders.thick}px;` : ""}
  ${(borders as unknown as Record<string, unknown>).strong ? `--theme-border-strong-width: ${(borders as unknown as Record<string, unknown>).strong}px;` : ""}

  /* Radius */
${
  (borders as unknown as Record<string, unknown>).radius
    ? Object.entries(
        (borders as unknown as Record<string, unknown>).radius as Record<
          string,
          number
        >,
      )
        .map(([key, value]) => `  --theme-radius-${key}: ${value}px;`)
        .join("\n")
    : ""
}
  ${borders.radiusSubtle !== undefined ? `--theme-radius-subtle: ${borders.radiusSubtle}px;` : ""}
  ${borders.radiusSubtle !== undefined ? `--theme-radius-base: ${borders.radiusSubtle}px; /* Alias for subtle */` : ""}
  ${borders.radiusRelaxed !== undefined ? `--theme-radius-relaxed: ${borders.radiusRelaxed}px;` : ""}
  ${borders.radiusRelaxed !== undefined ? `--theme-radius-medium: ${borders.radiusRelaxed}px; /* Alias for relaxed */` : ""}
  ${borders.radiusPill !== undefined ? `--theme-radius-pill: ${borders.radiusPill}px;` : ""}
  ${borders.radiusLiquid !== undefined ? `--theme-radius-liquid: ${borders.radiusLiquid}px;` : ""}

  /* Style */
  ${borders.defaultStyle ? `--theme-border-style: ${borders.defaultStyle};` : ""}

  /* === Extended Radius === */
${generateRadiiTokens(radii)}

  /* === Shadows === */
${generateShadowTokens(shadows)}

  /* === Z-Index === */
${generateZIndexTokens(zIndex)}

  /* === Animations === */
${generateAnimationTokens(animations)}

  /* === Opacity === */
${generateOpacityTokens(opacity)}

  /* === Breakpoints === */
${generateBreakpoints(breakpoints)}

  /* === Buttons === */
${generateButtonStyles(buttons, config)}

  /* === Cards === */
${generateCardTokens(cards, config)}

  /* === Dividers === */
${generateDividerTokens(dividers, config)}

  /* === Forms === */
${generateFormTokens(forms, config)}
}

${
  includeDarkMode && darkMode?.enabled
    ? `
/* === Dark Mode === */
${scope}[data-theme="dark"], ${scope}.dark {
${darkDeclarations}

}

@media (prefers-color-scheme: dark) {
  ${scope}:not([data-theme="light"]) {
${darkDeclarations}
  }
}
`
    : ""
}
`.trim();

  // Apply prefix replacement if custom prefix provided
  if (prefix !== "theme") {
    css = css.replace(/--theme-/g, `--${prefix}-`);
  }

  // Apply compression if requested
  if (options.compress) {
    css = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.trim())
      .join("");
  }

  // Apply minimal output (remove unused tokens) if requested
  // Note: This is a basic implementation - more sophisticated analysis could be added
  if (options.minimal) {
    // Remove empty lines and excessive whitespace
    css = css.replace(/\n\s*\n/g, "\n");
  }

  return css;
}
