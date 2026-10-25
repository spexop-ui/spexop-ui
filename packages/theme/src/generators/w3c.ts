/** DTCG 2025.10 Format/Color subset: independent light/dark token groups. */
import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
import {
  expandSpacing,
  expandColors,
  fontFamilies,
} from "../utils/foundationTokens.js";
import { assertTheme } from "../validators/validateTheme.js";
import { colorToDTCG } from "../utils/color.js";
import { referencePath, resolveTheme } from "../utils/tokenResolver.js";
type Token = { $type: string; $value: unknown };
type Group = { [key: string]: Token | Group };
const token = (type: string, value: unknown): Token => ({
  $type: type,
  $value: value,
});
const dimension = (n: number) => token("dimension", { value: n, unit: "px" });
function modeTokens(source: SpexopThemeConfig, mode: "light" | "dark"): Group {
  const effective = resolveTheme(source, mode);
  const rawColors = expandColors(
    mode === "dark"
      ? { ...source.colors, ...source.darkMode?.colors }
      : source.colors,
  );
  const colors: Group = {};
  for (const k of Object.keys(rawColors).sort()) {
    const value = rawColors[k as keyof typeof rawColors]!;
    const ref = referencePath(value);
    if (ref && !ref.startsWith("colors."))
      throw new Error("DTCG color alias must reference a color token");
    colors[k] = token("color", ref ? `{${mode}.${ref}}` : colorToDTCG(value));
  }
  const values = expandSpacing(effective.spacing);
  const group: Group = {
    colors,
    spacing: {
      values: Object.fromEntries(
        Object.entries(values)
          .sort(([a], [b]) => a.localeCompare(b, "en"))
          .map(([k, v]) => [k, dimension(v)]),
      ),
      baseUnit: dimension(effective.spacing.baseUnit),
    },
    typography: {
      fontFamily: token(
        "fontFamily",
        fontFamilies(effective.typography.fontFamily),
      ),
      baseSize: dimension(effective.typography.baseSize),
      scale: token("number", effective.typography.scale),
      weights: Object.fromEntries(
        Object.entries(effective.typography.weights).map(([k, v]) => [
          k,
          token("fontWeight", v),
        ]),
      ),
      lineHeights: Object.fromEntries(
        Object.entries(effective.typography.lineHeights).map(([k, v]) => [
          k,
          token("number", v),
        ]),
      ),
      ...(effective.typography.sizes
        ? {
            sizes: Object.fromEntries(
              Object.entries(effective.typography.sizes).map(([k, v]) => [
                k,
                dimension(v),
              ]),
            ),
          }
        : {}),
    },
    borders: Object.fromEntries(
      Object.entries(effective.borders)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, dimension(v as number)]),
    ),
  };
  // Preserve representable aliases beyond colors; unsupported targets fail, never flatten silently.
  const raw = mode === "dark" ? { ...source, colors: rawColors } : source;
  function preserve(node: Group, path: string[] = []): void {
    for (const [key, value] of Object.entries(node)) {
      const parts = [...path, key];
      if ("$value" in value) {
        let original: unknown = raw;
        for (const part of parts)
          original =
            original && typeof original === "object"
              ? (original as Record<string, unknown>)[part]
              : undefined;
        const ref = referencePath(original);
        if (ref) (value as Token).$value = `{${mode}.${ref}}`;
      } else preserve(value as Group, parts);
    }
  }
  preserve(group);
  return group;
}
export function generateDTCG(config: SpexopThemeConfig): string {
  assertTheme(config);
  const document = {
    $extensions: {
      "com.spexop.theme": {
        format: "2025.10",
        modeGroups: config.darkMode?.enabled ? ["light", "dark"] : ["light"],
        source: structuredClone(config),
      },
    },
    light: modeTokens(config, "light"),
    ...(config.darkMode?.enabled ? { dark: modeTokens(config, "dark") } : {}),
  };
  const json = JSON.stringify(document, null, 2) + "\n";
  readDTCG(json);
  return json;
}
export const generateW3C = generateDTCG;
/** Reads this slice's emitted DTCG types; unsupported features fail explicitly, never disappear. */
export function readDTCG(json: string): Record<string, unknown> {
  const doc: unknown = JSON.parse(json);
  if (!doc || typeof doc !== "object" || Array.isArray(doc))
    throw new Error("DTCG document must be an object");
  const tokens = new Map<string, Token>();
  function walk(node: unknown, path: string[], inherited?: string): void {
    if (!node || typeof node !== "object" || Array.isArray(node))
      throw new Error(`Invalid group ${path.join(".")}`);
    const o = node as Record<string, unknown>;
    if ("$value" in o) {
      if (
        Object.keys(o).some(
          (k) =>
            ![
              "$value",
              "$type",
              "$description",
              "$extensions",
              "$deprecated",
            ].includes(k),
        )
      )
        throw new Error(
          "Token must not contain child tokens or unsupported properties",
        );
      const type = typeof o.$type === "string" ? o.$type : inherited;
      tokens.set(path.join("."), { $type: type ?? "", $value: o.$value });
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (["$extensions", "$description", "$type"].includes(k)) continue;
      if (k.startsWith("$") || /[.{}]/.test(k) || !k)
        throw new Error(`Unsupported DTCG key: ${k}`);
      walk(v, [...path, k], typeof o.$type === "string" ? o.$type : inherited);
    }
  }
  walk(doc, []);
  const resolve = (path: string, seen = new Set<string>()): Token => {
    if (seen.has(path)) throw new Error(`Circular DTCG reference ${path}`);
    const t = tokens.get(path);
    if (!t) throw new Error(`Missing DTCG reference ${path}`);
    if (typeof t.$value === "string" && t.$value.startsWith("{")) {
      if (!/^\{[^{}]+\}$/.test(t.$value))
        throw new Error("Malformed DTCG alias");
      const target = resolve(t.$value.slice(1, -1), new Set(seen).add(path));
      if (t.$type && t.$type !== target.$type)
        throw new Error("DTCG alias type mismatch");
      return target;
    }
    return t;
  };
  for (const key of tokens.keys()) {
    const t = resolve(key),
      v = t.$value;
    if (t.$type === "color") {
      if (!v || typeof v !== "object")
        throw new Error("DTCG color must be an object");
      const c = v as {
        colorSpace: string;
        components: number[];
        alpha?: number;
      };
      if (
        !["srgb", "oklch"].includes(c.colorSpace) ||
        !Array.isArray(c.components) ||
        c.components.length !== 3 ||
        !c.components.every(Number.isFinite)
      )
        throw new Error("Unsupported or invalid DTCG color");
      if (c.colorSpace === "srgb" && c.components.some((x) => x < 0 || x > 1))
        throw new Error("Invalid sRGB component");
      if (
        c.colorSpace === "oklch" &&
        (c.components[0] < 0 ||
          c.components[0] > 1 ||
          c.components[1] < 0 ||
          c.components[2] < 0 ||
          c.components[2] >= 360)
      )
        throw new Error("Invalid OKLCH component");
      if (
        c.alpha !== undefined &&
        (!Number.isFinite(c.alpha) || c.alpha < 0 || c.alpha > 1)
      )
        throw new Error("Invalid alpha");
    } else if (t.$type === "dimension") {
      const d = v as { value: number; unit: string };
      if (!d || !Number.isFinite(d.value) || !["px", "rem"].includes(d.unit))
        throw new Error("Invalid dimension");
    } else if (t.$type === "number" || t.$type === "fontWeight") {
      if (typeof v !== "number" || !Number.isFinite(v))
        throw new Error("Invalid numeric token");
      if (t.$type === "fontWeight" && (v < 1 || v > 1000))
        throw new Error("Invalid font weight");
    } else if (t.$type === "fontFamily") {
      if (
        !(
          (typeof v === "string" && v.length) ||
          (Array.isArray(v) &&
            v.length &&
            v.every((x) => typeof x === "string" && x.length))
        )
      )
        throw new Error("Invalid font family");
    } else throw new Error(`Unsupported DTCG type ${t.$type}`);
  }
  if (!tokens.size) throw new Error("No DTCG tokens");
  return doc as Record<string, unknown>;
}
