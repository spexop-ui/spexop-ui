import { describe, it, expect } from "vitest";
import { parse, Logger, defineConfig } from "@terrazzo/parser";
import { compile } from "tailwindcss";
import postcss from "postcss";
import {
  defaultTheme,
  batchCheckContrast,
  createTheme,
  validateTheme,
  resolveToken,
  resolveTheme,
  isTokenReference,
  validateColor,
  calculateContrastRatio,
  checkContrast,
  fixContrast,
  auditThemeAccessibility,
  generateCSS,
  generateTailwind,
  generateDTCG,
  readDTCG,
} from "../src/index.js";
import { fixture } from "./fixture.js";

describe("model and references", () => {
  it("creates an independent valid theme without mutation", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const result = createTheme(input);
    result.colors.text = "#123";
    expect(JSON.stringify(input)).toBe(before);
    expect(validateTheme(input).valid).toBe(true);
  });
  it.each([null, [], {}, "theme", 42])("rejects invalid input %s", (value) => {
    expect(validateTheme(value).valid).toBe(false);
    expect(() => createTheme(value)).toThrow();
  });
  it("resolves legacy and brace aliases, including dark dependencies", () => {
    const t = fixture();
    expect(resolveToken("colors.textSecondary", t)).toBe("#111");
    expect(resolveTheme(t, "dark").colors.textSecondary).toBe("#fff");
    expect(resolveTheme(t).colors.textSecondary).toBe("#111");
  });
  it.each([
    "oklch(0.6 0.1 240)",
    "1.5rem",
    "Inter Variable, sans-serif",
    "1.0.0",
  ])("does not classify literal %s as alias", (x) =>
    expect(isTokenReference(x)).toBe(false),
  );
  it.each([
    "{colors.missing}",
    "colors.missing",
    "{colors.text",
    "{constructor.name}",
    "{colors.__proto__}",
  ])("rejects missing/malformed/unsafe reference %s", (value) => {
    const t = fixture();
    t.colors.text = value;
    expect(() => createTheme(t)).toThrow();
    expect(() => generateCSS(t)).toThrow();
    expect(() => generateDTCG(t)).toThrow();
  });
  it("rejects cycles without modifying caller data", () => {
    const t = fixture();
    t.colors.text = "colors.textSecondary";
    const before = JSON.stringify(t);
    expect(() => createTheme(t)).toThrow(/Circular/);
    expect(JSON.stringify(t)).toBe(before);
  });
  it("rejects references to objects", () =>
    expect(() => resolveToken("{typography.weights}", fixture())).toThrow(
      /scalar/,
    ));
  it("does not resolve prototype properties", () =>
    expect(() => resolveToken("{colors.constructor}", fixture())).toThrow());
  it("requires dark availability and rejects unknown mode", () => {
    const t = fixture();
    delete t.darkMode;
    expect(() => resolveTheme(t, "dark")).toThrow();
    expect(() => resolveTheme(t, "pink" as "light")).toThrow();
  });
  it.each([NaN, Infinity, -1])("rejects invalid base spacing %s", (v) => {
    const t = fixture();
    t.spacing.baseUnit = v;
    expect(() => generateCSS(t)).toThrow();
  });
  it("preserves zero spacing and rejects negative named spacing", () => {
    const t = fixture();
    t.spacing.values = { 0: 0, 1: 0 };
    expect(generateCSS(t)).toContain("--theme-spacing-1: 0px");
    t.spacing.values[1] = -1;
    expect(() => generateCSS(t)).toThrow();
  });
  it("rejects missing required colors and typography data", () => {
    const t = fixture();
    delete (t.colors as Partial<typeof t.colors>).surface;
    expect(validateTheme(t).valid).toBe(false);
    const u = fixture();
    delete (u.typography as Partial<typeof u.typography>).weights;
    expect(validateTheme(u).valid).toBe(false);
  });
  it("rejects cyclic objects, NaN and CSS injection", () => {
    const t = fixture();
    (t as unknown as Record<string, unknown>).cycle = t;
    expect(validateTheme(t).valid).toBe(false);
    const u = fixture();
    u.typography.fontFamily = "sans-serif; } body { color:red";
    expect(() => generateCSS(u)).toThrow();
  });
});

