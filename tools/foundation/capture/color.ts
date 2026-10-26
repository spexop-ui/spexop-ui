import Color from "colorjs.io";
// Reused from packages/theme/src/utils/color.ts at 5466b715; Theme source is unchanged.
/** CSS parsing is delegated to Color.js; no fallback to black. CSS parsing follows Color.js normalization. */
export function parseColor(value: string): Color {
    if (typeof value !== "string" || !value.trim() || /[;{}]|\/\*/.test(value))
        throw new Error("Invalid color");
    const color = new Color(value);
    if (!color.coords.every((x) => x !== null && Number.isFinite(x)) ||
        !Number.isFinite(color.alpha) ||
        color.alpha < 0 ||
        color.alpha > 1)
        throw new Error("Color needs finite components and alpha in [0,1]");
    return color;
}
export function colorValue(value: string) {
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
