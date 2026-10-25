import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
export const tokenName = (key: string): string =>
  key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
export function expandColors(
  colors: SpexopThemeConfig["colors"],
): Record<string, string> {
  const result = {
    ...colors,
    primaryHover: colors.primaryHover ?? colors.primary,
    primaryActive: colors.primaryActive ?? colors.primary,
    ...(colors.error
      ? {
          danger:
            (colors as unknown as Record<string, string>).danger ??
            colors.error,
        }
      : {}),
  };
  const names = new Set<string>();
  for (const key of Object.keys(result)) {
    const name = tokenName(key);
    if (names.has(name))
      throw new Error("Normalized color token name collision");
    names.add(name);
  }
  return result;
}
export function expandSpacing(
  spacing: SpexopThemeConfig["spacing"],
): Record<string, number> {
  if (spacing.values) return { ...spacing.values };
  const keys = new Set([
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    12,
    ...(spacing.scale?.map((_, i) => i) ?? []),
  ]);
  return Object.fromEntries(
    [...keys]
      .sort((a, b) => a - b)
      .map((i) => [i, spacing.scale?.[i] ?? i * spacing.baseUnit]),
  );
}
export function cssLength(value: string | number): string {
  if (typeof value === "number") return `${value}px`;
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())
    ? `${value.trim()}px`
    : value;
}
/** Parse CSS family lists, including quoted commas and CSS character escapes. */
export function fontFamilies(input: string): string[] {
  const families: string[] = [];
  let part = "",
    quote = "",
    quoted = false,
    closed = false;
  const push = () => {
    const family = quoted ? part : part.trim().replace(/\s+/g, " ");
    if (!family) throw new Error("Empty font family");
    families.push(family);
    part = "";
    quoted = false;
    closed = false;
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "\\") {
      if (closed) throw new Error("Unexpected content after font quote");
      const hex = input.slice(i + 1).match(/^[0-9a-fA-F]{1,6}/)?.[0];
      if (hex) {
        const code = parseInt(hex, 16);
        part += String.fromCodePoint(
          code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
            ? 0xfffd
            : code,
        );
        i += hex.length;
        if (/\s/.test(input[i + 1] ?? "")) i++;
      } else {
        const next = input[++i];
        if (next === undefined) throw new Error("Incomplete font escape");
        if (next !== "\n" && next !== "\r") part += next;
      }
    } else if (quote) {
      if (c === quote) {
        quote = "";
        closed = true;
      } else part += c;
    } else if (c === '"' || c === "'") {
      if (part.trim() || closed)
        throw new Error("Unexpected quote in font family");
      part = "";
      quote = c;
      quoted = true;
    } else if (c === ",") push();
    else if (closed) {
      if (!/\s/.test(c)) throw new Error("Unexpected content after font quote");
    } else part += c;
  }
  if (quote) throw new Error("Unterminated font family quote");
  push();
  return families;
}
