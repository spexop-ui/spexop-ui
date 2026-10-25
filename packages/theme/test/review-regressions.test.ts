import { describe, it, expect } from "vitest";
import postcss from "postcss";
import { compile } from "tailwindcss";
import {
  createTheme,
  generateCSS,
  generateDTCG,
  generateTailwind,
  resolveTheme,
  ContrastLevel,
  meetsMinimumContrast,
  batchCheckContrast,
  optimizeThemeContrast,
} from "../src/index.js";
import { fixture } from "./fixture.js";
function modes(css: string) {
  const root = postcss.parse(css);
  const declarations = (node: postcss.Container | undefined) => {
    const values: Record<string, string> = {};
    node?.walkDecls((d) => {
      values[d.prop] = d.value;
    });
    return values;
  };
  return {
    light: declarations(
      root.nodes.find(
        (n) => n.type === "rule" && n.selector === ":root",
      ) as postcss.Rule,
    ),
    dark: declarations(
      root.nodes.find(
        (n) => n.type === "rule" && n.selector.includes('[data-theme="dark"]'),
      ) as postcss.Rule,
    ),
    auto: declarations(
      root.nodes.find(
        (n) => n.type === "atrule" && n.name === "media",
      ) as postcss.AtRule,
    ),
  };
}
describe("independently reported PR regressions", () => {
  it("R01 expands primary fallbacks and danger alias in both modes", () => {
    const t = fixture();
    t.colors.error = "#a00";
    t.darkMode!.colors!.error = "#f99";
    const m = modes(generateCSS(t));
    expect(m.dark["--theme-primary-hover"]).toBe(t.darkMode!.colors!.primary);
    expect(m.dark["--theme-primary-active"]).toBe(t.darkMode!.colors!.primary);
    expect(m.dark["--theme-danger"]).toBe("#f99");
  });
  it.each(["2px", "0.1rem", "2", 0])(
    "R02 preserves button width units and zero: %s",
    (width) => {
      const t = fixture();
      t.buttons = {
        primary: {
          borderWidth: width as string,
          borderHoverWidth: width as string,
        },
      };
      const m = modes(generateCSS(t));
      const expected =
        typeof width === "number" || width === "2" ? `${width}px` : width;
      expect(m.light["--theme-button-primary-border-width"]).toBe(expected);
      expect(m.light["--theme-button-primary-border-width-hover"]).toBe(
        expected,
      );
    },
  );
  it("R03 gives resolved card dimensions units", () => {
    const t = fixture();
    t.cards = { outlined: { borderWidth: "borders.thick" } };
    expect(
      modes(generateCSS(t)).light["--theme-card-outlined-border-width"],
    ).toBe("4px");
  });
  it("R04 uses the same custom color names in light, dark and Tailwind", () => {
    const t = fixture();
    Object.assign(t.colors, { brandColor: "#123", brandHover: "#456" });
    const m = modes(generateCSS(t));
    expect(m.light["--theme-brand-color"]).toBe("#123");
    expect(m.light["--theme-brand-hover"]).toBe("#456");
    expect(m.dark["--theme-brand-color"]).toBe("#123");
    expect(generateTailwind(t)).toContain(
      "--color-brand-color: var(--theme-brand-color)",
    );
  });
  it("R05 emits all defined zero widths and radii", () => {
    const t = fixture();
    for (const key of [
      "thin",
      "thick",
      "radiusSubtle",
      "radiusRelaxed",
      "radiusPill",
    ] as const)
      t.borders[key] = 0;
    const m = modes(generateCSS(t));
    for (const key of [
      "border-thin",
      "border-thick",
      "radius-subtle",
      "radius-base",
      "radius-relaxed",
      "radius-medium",
      "radius-pill",
    ])
      expect(m.light[`--theme-${key}`]).toBe("0px");
  });
  it("R06 resolves form aliases in explicit dark mode", () => {
    const t = fixture();
    t.forms = { input: { text: "colors.text", background: "colors.surface" } };
    const m = modes(generateCSS(t));
    expect(m.dark["--theme-form-input-text"]).toBe("#fff");
    expect(m.dark["--theme-form-input-bg"]).toBe("#111");
  });
  it("R07 emits the same component tokens for system and explicit dark mode", () => {
    const t = fixture();
    t.buttons = { primary: { background: "colors.primary" } };
    t.cards = { basic: { background: "colors.surface" } };
    t.dividers = { default: { color: "colors.border" } };
    t.forms = { input: { text: "colors.text" } };
    const m = modes(generateCSS(t));
    expect(m.auto).toEqual(m.dark);
    expect(m.auto["--theme-button-primary-bg"]).toBe(
      t.darkMode!.colors!.primary,
    );
    expect(m.auto["--theme-card-basic-bg"]).toBe("#111");
  });
  it("R08 compiles Tailwind utilities for dark-only colors", async () => {
    const t = fixture();
    t.darkMode!.colors!.accent = "#abc";
    const compiler = await compile(
      generateTailwind(t) + "\n@tailwind utilities;",
    );
    expect(compiler.build(["dark:bg-accent"])).toContain("var(--theme-accent)");
  });
  it.each([undefined, [0, 0, 8]])(
    "R09 exports the same spacing set and values to CSS and DTCG: %s",
    (scale) => {
      const t = fixture();
      delete t.spacing.values;
      if (scale) t.spacing.scale = scale;
      const m = modes(generateCSS(t));
      const dtcg = JSON.parse(generateDTCG(t));
      const cssKeys = Object.keys(m.light)
        .filter((k) => k.startsWith("--theme-spacing-"))
        .map((k) => k.replace("--theme-spacing-", ""))
        .sort();
      expect(Object.keys(dtcg.light.spacing.values).sort()).toEqual(cssKeys);
      for (const key of cssKeys)
        expect(m.light[`--theme-spacing-${key}`]).toBe(
          `${dtcg.light.spacing.values[key].$value.value}px`,
        );
    },
  );
  it("R10 exports CSS family lists with quoted commas and escaped characters as individual names", () => {
    const t = fixture();
    t.typography.fontFamily =
      '"Font, Name", "Font\\20 With\\20 Spaces", system-ui, sans-serif';
    const doc = JSON.parse(generateDTCG(t));
    expect(doc.light.typography.fontFamily.$value).toEqual([
      "Font, Name",
      "Font With Spaces",
      "system-ui",
      "sans-serif",
    ]);
  });
  it("R11 honors the exported AA_LARGE contrast level", () => {
    expect(meetsMinimumContrast("#000", "#fff", ContrastLevel.AA_LARGE)).toBe(
      true,
    );
    expect(meetsMinimumContrast("#bbb", "#fff", ContrastLevel.AA_LARGE)).toBe(
      false,
    );
    expect(
      batchCheckContrast([{ foreground: "#000", background: "#fff" }], {
        level: ContrastLevel.AA_LARGE,
      }).passing,
    ).toBe(1);
  });
  it("R12 evaluates modern-color palettes and rejects unavailable checks", () => {
    const r = optimizeThemeContrast({
      black: "rgb(0 0 0)",
      white: "hsl(0 0% 100%)",
    });
    expect(r.compliant).toHaveLength(2);
    expect(() =>
      optimizeThemeContrast({ a: "oklch(0.7 0.4 30)", b: "#fff" }),
    ).toThrow();
  });
  it("R13 merges partial variant properties before resolving the dark tree", () => {
    const t = fixture();
    t.buttons = {
      primary: { background: "colors.primary", text: "colors.text" },
    };
    t.cards = {
      basic: { background: "colors.surface", border: "colors.border" },
    };
    t.darkMode!.buttons = { primary: { text: "#eee" } };
    t.darkMode!.cards = { basic: { border: "#bbb" } };
    const dark = resolveTheme(t, "dark");
    expect(dark.buttons!.primary!.background).toBe(t.darkMode!.colors!.primary);
    expect(dark.buttons!.primary!.text).toBe("#eee");
    expect(dark.cards!.basic!.background).toBe("#111");
  });
  it.each([false, true])(
    "R14 accepts omitted optional dark color object, enabled=%s",
    (enabled) => {
      const t = fixture();
      t.darkMode = { enabled };
      expect(() => createTheme(t)).not.toThrow();
      expect(() => generateCSS(t)).not.toThrow();
    },
  );
  it.each([
    { enabled: true, minSizeMultiplier: -1 },
    { enabled: true, customSizes: { base: { min: 12 } } },
    { enabled: true, minViewport: 0 },
    { enabled: true, maxSizeMultiplier: Infinity },
  ])("R15 rejects invalid fluid typography %s", (fluid) => {
    const t = fixture();
    t.fluidTypography = fluid as typeof t.fluidTypography;
    expect(() => generateCSS(t)).toThrow();
  });
  it("R15 accepts a valid custom fluid range", () => {
    const t = fixture();
    t.fluidTypography = {
      enabled: true,
      customSizes: { base: { min: 14, max: 20 } },
    };
    expect(generateCSS(t)).toContain("clamp(");
  });
});

