import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { captureDesignFoundation, assertModel } from "../capture/index.js";
const dirs: string[] = [];
function project(css?: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spx-capture-")); dirs.push(root);
  if (css !== undefined) fs.writeFileSync(path.join(root, "tokens.css"), css);
  return root;
}
const capture = (css: string) => captureDesignFoundation({ projectRoot: project(css) });
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

it("preserves arbitrary identities, source types and declarations without Theme mapping", () => {
  const css = ':root { --card:#fff; --popover:red; --sidebar:2rem; --chart-1:50%; --font:Inter,sans-serif; }';
  const root = project(css), r = captureDesignFoundation({ projectRoot: root, sourceCommit: "a".repeat(40) });
  expect(r.schemaVersion).toBe("0.1"); expect(r.tokens).toHaveLength(5);
  expect(r.tokens.map(t => t.identity.sourceName)).toEqual(["--card", "--popover", "--sidebar", "--chart-1", "--font"]);
  expect(r.tokens.at(-1)!.type.status).toBe("ambiguous");
  expect(r.tokens.every(t => !t.semantics.declared.length && !t.semantics.proposals.length)).toBe(true);
  expect(r.tokens[0].provenance).toMatchObject({ file: "tokens.css", line: 1, column: 9, commit: "a".repeat(40), fileSha256: createHash("sha256").update(css).digest("hex") });
  expect(r.coverage).toMatchObject({ sourceDeclarations: 5, representedDeclarations: 5, mandatoryThemeMappings: 0, outputGeneration: "not-evaluated" });
  expect(fs.readFileSync(path.join(root, "tokens.css"), "utf8")).toBe(css);
});
it("preserves multistep edges, cycles and missing references with actionable locations", () => {
  const r = capture(":root { --base:red; --a:var(--base); --b:var(--a); --x:var(--y); --y:var(--x); --lost:var(--gone); }");
  expect(r.ok).toBe(false); expect(r.coverage.resolutions).toMatchObject({ resolved: 3, cycle: 2, missing: 1 });
  expect(r.references).toHaveLength(5);
  expect(r.diagnostics.find(d => d.code === "REFERENCE_MISSING")).toMatchObject({ severity: "error", token: "--lost", source: { file: "tokens.css", line: 1 } });
  expect(r.tokens[2].value).toMatchObject({ kind: "alias", raw: "var(--a)" }); assertModel(r);
});
it("keeps light/dark identities and resolves inline aliases in their evaluation scope", () => {
  const r = capture(":root { --brand:red; } .dark { --brand:blue; } @theme inline { --color-card:var(--brand); }");
  const alias = r.tokens[2]; const rs = r.resolutions.filter(x => x.tokenId === alias.id);
  expect(rs).toHaveLength(2); expect(rs[0].canonicalId).not.toBe(rs[1].canonicalId);
  expect(r.contexts[0].axes).toEqual({ theme: "light" }); expect(r.contexts[1].axes).toEqual({ theme: "dark" });
});
it("keeps fallback and calc as derived rather than substituting scalars", () => {
  const r = capture(":root { --a:var(--missing, red); --b:calc(var(--a) * 2); }");
  expect(r.resolutions.every(x => x.status === "derived")).toBe(true);
  expect(r.references[0].fallback).toBe("red"); expect(r.diagnostics.some(d => d.severity === "unsupported")).toBe(true);
});
it.each(["initial", "inherit", "unset", "revert", "revert-layer", "currentColor"])("does not certify CSS-wide/context value %s", value => {
  const r = capture(`:root { --card:${value}; }`);
  expect(r.resolutions[0].status).toBe("unsupported"); expect(r.tokens[0].type.status).not.toBe("known");
});
it("records registration, unsupported selectors and layers without choosing a cascade winner", () => {
  const r = capture('@property --card { syntax:"<color>"; inherits:false; initial-value:red; } :root { --card:blue; } @layer brand { .brand { --card:green; } }');
  expect(r.tokens).toHaveLength(2); expect(r.diagnostics.some(d => d.code === "REGISTERED_PROPERTY")).toBe(true);
  expect(r.resolutions.every(x => x.status !== "resolved")).toBe(true);
  expect(r.contexts[1].source).toMatchObject({ selector: ".brand", ancestors: ["@layer brand"] });
});
it("does not choose among duplicate declarations or guess malformed types", () => {
  const r = capture(":root { --card:red; --card:blue; --alias:var(--card); --unknown:rgb(nope); --curve:cubic-bezier(,0,,1); }");
  expect(r.resolutions.filter(x => x.tokenId.includes("--card") || x.tokenId.includes("--alias")).every(x => x.status === "ambiguous")).toBe(true);
  expect(r.tokens.slice(3).every(t => t.type.status !== "known")).toBe(true);
});
it("preserves empty, token-free, malformed and excluded source coverage", () => {
  const empty = captureDesignFoundation({ projectRoot: project() }); expect(empty.ok).toBe(false); expect(empty.tokens).toEqual([]);
  const root = project("body { color:red; }"); fs.writeFileSync(path.join(root, "bad.css"), ":root {");
  fs.mkdirSync(path.join(root, "node_modules")); fs.writeFileSync(path.join(root, "node_modules", "ignored.css"), ":root{--x:red}");
  const r = captureDesignFoundation({ projectRoot: root }); expect(r.ok).toBe(false);
  expect(r.sources.map(s => [s.file, s.status])).toEqual([["bad.css", "parse-error"], ["node_modules", "excluded"], ["tokens.css", "inspected"]]);
  expect(r.diagnostics.some(d => d.code === "CSS_PARSE" && d.severity === "error")).toBe(true);
});
it("is deterministic across equivalent roots and never executes project scripts or writes", () => {
  const a = project(":root{--card:red}"), b = project(":root{--card:red}");
  fs.writeFileSync(path.join(a, "package.json"), JSON.stringify({ scripts: { preinstall: "touch executed" } }));
  fs.writeFileSync(path.join(a, "vite.config.ts"), 'throw new Error("Must not execute")');
  const before = fs.readdirSync(a);
  const r = captureDesignFoundation({ projectRoot: a }); expect(r).toEqual(captureDesignFoundation({ projectRoot: b }));
  expect(JSON.parse(JSON.stringify(r))).toEqual(r); expect(fs.readdirSync(a)).toEqual(before);
  expect(() => captureDesignFoundation({ projectRoot: a, write: true } as never)).toThrow("read-only");
});
it("rejects root symlink, explicit escapes, symlink components and hardlinked CSS", () => {
  const root = project(":root{--a:red}"), outside = project(":root{--private:blue}");
  fs.symlinkSync(outside, path.join(root, "linked")); fs.symlinkSync(path.join(outside, "tokens.css"), path.join(root, "link.css"));
  fs.linkSync(path.join(outside, "tokens.css"), path.join(root, "hard.css"));
  expect(captureDesignFoundation({ projectRoot: path.join(root, "linked") }).diagnostics[0].code).toBe("ROOT_INVALID");
  for (const cssFiles of [["../escape.css"], [path.join(outside, "tokens.css")], ["linked/tokens.css"], ["link.css"], ["hard.css"]]) {
    const r = captureDesignFoundation({ projectRoot: root, cssFiles }); expect(r.ok).toBe(false); expect(r.tokens).toHaveLength(0);
  }
  const r = captureDesignFoundation({ projectRoot: root }); expect(r.tokens).toHaveLength(1); expect(r.sources.filter(s => s.status === "excluded")).toHaveLength(2);
});
it("fails explicitly for oversized input without partial token certification", () => {
  const r = capture(" ".repeat(1024 * 1024) + ":root{--x:red}"); expect(r.ok).toBe(false); expect(r.tokens).toEqual([]); expect(r.diagnostics[0].code).toBe("SOURCE_REFUSED");
});