describe("colors and contrast", () => {
  it.each([
    "#fff",
    "#ffffff",
    "rgb(255 255 255)",
    "rgb(255,255,255)",
    "hsl(0 0% 100%)",
    "oklch(1 0 0)",
  ])("accepts %s and measures against black", (white) => {
    expect(validateColor(white).valid).toBe(true);
    expect(calculateContrastRatio(white, "#000")).toBeCloseTo(21, 4);
    expect(checkContrast(white, "#000").AAA).toBe(true);
  });
  it.each([
    "#gggggg",
    "rgb(nope)",
    "oklch(abc)",
    "hsl(0 50)",
    "",
    "var(--unknown)",
  ])("rejects malformed %s without success fallback", (value) => {
    expect(validateColor(value).valid).toBe(false);
    expect(() => calculateContrastRatio(value, "#fff")).toThrow();
  });
  it.each([
    "#888",
    "rgb(136 136 136)",
    "hsl(0 0% 53.333333%)",
    "oklch(62.675% 0 0)",
  ])("fails low contrast consistently: %s", (value) =>
    expect(checkContrast(value, "#fff").AA).toBe(false),
  );
  it("does not round below-threshold ratio into a pass", () => {
    const result = checkContrast("#777", "#fff");
    expect(result.AA).toBe(false);
    expect(calculateContrastRatio("#767676", "#fff")).toBeGreaterThan(4.5);
  });
  it("accepts alpha colors but does not invent a contrast background", () => {
    expect(validateColor("rgb(0 0 0 / 50%)").valid).toBe(true);
    expect(() => calculateContrastRatio("rgb(0 0 0 / 50%)", "#fff")).toThrow(
      /opaque/,
    );
  });
  it("does not claim contrast for out-of-sRGB OKLCH", () => {
    expect(validateColor("oklch(0.7 0.4 30)").valid).toBe(true);
    expect(() => calculateContrastRatio("oklch(0.7 0.4 30)", "#fff")).toThrow(
      /sRGB/,
    );
  });
  it.each(["#888", "rgb(136 136 136)", "hsl(0 0% 53%)", "oklch(0.63 0 0)"])(
    "fixes %s with independently rechecked ratio",
    (value) => {
      const fix = fixContrast(value, "#fff");
      expect(fix.success).toBe(true);
      expect(calculateContrastRatio(fix.fixed, "#fff")).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(fix.adjustment).toBeLessThanOrEqual(50);
    },
  );
  it("does not mark an impossible constrained fix successful", () => {
    const fix = fixContrast("#888", "#fff", 7, { maxAdjustment: 0 });
    expect(fix.success).toBe(false);
    expect(fix.fixed).toBe("#888");
    expect(() => fixContrast("#888", "#fff", 22)).toThrow();
  });
});

describe("accessibility evidence", () => {
  it("passes declared pairs with explicit coverage warning", () => {
    const r = auditThemeAccessibility(fixture());
    expect(r.passed).toBe(true);
    expect(r.summary.totalChecks).toBe(8);
    expect(r.summary.passed).toBe(8);
    expect(r.summary.notEvaluated).toBe(0);
    expect(r.issues.some((i) => i.severity === "warning")).toBe(true);
  });
  it.each(["text", "textSecondary", "textMuted"] as const)(
    "classifies low %s contrast as error, not a successful warning",
    (key) => {
      const t = fixture();
      t.colors[key] = "#ddd";
      const r = auditThemeAccessibility(t);
      expect(r.passed).toBe(false);
      expect(
        r.issues.some(
          (x) =>
            x.field === `light.colors.${key}/surface` && x.severity === "error",
        ),
      ).toBe(true);
    },
  );
  it("checks dark mode independently", () => {
    const t = fixture();
    t.darkMode!.colors!.text = "#222";
    expect(auditThemeAccessibility(t).passed).toBe(false);
  });
  it("marks unmeasurable contrast not evaluated and failed overall", () => {
    const t = fixture();
    t.colors.text = "rgb(0 0 0 / 50%)";
    const r = auditThemeAccessibility(t);
    expect(r.passed).toBe(false);
    expect(r.summary.notEvaluated).toBeGreaterThan(0);
  });
  it("invalid source is not an empty successful audit", () => {
    const t = fixture();
    t.colors.surface = "invalid";
    const r = auditThemeAccessibility(t);
    expect(r.passed).toBe(false);
    expect(r.summary.notEvaluated).toBe(1);
  });
});

