import type { SpexopThemeConfig } from "@spexop/theme";
export function fixture(): SpexopThemeConfig {
  return {
    meta: { name: "Slice 1 fixture", version: "0.1.0" },
    colors: {
      primary: "oklch(45% 0.12 260)",
      surface: "#fff",
      surfaceSecondary: "rgb(245 245 245)",
      surfaceHover: "hsl(0 0% 90%)",
      text: "#111",
      textSecondary: "{colors.text}",
      textMuted: "colors.text",
      border: "#666",
      borderStrong: "#333",
      borderSubtle: "#aaa",
      link: "colors.primary",
    },
    typography: {
      fontFamily: "system-ui, sans-serif",
      baseSize: 16,
      scale: 1.25,
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      lineHeights: { tight: 1.2, snug: 1.375, normal: 1.5, relaxed: 1.75 },
    },
    spacing: { baseUnit: 4, values: { 0: 0, 1: 4, 2: 8 } },
    borders: {
      thin: 1,
      default: 2,
      thick: 4,
      radiusSubtle: 4,
      radiusRelaxed: 8,
      radiusPill: 9999,
      defaultStyle: "solid",
    },
    darkMode: {
      enabled: true,
      colors: { surface: "#111", text: "#fff", primary: "oklch(80% 0.08 260)" },
    },
  };
}
