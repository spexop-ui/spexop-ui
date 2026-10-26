import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { captureDesignFoundation } from "../capture/index.js";

const dirs: string[] = [];
const temp = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), "spx-capture-independent-")); dirs.push(p); return p; };
function fixture(css: string | Buffer) { const p = temp(); fs.writeFileSync(path.join(p, "tokens.css"), css); return p; }
const capture = (projectRoot: string) => captureDesignFoundation({ projectRoot, namespace: "independent" });
afterEach(() => { vi.restoreAllMocks(); for (const p of dirs.splice(0)) fs.rmSync(p, { recursive: true, force: true }); });

it("independent: does not read symlink roots, directories, leaves or hardlinked CSS", () => {
  const p = fixture(":root { --safe:red; }"), outside = fixture(":root { --outside:blue; }");
  fs.symlinkSync(outside, path.join(p, "linked"));
  fs.symlinkSync(path.join(outside, "tokens.css"), path.join(p, "leaf.css"));
  fs.linkSync(path.join(outside, "tokens.css"), path.join(p, "hard.css"));
  const rootLink = path.join(temp(), "root"); fs.symlinkSync(p, rootLink);
  expect(capture(rootLink).ok).toBe(false);
  const result = capture(p);
  expect(result.tokens.map(t => t.identity.sourceName)).toEqual(["--safe"]);
  expect(result.sources.find(s => s.file === "linked")?.status).toBe("excluded");
  expect(result.sources.find(s => s.file === "leaf.css")?.status).toBe("excluded");
  expect(result.sources.find(s => s.file === "hard.css")?.status).toBe("rejected");
  expect(result.ok).toBe(false);
});

it("independent: rejects explicit escape, absolute and nested symlink paths", () => {
  const p = fixture(":root { --safe:red; }"), outside = fixture(":root { --outside:blue; }");
  fs.symlinkSync(outside, path.join(p, "linked"));
  for (const file of [path.join(outside, "tokens.css"), path.relative(p, path.join(outside, "tokens.css")), "linked/tokens.css"]) {
    const result = captureDesignFoundation({ projectRoot: p, cssFiles: [file] });
    expect(result.ok).toBe(false); expect(result.tokens).toEqual([]);
  }
});

it("independent: rejects nonregular and invalid UTF-8 CSS without a token success", () => {
  const p = temp(); fs.mkdirSync(path.join(p, "folder.css"));
  const dir = captureDesignFoundation({ projectRoot: p, cssFiles: ["folder.css"] });
  expect(dir.ok).toBe(false); expect(dir.sources[0].status).toBe("rejected");
  const bytes = fixture(Buffer.from([0xff, 0xfe, 0x41]));
  expect(capture(bytes).sources[0].status).toBe("rejected");
});

it("independent: reports empty and malformed sources without hiding their inventory", () => {
  const p = fixture("body { color:red; }"), empty = capture(p);
  expect(empty.ok).toBe(false); expect(empty.sources[0].status).toBe("inspected");
  expect(empty.diagnostics.some(d => d.code === "NO_TOKENS" && d.severity === "error")).toBe(true);
  fs.writeFileSync(path.join(p, "bad.css"), ":root { --bad: red;");
  const bad = capture(p);
  expect(bad.ok).toBe(false); expect(bad.sources.find(s => s.file === "bad.css")?.status).toBe("parse-error");
  expect(bad.diagnostics.some(d => d.code === "CSS_PARSE" && d.source?.file === "bad.css" && d.severity === "error")).toBe(true);
});

it("independent: exact BOM/unicode raw declaration and byte hash provenance survives", () => {
  const css = "\ufeff/* café 🟦 */\n:root { --card: #fff; --label: 'café'; }", p = fixture(css), result = capture(p);
  const t = result.tokens.find(t => t.identity.sourceName === "--card")!;
  expect(t.provenance.rawDeclaration).toBe("--card: #fff;");
  expect(t.provenance.line).toBe(2); expect(t.provenance.column).toBe(9);
  expect(t.provenance.fileSha256).toBe(createHash("sha256").update(css).digest("hex"));
  expect(result.sources[0].sha256).toBe(t.provenance.fileSha256);
});

it("independent: different roots do not leak absolute paths or alter equivalent capture", () => {
  const a = fixture(":root { --card:red; --x:var(--card); }"), b = fixture(":root { --card:red; --x:var(--card); }");
  expect(capture(a)).toEqual(capture(b)); expect(JSON.stringify(capture(a))).not.toContain(a);
});

it("independent: raw declaration never includes a neighboring property or closing brace", () => {
  const r = capture(fixture(":root{--a:red;--b:blue}"));
  expect(r.tokens.map(t => t.provenance.rawDeclaration)).toEqual(["--a:red;", "--b:blue"]);
});

