import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
import { validateFluidTypography } from "../utils/fluidTypography.js";
import { fontFamilies, expandColors } from "../utils/foundationTokens.js";
import { parseColor } from "../utils/color.js";
import { resolveTheme } from "../utils/tokenResolver.js";
export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
export function validateTheme(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message, severity: "error" });
  if (!object(input))
    return {
      valid: false,
      errors: [
        { field: "$", message: "Theme must be an object", severity: "error" },
      ],
    };
  for (const k of ["meta", "colors", "typography", "spacing", "borders"])
    if (!object(input[k])) fail(k, "Required object");
  if (errors.length) return { valid: false, errors };
  const theme = input as unknown as SpexopThemeConfig;
  // Validate optional container shapes before resolution can merge/discard them.
  const components = ["buttons", "cards", "dividers", "forms"] as const;
  const checkComponents = (source: Record<string, unknown>, path: string) => {
    for (const group of components) {
      const value = source[group];
      if (value === undefined) continue;
      if (!object(value)) fail(`${path}.${group}`, "Expected variant object");
      else
        for (const [key, style] of Object.entries(value))
          if (!object(style))
            fail(`${path}.${group}.${key}`, "Expected style object");
    }
  };
  checkComponents(input, "$");
  if (object(input.darkMode)) checkComponents(input.darkMode, "darkMode");
  for (const group of [
    "radii",
    "shadows",
    "zIndex",
    "breakpoints",
    "opacity",
    "animations",
  ])
    if (input[group] !== undefined && !object(input[group]))
      fail(group, "Expected object");
  for (const [group, keys] of [
    ["typography", ["sizes"]],
    ["spacing", ["values"]],
    ["animations", ["durations", "easings", "transitions"]],
  ] as const) {
    const values = input[group];
    if (object(values))
      for (const key of keys)
        if (values[key] !== undefined && !object(values[key]))
          fail(`${group}.${key}`, "Expected object");
  }
  for (const k of ["name", "version"] as const)
    if (typeof theme.meta[k] !== "string" || !theme.meta[k].trim())
      fail(`meta.${k}`, "Required nonempty string");
  for (const k of [
    "primary",
    "surface",
    "surfaceSecondary",
    "surfaceHover",
    "text",
    "textSecondary",
    "textMuted",
    "border",
    "borderStrong",
    "borderSubtle",
  ])
    if (
      typeof (theme.colors as unknown as Record<string, unknown>)[k] !==
      "string"
    )
      fail(`colors.${k}`, "Required color");
  if (
    typeof theme.typography.fontFamily !== "string" ||
    !theme.typography.fontFamily.trim()
  )
    fail("typography.fontFamily", "Required font family");
  const positive = (path: string, v: unknown) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0)
      fail(path, "Expected positive finite number");
  };
  positive("typography.baseSize", theme.typography.baseSize);
  positive("typography.scale", theme.typography.scale);
  positive("spacing.baseUnit", theme.spacing.baseUnit);
  for (const [group, keys] of [
    ["weights", ["regular", "medium", "semibold", "bold"]],
    ["lineHeights", ["tight", "snug", "normal", "relaxed"]],
  ] as const) {
    const values = theme.typography[group];
    if (!object(values)) fail(`typography.${group}`, "Required object");
    else for (const k of keys) positive(`typography.${group}.${k}`, values[k]);
  }
  for (const k of [
    "thin",
    "default",
    "thick",
    "radiusSubtle",
    "radiusRelaxed",
    "radiusPill",
  ] as const) {
    const n = theme.borders[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
      fail(`borders.${k}`, "Expected nonnegative finite number");
  }
  if (!["solid", "dashed", "dotted"].includes(theme.borders.defaultStyle))
    fail("borders.defaultStyle", "Invalid border style");
  if (
    theme.darkMode !== undefined &&
    (!object(theme.darkMode) ||
      typeof theme.darkMode.enabled !== "boolean" ||
      (theme.darkMode.colors !== undefined && !object(theme.darkMode.colors)))
  )
    fail("darkMode", "Expected enabled boolean and optional colors object");
  const seen = new WeakSet<object>();
  function walk(v: unknown, path: string): void {
    if (typeof v === "number" && !Number.isFinite(v))
      fail(path, "Expected finite value");
    if (
      v === null ||
      v === undefined ||
      typeof v === "function" ||
      typeof v === "symbol" ||
      typeof v === "bigint"
    )
      fail(path, "Unsupported value");
    if (
      typeof v === "string" &&
      /[;{}]|\/\*|\*\//.test(v) &&
      !/^\{[\w-]+(?:\.[\w-]+)+\}$/.test(v)
    )
      fail(path, "Unsafe CSS or malformed reference");
    if (v && typeof v === "object") {
      if (seen.has(v)) {
        fail(path, "Cyclic input object");
        return;
      }
      seen.add(v);
      for (const [k, x] of Object.entries(v)) {
        if (
          !/^[A-Za-z0-9_-]+$/.test(k) ||
          ["__proto__", "constructor", "prototype"].includes(k)
        )
          fail(path, "Unsafe key");
        walk(x, `${path}.${k}`);
      }
      seen.delete(v);
    }
  }
  walk(input, "$");
  if (!errors.length)
    for (const mode of [
      "light",
      ...(theme.darkMode?.enabled ? ["dark"] : []),
    ] as ("light" | "dark")[]) {
      try {
        const effective = resolveTheme(theme, mode);
        for (const [k, v] of Object.entries(effective.colors)) {
          try {
            parseColor(v);
          } catch (e) {
            fail(`${mode}.colors.${k}`, String(e));
          }
        }
        for (const [k, v] of Object.entries(effective.typography.sizes ?? {}))
          positive(`typography.sizes.${k}`, v);
        for (const [k, v] of Object.entries(effective.typography.weights))
          if (typeof v !== "number" || v < 1 || v > 1000)
            fail(
              `typography.weights.${k}`,
              "Font weight must be between 1 and 1000",
            );
        fontFamilies(effective.typography.fontFamily);
        for (const key of ["fontFamilyHeading", "fontFamilyMono"] as const)
          if (effective.typography[key] !== undefined)
            fontFamilies(effective.typography[key]!);
        for (const [key, value] of Object.entries(
          effective.typography.lineHeights,
        ))
          positive(`typography.lineHeights.${key}`, value);
        const nonnegative = (path: string, value: unknown) => {
          if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
            fail(path, "Expected nonnegative finite number");
        };
        for (const [group, values] of Object.entries({
          radii: effective.radii,
          breakpoints: effective.breakpoints,
          "animations.durations": effective.animations?.durations,
        }))
          for (const [key, value] of Object.entries(values ?? {}))
            nonnegative(`${group}.${key}`, value);
        if (effective.borders.radiusLiquid !== undefined)
          nonnegative("borders.radiusLiquid", effective.borders.radiusLiquid);
        for (const [key, value] of Object.entries(effective.opacity ?? {}))
          if (typeof value !== "number" || value < 0 || value > 1)
            fail(`opacity.${key}`, "Expected opacity between 0 and 1");
        for (const [key, value] of Object.entries(effective.zIndex ?? {}))
          if (!Number.isInteger(value))
            fail(`zIndex.${key}`, "Expected integer layer");
        for (const group of components)
          for (const [variant, style] of Object.entries(
            effective[group] ?? {},
          )) {
            for (const [key, value] of Object.entries(style)) {
              const path = `${mode}.${group}.${variant}.${key}`;
              if (key === "borderStyle") {
                if (!["solid", "dashed", "dotted"].includes(String(value)))
                  fail(path, "Invalid border style");
              } else if (key === "borderWidth" || key === "borderHoverWidth") {
                // Legacy widths are pixel numbers/references or literal CSS lengths.
                if (
                  !(
                    typeof value === "number" &&
                    Number.isFinite(value) &&
                    value >= 0
                  ) &&
                  !(
                    typeof value === "string" &&
                    /^(?:thin|medium|thick|\+?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|ch|ex|cap|ic|lh|rlh|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cm|mm|q|in|pt|pc)?)$/i.test(
                      value.trim(),
                    )
                  )
                )
                  fail(path, "Expected nonnegative border width");
              } else {
                // The remaining fields in these legacy variant interfaces are colors.
                try {
                  parseColor(value as string);
                } catch (e) {
                  fail(path, String(e));
                }
              }
            }
          }
        expandColors(effective.colors);
        if (effective.fluidTypography) {
          const fluid = validateFluidTypography(effective.fluidTypography);
          for (const message of fluid.errors) fail("fluidTypography", message);
        }
        for (const [k, v] of Object.entries(effective.spacing.values ?? {}))
          if (typeof v !== "number" || v < 0)
            fail(`spacing.values.${k}`, "Expected nonnegative spacing");
        if (
          effective.spacing.scale &&
          (!Array.isArray(effective.spacing.scale) ||
            effective.spacing.scale.some((x) => typeof x !== "number" || x < 0))
        )
          fail("spacing.scale", "Expected nonnegative spacing array");
      } catch (e) {
        fail(mode, String(e));
      }
    }
  return { valid: errors.length === 0, errors };
}
export function assertTheme(
  input: unknown,
): asserts input is SpexopThemeConfig {
  const result = validateTheme(input);
  if (!result.valid)
    throw new Error(
      result.errors.map((e) => `${e.field}: ${e.message}`).join("\n"),
    );
}
export function createTheme(input: unknown): SpexopThemeConfig {
  assertTheme(input);
  return structuredClone(input);
}