describe("CSS and Tailwind generation", () => {
  it("emits deterministic, parsed CSS with modern RGB companions and dark aliases", () => {
    const t = fixture(),
      before = JSON.stringify(t),
      css = generateCSS(t);
    expect(css).toBe(generateCSS(t));
    expect(JSON.stringify(t)).toBe(before);
    const root = postcss.parse(css);
    expect(root.nodes.length).toBeGreaterThan(0);
    expect(css).not.toContain("colors.text");
    expect(css).not.toContain("undefined");
    expect(css).toContain("--theme-primary: oklch(");
    expect(css).toContain("--theme-primary-rgb:");
    const dark = root.nodes.find(
      (n) => n.type === "rule" && n.selector.includes('[data-theme="dark"]'),
    );
    expect(dark?.toString()).toContain("--theme-text-secondary: #fff");
  });
  it("supports explicit prefix, scope, dark opt-out and compression", () => {
    const t = fixture();
    const css = generateCSS(t, {
      prefix: "acme",
      scope: ".app",
      includeDarkMode: false,
      compress: true,
    });
    expect(css).toContain("--acme-primary:");
    expect(css).not.toContain("--theme-");
    expect(css).not.toContain("prefers-color-scheme");
    expect(() => postcss.parse(css)).not.toThrow();
  });
  it.each([{ prefix: "bad;token" }, { scope: "body { color:red" }])(
    "rejects unsafe output options %s",
    (option) => expect(() => generateCSS(fixture(), option)).toThrow(),
  );
  it("compiles actual Tailwind v4 utilities using generated theme values", async () => {
    const input = generateTailwind(fixture());
    expect(input).toBe(generateTailwind(fixture()));
    const compiler = await compile(input + "\n@tailwind utilities;");
    const css = compiler.build([
      "bg-primary",
      "text-text",
      "p-4",
      "font-sans",
      "dark:bg-surface",
    ]);
    expect(css).toContain(".bg-primary");
    expect(css).toContain("var(--theme-primary)");
    expect(css).toContain(".p-4");
    expect(css).toContain('[data-theme="dark"]');
    expect(() => postcss.parse(css)).not.toThrow();
  });
  it("fails both generators for broken source aliases", () => {
    const t = fixture();
    t.colors.primary = "{colors.absent}";
    expect(() => generateCSS(t)).toThrow();
    expect(() => generateTailwind(t)).toThrow();
  });
});

describe("DTCG 2025.10 independent interoperability", () => {
  it("preserves aliases and dark values; rereads without data loss", () => {
    const t = fixture(),
      before = JSON.stringify(t);
    const json = generateDTCG(t);
    const doc = readDTCG(json);
    expect(JSON.stringify(t)).toBe(before);
    expect(doc).toEqual(JSON.parse(json));
    expect(json).toContain("{light.colors.text}");
    expect(json).toContain("{dark.colors.text}");
    expect(json).toContain('"colorSpace": "oklch"');
    expect(json).toBe(generateDTCG(t));
  });
  it("is accepted and resolved by an independent parser, with zero logged errors", async () => {
    const logger = new Logger({ level: "silent" });
    const parsed = await parse(
      [
        {
          filename: new URL("file:///theme.tokens.json"),
          src: generateDTCG(fixture()),
        },
      ],
      {
        config: defineConfig({}, { cwd: new URL("file:///"), logger }),
        logger,
      },
    );
    expect(logger.stats().errorCount).toBe(0);
    expect(parsed).toBeDefined();
  });
  it.each([
    { a: { $type: "color", $value: "#fff" } },
    { a: { $type: "dimension", $value: "4px" } },
    { a: { $type: "color", $value: "{missing}" } },
    {
      a: { $type: "number", $value: "{b}" },
      b: { $type: "number", $value: "{a}" },
    },
  ])("rejects invalid DTCG locally and independently", async (doc) => {
    expect(() => readDTCG(JSON.stringify(doc))).toThrow();
    const logger = new Logger({ level: "silent" });
    let rejected = false;
    try {
      await parse(
        [
          {
            filename: new URL("file:///bad.tokens.json"),
            src: JSON.stringify(doc),
          },
        ],
        {
          config: defineConfig({}, { cwd: new URL("file:///"), logger }),
          logger,
        },
      );
    } catch {
      rejected = true;
    }
    expect(rejected || logger.stats().errorCount > 0).toBe(true);
  });
  it("does not manufacture dark values when disabled", () => {
    const t = fixture();
    delete t.darkMode;
    expect(readDTCG(generateDTCG(t))).not.toHaveProperty("dark");
  });
});

