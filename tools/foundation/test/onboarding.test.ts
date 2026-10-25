import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse, Logger, defineConfig } from "@terrazzo/parser";
import { readDTCG } from "@spexop/theme";
import postcss from "postcss";
import {
  analyzeProject,
  writeFoundation,
  type Options,
  type Analysis,
} from "../index.js";
const dirs: string[] = [];
const original = fs.readFileSync(
  "examples/design-foundation-journey/src/legacy.css",
  "utf8",
);
function project(css = original) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spx-discovery-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src/tokens.css"), css);
  return dir;
}
// Test-owned decisions, NOT an automatic production accept-all facility.
function answer(result: Analysis): Options {
  const decisions: NonNullable<Options["decisions"]> = {};
  for (const d of result.manual_decisions) {
    if (d.kind === "proposal" && d.suggested !== undefined)
      decisions[d.id] = { value: d.suggested };
    if (d.kind === "mapping")
      decisions[d.id] = d.reason.includes("--radius")
        ? { target: "borders.radiusSubtle" }
        : { ignore: true };
  }
  decisions["override:light.colors.textMuted"] = { value: "#475569" };
  return { inputHash: result.inputHash, decisions };
}
function accepted(dir: string) {
  let r = analyzeProject(dir);
  const o = answer(r);
  r = analyzeProject(dir, o);
  // Selecting a mapping replaces the initial proposal for that same slot; require refreshed answers.
  for (const id of Object.keys(o.decisions!))
    if (!r.manual_decisions.some((d) => d.id === id)) delete o.decisions![id];
  return { options: o, result: analyzeProject(dir, o) };
}
afterEach(() => {
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});
describe("bounded discovery and onboarding", () => {
  it("discovers 30 exact declarations with mode and source, proposes rather than writes", () => {
    const p = project(),
      r = analyzeProject(p);
    expect(r.found).toHaveLength(30);
    expect(r.found.filter((x) => x.mode === "dark")).toHaveLength(10);
    expect(r.mappings.filter((x) => x.method === "name-rule")).toHaveLength(28);
    expect(r.found[0].source).toEqual({
      file: "src/tokens.css",
      line: 3,
      column: 3,
    });
    expect(r.ok).toBe(false);
    expect(r.outputs).toEqual([]);
    expect(fs.existsSync(path.join(p, ".spexop"))).toBe(false);
    expect(
      r.manual_decisions.some((d) => d.suggested !== undefined && !d.resolved),
    ).toBe(true);
  });
  it("preserves original values and makes explicit correction provenance visible", () => {
    const p = project(),
      { result: r } = accepted(p);
    expect(r.ok).toBe(true);
    expect(
      r.mappings.find(
        (m) => m.mode === "light" && m.target === "colors.textMuted",
      )?.value,
    ).toBe("#94a3b8");
    expect(r.theme.colors.textMuted).toBe("#475569");
    expect(
      r.manual_decisions.find((d) => d.id === "override:light.colors.textMuted")
        ?.resolved,
    ).toBe(true);
    expect(fs.readFileSync(path.join(p, "src/tokens.css"), "utf8")).toBe(
      original,
    );
  });
  it.each([
    "#2563eb",
    "rgb(37 99 235)",
    "hsl(221 83% 53%)",
    "oklch(0.55 0.18 260)",
  ])("preserves valid color spelling %s", (value) => {
    const p = project(original.replace("#2563eb", value));
    const { result: r } = accepted(p);
    expect(r.ok).toBe(true);
    expect(r.theme.colors.primary).toBe(value);
  });
  it("keeps a basic mapped color alias and detects missing alias with location", () => {
    const good = project(
      original.replace("--brand: #2563eb", "--brand: var(--ink)"),
    );
    const { result: r } = accepted(good);
    expect(r.ok).toBe(true);
    expect(r.theme.colors.primary).toBe("{colors.text}");
    const bad = analyzeProject(
      project(original.replace("--brand: #2563eb", "--brand: var(--missing)")),
    );
    expect(bad.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ALIAS_MISSING",
        source: { file: "src/tokens.css", line: 3, column: 3 },
      }),
    );
    expect(bad.ok).toBe(false);
  });
  it("finds an alias cycle rather than overflowing or claiming success", () => {
    const p = project(
      original
        .replace("--brand: #2563eb", "--brand: var(--ink)")
        .replace("--ink: #0f172a", "--ink: var(--brand)"),
    );
    expect(
      analyzeProject(p).diagnostics.some((d) => d.code === "ALIAS_CYCLE"),
    ).toBe(true);
  });
  it("rejects invalid color and does not write outputs", () => {
    const p = project(original.replace("#2563eb", "rgb(broken)"));
    const { result: r } = accepted(p);
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "THEME_INVALID",
        token: "light.colors.primary",
        source: { file: "src/tokens.css", line: 3, column: 3 },
      }),
    );
  });
  it("contrast is part of the one operation and blocks output", () => {
    const p = project(),
      { options: o } = accepted(p);
    delete o.decisions!["override:light.colors.textMuted"];
    const r = analyzeProject(p, o);
    expect(r.ok).toBe(false);
    expect(r.outputs).toHaveLength(0);
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CONTRAST",
        severity: "error",
        token: "light.colors.textMuted/surface",
        source: { file: "src/tokens.css", line: 9, column: 3 },
      }),
    );
  });
  it("requires a separate dark inheritance/value decision per missing color", () => {
    const p = project(original.replace("  --brand: #60a5fa;", ""));
    const { options: o } = accepted(p);
    let r = accepted(p).result;
    expect(r.ok).toBe(false);
    expect(r.manual_decisions).toContainEqual(
      expect.objectContaining({
        id: "inherit:colors.primary",
        resolved: false,
      }),
    );
    o.decisions!["inherit:colors.primary"] = { inherit: true };
    r = analyzeProject(p, o);
    expect(r.ok).toBe(true);
    expect(r.inheritance).toContainEqual({
      token: "colors.primary",
      from: "light",
      accepted: true,
    });
  });
  it("does not hide missing all dark values behind light-only validation", () => {
    const p = project(original.split("[data-theme=")[0]);
    expect(
      analyzeProject(p).manual_decisions.filter(
        (d) => d.kind === "inheritance",
      ),
    ).toHaveLength(10);
  });
  it("does not silently resolve competing semantic sources, even identical values", () => {
    const p = project(
      original.replace(
        "--brand: #2563eb;",
        "--brand: #2563eb;\n  --primary: #2563eb;",
      ),
    );
    const r = analyzeProject(p);
    expect(r.manual_decisions).toContainEqual(
      expect.objectContaining({
        id: "conflict:light.colors.primary",
        resolved: false,
      }),
    );
    expect(
      r.mappings.some(
        (m) => m.mode === "light" && m.target === "colors.primary",
      ),
    ).toBe(false);
  });
  it("generic muted is ambiguous, not unconditionally mapped to text", () => {
    const p = project(
      original.replace("--ink-muted: #94a3b8", "--muted: #94a3b8"),
    );
    const r = analyzeProject(p);
    expect(
      r.manual_decisions.some(
        (d) =>
          d.options?.includes("colors.surfaceSecondary") &&
          d.options.includes("colors.textMuted"),
      ),
    ).toBe(true);
  });
  it.each([
    "@media (prefers-color-scheme:dark) { :root { --primary:#fff; }}",
    ":root, body { --primary:#fff; }",
    ":root { --primary:calc(1 + 2); }",
    ":root { --primary:var(--brand, red); }",
    ":root { --primary:#fff !important; }",
  ])("reports unsupported CSS and blocks output: %s", (css) => {
    const p = project(original + "\n" + css);
    expect(
      analyzeProject(p).diagnostics.some(
        (d) => d.severity === "unsupported" && d.code.startsWith("UNSUPPORTED"),
      ),
    ).toBe(true);
    expect(accepted(p).result.ok).toBe(false);
  });
  it("reports syntax failure at source location", () => {
    const r = analyzeProject(project(":root { --primary:#fff"));
    expect(
      r.diagnostics.some(
        (d) => d.code === "CSS_PARSE" && d.source?.file === "src/tokens.css",
      ),
    ).toBe(true);
  });
  it("discovers top-level Tailwind v4 theme values and inline aliases", () => {
    const p = project(
      "@theme inline { --color-primary:var(--color-foreground); --color-foreground:oklch(0.2 0 0); --spacing-4:16px; --font-sans:Arial; }",
    );
    const r = analyzeProject(p, { expectedModes: ["light"] });
    expect(r.found.every((x) => x.origin === "tailwind-theme")).toBe(true);
    expect(r.mappings.map((x) => x.target)).toEqual([
      "colors.primary",
      "colors.text",
      "spacing.values.4",
      "typography.fontFamily",
    ]);
    expect(r.theme.colors.primary).toBe("{colors.text}");
  });
  it("does not guess root font size for rem spacing", () => {
    const r = analyzeProject(
      project(original.replace("--space-4: 16px", "--space-4: 1rem")),
    );
    expect(r.diagnostics.some((d) => d.code === "UNSUPPORTED_UNIT")).toBe(true);
  });
  it("invalidates approvals when CSS changes", () => {
    const p = project(),
      { options: o } = accepted(p);
    fs.appendFileSync(path.join(p, "src/tokens.css"), "\n/* changed */");
    expect(
      analyzeProject(p, o).diagnostics.some(
        (d) => d.code === "STALE_DECISIONS",
      ),
    ).toBe(true);
    expect(() => writeFoundation(p, o)).toThrow();
  });
  it("rejects unknown decision IDs rather than claiming they were applied", () => {
    const p = project(),
      { options: o } = accepted(p);
    o.decisions!.typo = { ignore: true };
    expect(
      analyzeProject(p, o).diagnostics.some(
        (d) => d.code === "UNKNOWN_DECISION",
      ),
    ).toBe(true);
  });
  it("regenerates identically in different directories", () => {
    const p = project(),
      q = project();
    expect(accepted(p).result.outputs).toEqual(accepted(q).result.outputs);
  });
  it("writes only on explicit action and refuses any existing output directory", () => {
    const p = project(),
      { options: o, result: r } = accepted(p);
    const before = fs.readFileSync(path.join(p, "src/tokens.css"));
    writeFoundation(p, o);
    for (const x of r.outputs)
      expect(fs.readFileSync(path.join(p, x.path), "utf8")).toBe(x.content);
    expect(() => writeFoundation(p, o)).toThrow();
    expect(fs.readFileSync(path.join(p, "src/tokens.css"))).toEqual(before);
  });
  it("refuses a symlink output parent and never follows out-of-scope source links", () => {
    const p = project(),
      q = project(),
      { options: o } = accepted(p);
    fs.symlinkSync(q, path.join(p, ".spexop"));
    expect(() => writeFoundation(p, o)).toThrow("real directory");
    fs.symlinkSync(
      path.join(q, "src/tokens.css"),
      path.join(p, "src/linked.css"),
    );
    const r = analyzeProject(p);
    expect(r.diagnostics.some((d) => d.code === "SYMLINK_SKIPPED")).toBe(true);
    expect(r.found).toHaveLength(30);
    expect(() => analyzeProject(p, { cssFiles: ["src/linked.css"] })).toThrow(
      "Symlink",
    );
  });
  it("rejects path escape and prototype targets", () => {
    const p = project();
    expect(() => analyzeProject(p, { cssFiles: ["../outside.css"] })).toThrow();
    const r = analyzeProject(p),
      o = answer(r);
    const d = r.manual_decisions.find((d) => d.kind === "mapping")!;
    o.decisions![d.id] = { target: "spacing.values.__proto__" };
    expect(analyzeProject(p, o).ok).toBe(false);
  });
  it("CLI dry-run is nonzero for blocked configuration without side effects", () => {
    const p = project();
    let exit = 0;
    try {
      execFileSync(process.execPath, ["tools/foundation/dist/cli.js", p], {
        stdio: "pipe",
      });
    } catch (e) {
      exit = (e as { status: number }).status;
    }
    expect(exit).toBe(1);
    expect(fs.existsSync(path.join(p, ".spexop"))).toBe(false);
  });
});