it.each(['"Unclosed, serif', "Font,", '"Font" suffix'])(
  "rejects malformed CSS font families: %s",
  (font) => {
    const t = fixture();
    t.typography.fontFamily = font;
    expect(() => generateDTCG(t)).toThrow();
    expect(() => generateCSS(t)).toThrow();
  },
);
it("rejects colliding normalized color names rather than overwriting", () => {
  const t = fixture();
  Object.assign(t.colors, { brandColor: "#123", "brand-color": "#456" });
  expect(() => generateCSS(t)).toThrow(/collision/);
  expect(() => generateTailwind(t)).toThrow(/collision/);
});
it("preserves custom fluid sizes and compression-sensitive family names", () => {
  const t = fixture();
  t.typography.fontFamily = '"Font  A: B", serif';
  t.fluidTypography = {
    enabled: true,
    customSizes: { caption: { min: 12, max: 16 } },
  };
  const css = generateCSS(t, { compress: true });
  expect(css).toContain('"Font  A: B", serif');
  expect(css).toContain("--theme-font-size-caption: clamp(");
});
it("keeps additional scale steps in both CSS and DTCG", () => {
  const t = fixture();
  delete t.spacing.values;
  t.spacing.scale = Array.from({ length: 14 }, (_, i) => i * 3);
  expect(modes(generateCSS(t)).light["--theme-spacing-13"]).toBe("39px");
  expect(
    JSON.parse(generateDTCG(t)).light.spacing.values["13"].$value.value,
  ).toBe(39);
});