describe("regression boundaries", () => {
  it("honors an explicit batch contrast threshold and rejects empty/invalid checks", () => {
    const pairs = [{ foreground: "#888", background: "#fff" }];
    expect(batchCheckContrast(pairs, { minRatio: 3 }).passing).toBe(1);
    expect(batchCheckContrast(pairs, { minRatio: 7 }).failing).toBe(1);
    expect(() => batchCheckContrast([])).toThrow();
    expect(() => batchCheckContrast(pairs, { minRatio: 22 })).toThrow();
  });
  it("preserves zero scale values instead of replacing them with defaults", () => {
    const t = fixture();
    delete t.spacing.values;
    t.spacing.scale = [0, 0, 0];
    expect(generateCSS(t)).toContain("--theme-spacing-1: 0px");
  });
  it("rejects injected token keys, invalid font sizes and weights", () => {
    const t = fixture();
    Object.assign(t.colors, { "bad;key": "#fff" });
    expect(() => generateCSS(t)).toThrow();
    const u = fixture();
    u.typography.sizes = { base: -1 };
    expect(() => generateDTCG(u)).toThrow();
    u.typography.sizes = { base: 16 };
    u.typography.weights.bold = 1001;
    expect(() => generateCSS(u)).toThrow();
  });
  it("rejects DTCG tokens with children and invalid weight or alias types", () => {
    for (const doc of [
      {
        a: {
          $type: "number",
          $value: 1,
          child: { $type: "number", $value: 2 },
        },
      },
      { a: { $type: "fontWeight", $value: 1001 } },
      {
        a: { $type: "number", $value: 2 },
        b: { $type: "color", $value: "{a}" },
      },
    ])
      expect(() => readDTCG(JSON.stringify(doc))).toThrow();
  });
  it("keeps the historical default readable without claiming accessibility success", () => {
    expect(validateTheme(defaultTheme).valid).toBe(true);
    expect(() => postcss.parse(generateCSS(defaultTheme))).not.toThrow();
    expect(() => readDTCG(generateDTCG(defaultTheme))).not.toThrow();
    expect(auditThemeAccessibility(defaultTheme).passed).toBe(false);
  });
});

it("preserves representable dimension aliases in DTCG and compiles custom Tailwind spacing", async () => {
  const t = fixture();
  t.spacing.values = { 1: 4, 2: "{spacing.values.1}" as unknown as number };
  expect(generateDTCG(t)).toContain("{light.spacing.values.1}");
  const logger = new Logger({ level: "silent" });
  await parse(
    [
      {
        filename: new URL("file:///dimensions.tokens.json"),
        src: generateDTCG(t),
      },
    ],
    { config: defineConfig({}, { cwd: new URL("file:///"), logger }), logger },
  );
  expect(logger.stats().errorCount).toBe(0);
  const compiler = await compile(
    generateTailwind(t) + "\n@tailwind utilities;",
  );
  expect(compiler.build(["p-2"])).toContain("var(--theme-spacing-2)");
});
it("does not flatten a dimension alias with an unexported DTCG target", () => {
  const t = fixture();
  t.spacing.scale = [0, 4];
  t.spacing.values = { 1: "{spacing.scale.1}" as unknown as number };
  expect(() => generateDTCG(t)).toThrow(/Missing DTCG reference/);
});
