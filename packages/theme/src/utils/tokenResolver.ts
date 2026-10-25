import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
const roots = new Set([
  "colors",
  "spacing",
  "typography",
  "borders",
  "radii",
  "shadows",
  "zIndex",
  "buttons",
  "cards",
  "dividers",
  "forms",
  "breakpoints",
  "animations",
  "opacity",
  "grid",
  "modals",
  "navigation",
]);
export function referencePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("{") || value.endsWith("}")) {
    if (!/^\{[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+\}$/.test(value))
      throw new Error("Malformed token reference");
    return value.slice(1, -1);
  }
  return roots.has(value.split(".")[0]) &&
    /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/.test(value)
    ? value
    : null;
}
export function isTokenReference(value: string | number): boolean {
  return referencePath(value) !== null;
}
export function resolveToken(
  reference: string | number,
  config: SpexopThemeConfig,
  visited = new Set<string>(),
): string | number {
  const path = referencePath(reference);
  if (!path) return reference;
  if (visited.has(path))
    throw new Error(
      `Circular token reference: ${[...visited, path].join(" -> ")}`,
    );
  const next = new Set(visited).add(path);
  let value: unknown = config;
  for (const part of path.split(".")) {
    if (
      !value ||
      typeof value !== "object" ||
      !Object.hasOwn(value, part) ||
      ["__proto__", "prototype", "constructor"].includes(part)
    )
      throw new Error(`Missing token reference: ${path}`);
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error(`Token must reference a scalar: ${path}`);
  return resolveToken(value, config, next);
}
export function resolveTree<T>(value: T, config: SpexopThemeConfig): T {
  if (typeof value === "string" || typeof value === "number")
    return resolveToken(value, config) as T;
  if (Array.isArray(value))
    return value.map((x) => resolveTree(x, config)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveTree(v, config)]),
    ) as T;
  return value;
}
/** Merge partial variant properties without mutating base or override objects. */
function mergeVariants<T extends object>(
  base: T | undefined,
  overrides: T | undefined,
): T | undefined {
  if (!base && !overrides) return undefined;
  const result = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides ?? {}))
    result[key] = { ...((result[key] as object) ?? {}), ...(value as object) };
  return result as T;
}
/** Return independent effective-mode values; never mutate caller input. */
export function resolveTheme(
  config: SpexopThemeConfig,
  mode: "light" | "dark" = "light",
): SpexopThemeConfig {
  if (mode !== "light" && mode !== "dark")
    throw new Error("Unknown theme mode");
  if (mode === "dark" && !config.darkMode?.enabled)
    throw new Error("Dark mode is not enabled");
  const { darkMode, ...base } = config;
  const effective =
    mode === "dark"
      ? {
          ...base,
          colors: { ...base.colors, ...darkMode?.colors },
          buttons: mergeVariants(base.buttons, darkMode?.buttons),
          cards: mergeVariants(base.cards, darkMode?.cards),
          dividers: mergeVariants(base.dividers, darkMode?.dividers),
        }
      : base;
  return resolveTree(effective, effective);
}
