import Color from "colorjs.io";

/** CSS parsing is delegated to Color.js; no fallback to black. CSS parsing follows Color.js normalization. */
export function parseColor(value: string): Color {
  if (typeof value !== "string" || !value.trim() || /[;{}]|\/\*/.test(value))
    throw new Error("Invalid color");
  const color = new Color(value);
  if (
    !color.coords.every((x) => x !== null && Number.isFinite(x)) ||
    !Number.isFinite(color.alpha) ||
    color.alpha < 0 ||
    color.alpha > 1
  )
    throw new Error("Color needs finite components and alpha in [0,1]");
  return color;
}

/** WCAG contrast is scoped to opaque, in-sRGB colors; unavailable checks throw. */
export function contrastRgb(value: string): {
  r: number;
  g: number;
  b: number;
} {
  const color = parseColor(value);
  if (color.alpha !== 1)
    throw new Error(
      "Contrast requires an opaque color or an explicit composited background",
    );
  if (!color.inGamut("srgb", { epsilon: 0.000001 }))
    throw new Error("Contrast outside sRGB is not evaluated");
  const rgb = color.to("srgb").coords as number[];
  return { r: rgb[0] * 255, g: rgb[1] * 255, b: rgb[2] * 255 };
}

export function colorToDTCG(value: string) {
  const color = parseColor(value);
  // Preserve wide gamut OKLCH; HSL and HEX/RGB are losslessly represented in sRGB.
  const space = color.space.id === "oklch" ? "oklch" : "srgb";
  const converted = color.to(space);
  if (space === "srgb" && !converted.inGamut())
    throw new Error("Unsupported out-of-gamut export; use OKLCH");
  const components = converted.coords.map((v, i) => {
    const n = v as number;
    return space === "oklch" && i === 2 ? ((n % 360) + 360) % 360 : n;
  });
  return { colorSpace: space, components, alpha: color.alpha };
}
