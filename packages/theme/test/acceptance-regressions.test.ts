import { describe, it, expect } from "vitest";
import {
  createTheme,
  validateTheme,
  generateCSS,
  generateDTCG,
  generateTailwind,
  readDTCG,
} from "../src/index.js";
import { fixture } from "./fixture.js";

describe("OSS-004: optional emitted values cannot silently pass", () => {
  it.each([
    { buttons: { primary: { background: "not-a-color" } } },
    { buttons: { primary: { background: "{spacing.baseUnit}" } } },
    { cards: { outlined: { border: "invalid" } } },
    { buttons: { primary: { borderWidth: "-5px" } } },
    { cards: { outlined: { borderWidth: "garbage" } } },
    { buttons: { primary: { borderWidth: -5 } } },
    { forms: { input: { text: "" } } },
    { dividers: { default: { color: 4 } } },
    { darkMode: { enabled: true, buttons: { primary: { text: "invalid" } } } },
    { cards: "broken" },
    { buttons: { primary: "broken" } },
    { radii: { sm: -1 } },
    { breakpoints: { sm: -1 } },
    { opacity: { disabled: 1.5 } },
    { zIndex: { base: 0.5 } },
    {
      typography: { ...fixture().typography, fontFamilyHeading: '"unfinished' },
    },
    {
      typography: {
        ...fixture().typography,
        weights: { ...fixture().typography.weights, custom: "heavy" },
      },
    },
    {
      typography: {
        ...fixture().typography,
        lineHeights: { ...fixture().typography.lineHeights, custom: -1 },
      },
    },
    { borders: { ...fixture().borders, radiusLiquid: -5 } },
    { spacing: { baseUnit: 4, values: [] } },
    { animations: { durations: { fast: -1 } } },
  ])("rejects invalid optional data %j without mutating it", (override) => {
    const input = { ...fixture(), ...override };
    const before = JSON.stringify(input);
    expect(validateTheme(input).valid).toBe(false);
    expect(() => createTheme(input)).toThrow();
    for (const generate of [generateCSS, generateTailwind, generateDTCG])
      expect(() => generate(input as ReturnType<typeof fixture>)).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
  it("accepts optional modern colors, aliases, zero dimensions and integer layers", () => {
    const input = {
      ...fixture(),
      buttons: { primary: { background: "rgb(1 2 3)", text: "{colors.text}" } },
      cards: { basic: { border: "transparent" } },
      radii: { sm: 0 },
      opacity: { disabled: 0 },
      zIndex: { base: -1 },
      animations: { durations: { fast: 0 } },
      typography: {
        ...fixture().typography,
        fontFamilyHeading: '"A, B", serif',
      },
    };
    expect(validateTheme(input).valid).toBe(true);
    expect(generateCSS(input)).toContain("--theme-radius-sm: 0px");
    expect(generateDTCG(input)).toContain('"light"');
  });
});

describe("OSS-004: DTCG structural and metadata validation", () => {
  it.each([
    { $type: "number", $value: 1 },
    { a: { $type: "number", $value: 1, $description: 3 } },
    { $description: [], a: { $type: "number", $value: 1 } },
    { a: { $type: "number", $value: 1, $extensions: [] } },
    { $extensions: "bad", a: { $type: "number", $value: 1 } },
    { a: { $type: "number", $value: 1, $deprecated: 1 } },
    { $type: "number", a: { $type: 4, $value: 1 } },
  ])("rejects %j", (doc) =>
    expect(() => readDTCG(JSON.stringify(doc))).toThrow(),
  );
  it("retains valid metadata and resolves inherited types", () => {
    const doc = {
      $type: "number",
      $description: "Numbers",
      $extensions: { "org.example": [] },
      a: { $value: 1, $description: "One", $deprecated: false },
      b: { $value: "{a}" },
    };
    expect(readDTCG(JSON.stringify(doc))).toEqual(doc);
  });
});