it("independent: source reads do not write or execute application configuration", () => {
  const p = fixture(":root { --card:red; }");
  fs.writeFileSync(path.join(p, "vite.config.ts"), "throw new Error('MUST_NOT_EXECUTE');");
  fs.writeFileSync(path.join(p, "package.json"), '{"scripts":{"postinstall":"exit 42"}}');
  const write = vi.spyOn(fs, "writeFileSync"), append = vi.spyOn(fs, "appendFileSync"), rename = vi.spyOn(fs, "renameSync");
  const result = capture(p); expect(result.ok).toBe(true);
  expect(write).not.toHaveBeenCalled(); expect(append).not.toHaveBeenCalled(); expect(rename).not.toHaveBeenCalled();
  expect(result.coverage.outputGeneration).toBe("not-evaluated");
});

it("independent: never collapses missing/cyclic/fallback references into a successful scalar", () => {
  const r = capture(fixture(":root { --base:red; --a:var(--base); --b:var(--a); --gone:var(--missing); --x:var(--y); --y:var(--x); --fallback:var(--missing, blue); --calc:calc(2 * var(--base)); }"));
  const status = (name: string) => r.resolutions.find(x => x.tokenId === r.tokens.find(t => t.identity.sourceName === name)!.id)!.status;
  expect(status("--b")).toBe("resolved"); expect(status("--gone")).toBe("missing"); expect(status("--x")).toBe("cycle");
  expect(status("--fallback")).toBe("derived"); expect(status("--calc")).toBe("derived");
  expect(r.ok).toBe(false); expect(r.references.find(x => x.fallback)?.fallback).toBe("blue");
  expect(r.diagnostics.some(d => d.code === "REFERENCE_CYCLE" && d.source?.line === 1 && d.tokenId)).toBe(true);
});

it("independent: arbitrary semantic names and equal values do not certify or merge UI roles", () => {
  const r = capture(fixture(":root { --card:red; --popover:red; --brand:red; --primary:var(--brand); --link:var(--brand); --font:Inter,sans-serif; --shadow:0 2px 4px #000; }"));
  expect(r.tokens).toHaveLength(7); expect(new Set(r.tokens.map(t => t.identity.familyId)).size).toBe(7);
  expect(r.tokens.every(t => !t.semantics.declared.length && !t.semantics.proposals.length)).toBe(true);
  for (const name of ["--font", "--shadow"]) expect(r.tokens.find(t => t.identity.sourceName === name)!.type.status).not.toBe("known");
  expect(r.coverage.mandatoryThemeMappings).toBe(0); expect(r.coverage.status).toBe("partial");
});

it("independent: preserves separate mode contexts and rejects unsupported scope certainty", () => {
  const r = capture(fixture(":root { --base:red; --inherited:var(--base); } .dark { --base:blue; --b:var(--inherited); } @theme inline { --color-base:var(--base); } [data-brand=acme] { --brand:red; }"));
  const name = (n: string) => r.tokens.find(t => t.identity.sourceName === n)!;
  const rs = r.resolutions.filter(x => x.tokenId === name("--color-base").id);
  expect(rs).toHaveLength(2); expect(new Set(rs.map(x => x.canonicalId)).size).toBe(2);
  expect(r.resolutions.find(x => x.tokenId === name("--b").id)!.status).toBe("unsupported");
  expect(r.contexts.find(c => c.id === name("--brand").contextId)!.axes).toEqual({});
  expect(r.resolutions.find(x => x.tokenId === name("--brand").id)!.status).toBe("unsupported");
});

it("independent: CSS-wide and registered properties are not regular scalar resolutions", () => {
  const r = capture(fixture('@property --custom { syntax:"<color>"; inherits:false; initial-value:red; } :root { --custom:blue; --alias:var(--custom); --x:inherit; --y:revert-layer; --z:currentColor; }'));
  expect(r.tokens).toHaveLength(5); expect(r.resolutions.every(x => x.status !== "resolved")).toBe(true);
  expect(r.diagnostics.some(d => d.code === "REGISTERED_PROPERTY" && d.severity === "unsupported")).toBe(true);
});

it("independent: same-name competing sources do not select an arbitrary winner", () => {
  const p = fixture(":root { --card:red; --alias:var(--card); }"); fs.writeFileSync(path.join(p, "other.css"), ":root { --card:blue; }");
  const r = capture(p); expect(r.tokens).toHaveLength(3); expect(r.resolutions.every(x => x.status === "ambiguous")).toBe(true);
  expect(r.coverage.status).toBe("partial");
});

it("independent: malformed curve syntax is not promoted to known typed value", () => {
  const r = capture(fixture(":root { --a:cubic-bezier(,0,,1); --b:cubic-bezier(0x0,0,0x1,1); --c:rgb(nope); }"));
  expect(r.tokens.every(t => t.type.status !== "known")).toBe(true);
});

it("independent: refuses unsupported write options rather than interpreting them", () => {
  const p = fixture(":root { --card:red; }");
  expect(() => captureDesignFoundation({ projectRoot: p, write: true } as Parameters<typeof captureDesignFoundation>[0])).toThrow();
});

it("independent: rejects coerced non-string commit assertions at the JavaScript boundary", () => {
  const p = fixture(":root { --card:red; }");
  expect(() => captureDesignFoundation({ projectRoot: p, sourceCommit: ["a".repeat(40)] } as unknown as Parameters<typeof captureDesignFoundation>[0])).toThrow(TypeError);
});