describe("independent output and inherited-source checks", () => {
  it("parses generated DTCG independently and verifies CSS mode values", async () => {
    const { result: r } = accepted(project());
    const json = r.outputs.find((o) => o.path.endsWith(".json"))!.content;
    const doc = readDTCG(json);
    expect(doc).toEqual(JSON.parse(json));
    const logger = new Logger({ level: "silent" });
    await parse(
      [{ filename: new URL("file:///theme.tokens.json"), src: json }],
      {
        config: defineConfig({}, { cwd: new URL("file:///"), logger }),
        logger,
      },
    );
    expect(logger.stats().errorCount).toBe(0);
    const css = r.outputs.find((o) => o.path.endsWith("/theme.css"))!.content;
    expect(() => postcss.parse(css)).not.toThrow();
    expect(css).toContain("#2563eb");
    expect(css).toContain("#60a5fa");
  });
  it("locates contrast failures in explicitly inherited dark tokens at their light source", () => {
    const p = project(
      original.replace(
        "  --ink-muted: #94a3b8;\n  --line: #475569;",
        "  --line: #475569;",
      ),
    );
    const { options: o } = accepted(p);
    o.decisions!["inherit:colors.textMuted"] = { inherit: true };
    const r = analyzeProject(p, o);
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CONTRAST",
        token: "dark.colors.textMuted/surface",
        source: { file: "src/tokens.css", line: 9, column: 3 },
      }),
    );
  });
  it("refuses an existing empty output directory as well as populated files", () => {
    const p = project(),
      { options: o } = accepted(p);
    fs.mkdirSync(path.join(p, ".spexop/foundation"), { recursive: true });
    expect(() => writeFoundation(p, o)).toThrow();
    expect(fs.readdirSync(path.join(p, ".spexop/foundation"))).toEqual([]);
  });
});

it("does not interpret object prototype names as semantic rules", () => {
  const r = analyzeProject(
    project(original + "\n:root { --constructor: red; --__proto__:blue; }"),
  );
  expect(
    r.mappings.some(
      (m) =>
        m.sourceId.includes("constructor") || m.sourceId.includes("__proto__"),
    ),
  ).toBe(false);
  expect(r.manual_decisions.filter((d) => d.kind === "mapping")).toHaveLength(
    4,
  );
});
it("does not silently convert dimensioned values into unitless typography", () => {
  const p = project(original + "\n:root { --custom-scale:1.25px; }");
  const initial = analyzeProject(p),
    o = answer(initial);
  const d = initial.manual_decisions.find((d) =>
    d.reason.includes("--custom-scale"),
  )!;
  o.decisions![d.id] = { target: "typography.scale" };
  delete o.decisions!["value:typography.scale"];
  expect(
    analyzeProject(p, o).diagnostics.some(
      (d) => d.code === "UNSUPPORTED_UNIT" && d.token === "typography.scale",
    ),
  ).toBe(true);
});
