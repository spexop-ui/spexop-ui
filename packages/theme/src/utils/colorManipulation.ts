/**
 * Color Manipulation Utilities
 * HSL, RGB, HEX conversions and color transformations
 */

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Convert HEX color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to HEX
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / delta + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r: number;
  let g: number;
  let b: number;

  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tNorm = t;
      if (tNorm < 0) tNorm += 1;
      if (tNorm > 1) tNorm -= 1;
      if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
      if (tNorm < 1 / 2) return q;
      if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
      return p;
    };

    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;

    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert HEX to HSL
 */
export function hexToHsl(hex: string): HSL {
  const rgb = hexToRgb(hex);
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/**
 * Convert HSL to HEX
 */
export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Adjust lightness of a color
 * @param hex - Input color in HEX format
 * @param amount - Amount to adjust lightness (-100 to 100)
 */
export function adjustLightness(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  const newL = Math.max(0, Math.min(100, hsl.l + amount));
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Adjust saturation of a color
 * @param hex - Input color in HEX format
 * @param amount - Amount to adjust saturation (-100 to 100)
 */
export function adjustSaturation(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  const newS = Math.max(0, Math.min(100, hsl.s + amount));
  return hslToHex(hsl.h, newS, hsl.l);
}

/**
 * Adjust hue of a color
 * @param hex - Input color in HEX format
 * @param amount - Amount to adjust hue (-360 to 360)
 */
export function adjustHue(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  const newH = (hsl.h + amount + 360) % 360;
  return hslToHex(newH, hsl.s, hsl.l);
}

/**
 * Lighten a color by a percentage
 */
export function lighten(hex: string, percent: number): string {
  return adjustLightness(hex, percent);
}

/**
 * Darken a color by a percentage
 */
export function darken(hex: string, percent: number): string {
  return adjustLightness(hex, -percent);
}

/**
 * Saturate a color by a percentage
 */
export function saturate(hex: string, percent: number): string {
  return adjustSaturation(hex, percent);
}

/**
 * Desaturate a color by a percentage
 */
export function desaturate(hex: string, percent: number): string {
  return adjustSaturation(hex, -percent);
}

/**
 * Get a grayscale version of a color
 */
export function grayscale(hex: string): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, 0, hsl.l);
}

/**
 * Invert a color
 */
export function invert(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
}

/**
 * Check if a color is light or dark
 * Returns true if the color is light (lightness > 50%)
 */
export function isLight(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return hsl.l > 50;
}

/**
 * Check if a color is dark
 * Returns true if the color is dark (lightness <= 50%)
 */
export function isDark(hex: string): boolean {
  return !isLight(hex);
}

/**
 * Mix two colors
 * @param color1 - First color in HEX format
 * @param color2 - Second color in HEX format
 * @param weight - Weight of first color (0-100), default 50
 */
export function mix(color1: string, color2: string, weight = 50): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const w = weight / 100;

  const r = Math.round(rgb1.r * w + rgb2.r * (1 - w));
  const g = Math.round(rgb1.g * w + rgb2.g * (1 - w));
  const b = Math.round(rgb1.b * w + rgb2.b * (1 - w));

  return rgbToHex(r, g, b);
}

/**
 * Get complementary color (opposite on color wheel)
 */
export function complementary(hex: string): string {
  return adjustHue(hex, 180);
}

/**
 * Generate a color palette from a base color
 * Returns an array of colors with different lightness values
 */
export function generatePalette(
  hex: string,
  steps = 10,
): { shade: number; color: string }[] {
  const palette: { shade: number; color: string }[] = [];
  const hsl = hexToHsl(hex);

  for (let i = 0; i < steps; i++) {
    const shade = (i + 1) * (100 / (steps + 1));
    const l = 95 - i * (90 / (steps - 1)); // 95% to 5%
    palette.push({
      shade: Math.round(shade * 10), // 50, 100, 150, ... 900
      color: hslToHex(hsl.h, hsl.s, l),
    });
  }

  return palette;
}
