/**
 * Default Spexop Theme
 *
 * Historical theme retained as a configuration example.
 * Run an accessibility audit before use; no visual or WCAG compliance is implied.
 *
 * @module @spexop/theme/defaults
 */

import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";

/**
 * Default Spexop theme configuration
 * Matches current v0.1.0 design system aesthetics
 */
export const defaultTheme: SpexopThemeConfig = {
  meta: {
    name: "Spexop Default",
    version: "1.0.0",
    description: "Default theme for Spexop Design System",
    author: "Spexop Team",
  },

  colors: {
    // Primary brand color (red)
    primary: "#ef4444",
    primaryHover: "#dc2626",
    primaryActive: "#b91c1c",
    primaryLight: "#fef2f2",
    primaryDark: "#7f1d1d",

    // Secondary color (optional, not heavily used in v0.1.0)
    secondary: "#3b82f6",
    secondaryHover: "#2563eb",
    secondaryActive: "#1d4ed8",
    secondaryLight: "#eff6ff",
    secondaryDark: "#1e3a8a",

    // Surface colors (neutral backgrounds)
    surface: "#ffffff",
    surfaceSecondary: "#f5f5f5",
    surfaceHover: "#e5e5e5",

    // Text colors (neutral scale)
    text: "#171717",
    textSecondary: "#525252",
    textMuted: "#737373",

    // Border colors
    border: "#e5e5e5",
    borderStrong: "#d4d4d4",
    borderSubtle: "#f5f5f5",

    // Semantic colors
    success: "#22c55e",
    successLight: "#dcfce7",
    successDark: "#14532d",
    warning: "#f59e0b",
    warningLight: "#fef3c7",
    warningDark: "#713f12",
    error: "#ef4444",
    errorLight: "#fee2e2",
    errorDark: "#7f1d1d",
    info: "#3b82f6",
    infoLight: "#dbeafe",
    infoDark: "#1e3a8a",

    // Accent colors (purple/violet for special highlights)
    accent: "#8b5cf6",
    accentHover: "#7c3aed",
    accentActive: "#6d28d9",

    // Link colors (blue, distinct from primary)
    link: "#3b82f6",
    linkHover: "#2563eb",
    linkActive: "#1d4ed8",

    // Interactive states
    focus: "#3b82f6", // Blue focus ring (accessibility)
    hover: "rgba(0, 0, 0, 0.05)", // Subtle gray overlay

    // Overlay/backdrop
    overlay: "rgba(0, 0, 0, 0.75)", // Modal overlay
    backdrop: "rgba(0, 0, 0, 0.5)", // General backdrop

    // Neutral colors (gray scale)
    neutral: "#737373",
    neutralHover: "#525252",
    neutralActive: "#404040",
  },

  typography: {
    // Fira Sans font family (current default)
    fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontFamilyHeading:
      "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontFamilyMono: "'Fira Code', 'Courier New', monospace",

    // Base size and scale
    baseSize: 16,
    scale: 1.25, // Minor third scale

    // Custom sizes for better granularity
    sizes: {
      xs2: 10, // Extra small for breadcrumbs, captions
      xs: 12, // Small
      sm: 14, // Small-medium (was 13px)
      base: 16, // Base
      lg: 20, // Large
      xl: 25, // Extra large
      "2xl": 31, // 2x large
      "3xl": 39, // 3x large
      "4xl": 49, // 4x large
      "5xl": 61, // 5x large
      "6xl": 76, // 6x large
    },

    // Font weights
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    // Line heights
    lineHeights: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    // 4px base unit (current system)
    baseUnit: 4,
    // Auto-generate scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96]
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96],
  },

  borders: {
    // Border widths
    thin: 1,
    default: 2,
    thick: 4,

    // Border radius (current values)
    radiusSubtle: 8,
    radiusRelaxed: 12,
    radiusPill: 9999,

    // Default style
    defaultStyle: "solid",
  },

  // Extended radius system
  radii: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    "2xl": 20,
    full: 9999,
  },

  // Shadow system
  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.15)",
  },

  // Z-index layering system
  zIndex: {
    base: 0,
    dropdown: 10001,
    select: 10001,
    sticky: 1100,
    fixed: 1200,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
    toast: 1600,
  },

  // Button styling (using token references for maintainability)
  buttons: {
    primary: {
      background: "colors.primary",
      text: "#ffffff",
      border: "colors.primary",
      backgroundHover: "colors.primaryHover",
      textHover: "#ffffff",
      borderHover: "colors.primaryHover",
      backgroundActive: "colors.primaryActive",
      textActive: "#ffffff",
      borderActive: "colors.primaryActive",
    },
    secondary: {
      background: "colors.secondary",
      text: "#ffffff",
      border: "colors.secondary",
      backgroundHover: "colors.secondaryHover",
      textHover: "#ffffff",
      borderHover: "colors.secondaryHover",
      backgroundActive: "colors.secondaryActive",
      textActive: "#ffffff",
      borderActive: "colors.secondaryActive",
    },
    outline: {
      background: "transparent",
      text: "colors.primary",
      border: "colors.primary",
      backgroundHover: "#fef2f2",
      textHover: "colors.primaryHover",
      borderHover: "colors.primaryHover",
      backgroundActive: "#fee2e2",
      textActive: "colors.primaryActive",
      borderActive: "colors.primaryActive",
    },
    ghost: {
      background: "transparent",
      text: "colors.text",
      border: "transparent",
      backgroundHover: "colors.surfaceSecondary",
      textHover: "colors.text",
      borderHover: "transparent",
      backgroundActive: "colors.surfaceHover",
      textActive: "colors.text",
      borderActive: "transparent",
    },
    text: {
      background: "transparent",
      text: "colors.link",
      border: "transparent",
      backgroundHover: "transparent",
      textHover: "colors.linkHover",
      borderHover: "transparent",
      backgroundActive: "transparent",
      textActive: "colors.linkActive",
      borderActive: "transparent",
    },
    pill: {
      background: "transparent",
      text: "colors.primary",
      border: "colors.primary",
      backgroundHover: "#fef2f2",
      textHover: "colors.primary",
      borderHover: "colors.primaryHover",
      backgroundActive: "#fee2e2",
      textActive: "colors.primaryActive",
      borderActive: "colors.primaryActive",
    },
    "border-emphasis": {
      background: "transparent",
      text: "colors.text",
      border: "colors.borderStrong",
      backgroundHover: "colors.surfaceHover",
      textHover: "colors.text",
      borderHover: "colors.text",
      backgroundActive: "colors.surfaceHover",
      textActive: "colors.text",
      borderActive: "colors.text",
    },
    danger: {
      background: "colors.error",
      text: "#ffffff",
      border: "colors.error",
      backgroundHover: "#dc2626",
      textHover: "#ffffff",
      borderHover: "#dc2626",
      backgroundActive: "#b91c1c",
      textActive: "#ffffff",
      borderActive: "#b91c1c",
    },
    success: {
      background: "colors.success",
      text: "#ffffff",
      border: "colors.success",
      backgroundHover: "#16a34a",
      textHover: "#ffffff",
      borderHover: "#16a34a",
      backgroundActive: "#15803d",
      textActive: "#ffffff",
      borderActive: "#15803d",
    },
    warning: {
      background: "colors.warning",
      text: "#ffffff",
      border: "colors.warning",
      backgroundHover: "#d97706",
      textHover: "#ffffff",
      borderHover: "#d97706",
      backgroundActive: "#b45309",
      textActive: "#ffffff",
      borderActive: "#b45309",
    },
    info: {
      background: "colors.info",
      text: "#ffffff",
      border: "colors.info",
      backgroundHover: "#2563eb",
      textHover: "#ffffff",
      borderHover: "#2563eb",
      backgroundActive: "#1d4ed8",
      textActive: "#ffffff",
      borderActive: "#1d4ed8",
    },
    neutral: {
      background: "colors.neutral",
      text: "#ffffff",
      border: "colors.neutral",
      backgroundHover: "colors.neutralHover",
      textHover: "#ffffff",
      borderHover: "colors.neutralHover",
      backgroundActive: "colors.neutralActive",
      textActive: "#ffffff",
      borderActive: "colors.neutralActive",
    },
  },

  // Card variants
  cards: {
    basic: {
      background: "colors.surface",
      border: "colors.border",
      backgroundHover: "colors.surface",
      borderHover: "colors.borderStrong",
    },
    highlighted: {
      background: "colors.surface",
      border: "colors.primary",
      backgroundHover: "colors.surface",
      borderHover: "colors.primaryActive",
    },
    outlined: {
      background: "colors.surface",
      border: "colors.text",
      borderWidth: "borders.thick",
      backgroundHover: "colors.surface",
      borderHover: "colors.text",
    },
    interactive: {
      background: "colors.surface",
      border: "colors.border",
      backgroundHover: "colors.surface",
      borderHover: "colors.primary",
    },
    ghost: {
      background: "transparent",
      border: "colors.border",
      borderStyle: "dashed",
      backgroundHover: "transparent",
      borderHover: "colors.text",
    },
    elevated: {
      background: "colors.surfaceHover",
      border: "colors.primary",
      backgroundHover: "colors.surfaceHover",
      borderHover: "colors.primary",
    },
  },

  // Default breakpoints (match current responsive system)
  breakpoints: {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
  },

  // Dark mode configuration
  darkMode: {
    enabled: true,
    colors: {
      surface: "#0a0a0a",
      surfaceSecondary: "#171717",
      surfaceHover: "#262626",
      text: "#fafafa",
      textSecondary: "#a3a3a3",
      textMuted: "#737373",
      border: "#262626",
      borderStrong: "#404040",
      borderSubtle: "#171717",

      // Semantic colors - brighter for dark backgrounds
      primary: "#ff6b6b",
      primaryHover: "#ff5252",
      primaryActive: "#ff3838",
      primaryLight: "#2d1515",
      primaryDark: "#ff8787",
      success: "#51cf66",
      successLight: "#1a2e1a",
      successDark: "#69db7c",
      warning: "#ffd43b",
      warningLight: "#332c1a",
      warningDark: "#ffe066",
      error: "#ff6b6b",
      errorLight: "#2d1515",
      errorDark: "#ff8787",
      info: "#74c0fc",
      infoLight: "#1a2733",
      infoDark: "#91d0ff",

      // Accent colors (lighter in dark mode)
      accent: "#a78bfa",
      accentHover: "#8b5cf6",
      accentActive: "#7c3aed",

      // Link colors (lighter blue)
      link: "#60a5fa",
      linkHover: "#3b82f6",
      linkActive: "#2563eb",

      // Interactive states
      focus: "#60a5fa",
      hover: "rgba(255, 255, 255, 0.1)",

      // Overlay/backdrop (darker/stronger in dark mode)
      overlay: "rgba(0, 0, 0, 0.9)",
      backdrop: "rgba(0, 0, 0, 0.7)",

      // Neutral colors (lighter grays)
      neutral: "#a3a3a3",
      neutralHover: "#d4d4d4",
      neutralActive: "#e5e5e5",
    },
    buttons: {
      ghost: {
        background: "transparent",
        text: "colors.text",
        border: "transparent",
        backgroundHover: "colors.surfaceSecondary",
        textHover: "colors.text",
        borderHover: "transparent",
        backgroundActive: "colors.surfaceHover",
        textActive: "colors.text",
        borderActive: "transparent",
      },
      text: {
        text: "colors.link",
        textHover: "colors.linkHover",
        textActive: "colors.linkActive",
      },
    },
    cards: {
      basic: {
        background: "colors.surfaceSecondary",
        border: "colors.borderStrong",
        backgroundHover: "colors.surfaceSecondary",
        borderHover: "colors.border",
      },
      highlighted: {
        background: "colors.surfaceSecondary",
        border: "colors.primary",
        backgroundHover: "colors.surfaceSecondary",
        borderHover: "colors.primaryHover",
      },
      outlined: {
        background: "colors.surfaceSecondary",
        border: "colors.border",
        backgroundHover: "colors.surfaceSecondary",
        borderHover: "colors.border",
      },
      interactive: {
        background: "colors.surfaceSecondary",
        border: "colors.borderStrong",
        backgroundHover: "colors.surfaceSecondary",
        borderHover: "colors.primary",
      },
      ghost: {
        background: "transparent",
        border: "colors.borderStrong",
        backgroundHover: "transparent",
        borderHover: "colors.border",
      },
      elevated: {
        background: "colors.surfaceSecondary",
        border: "colors.primary",
        backgroundHover: "colors.surfaceSecondary",
        borderHover: "colors.primary",
      },
    },
  },
};
