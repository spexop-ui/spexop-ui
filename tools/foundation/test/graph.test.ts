import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { analyzeProject, buildTokenGraph, redundantAliasIds } from "../index.js";
import { discover } from "../discover.js";
const dirs: string[] = [];
function project(css: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spx-graph-"));
  dirs.push(dir); fs.writeFileSync(path.join(dir, "tokens.css"), css);
  return dir;
}
function graph(css: string) { return buildTokenGraph(discover(project(css)).found); }
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
it("retains direct provenance edges and canonical source through a multi-level alias chain", () => {
  const g = graph(":root {\n --base: #123456;\n --a: var(--base);\n --b: var(--a);\n}");
  const [base, a, b] = g.nodes;
  expect(b.provenance).toEqual({ file: "tokens.css", line: 4, column: 2 });
  expect(g.resolutions.find(r => r.nodeId === b.id)).toMatchObject({ targetIds: [a.id], canonicalSourceId: base.id });
  expect(g.resolutions.find(r => r.nodeId === a.id)).toMatchObject({ targetIds: [base.id], canonicalSourceId: base.id });
  expect(redundantAliasIds(g).size).toBe(0); // Unknown alias roles are not proven equal.
});
it("does not merge light and dark declarations and resolves shared exports per mode", () => {
  const g = graph(":root { --primary: #123456; } .dark { --primary: #abcdef; } @theme inline { --color-primary: var(--primary); }");
  expect(g.nodes).toHaveLength(3);
  const [light, dark, alias] = g.nodes;
  expect(alias.context.mode).toBe("shared");
  expect(g.resolutions.filter(r => r.nodeId === alias.id)).toEqual([
    { nodeId: alias.id, mode: "dark", status: "resolved", targetIds: [dark.id], canonicalSourceId: dark.id },
    { nodeId: alias.id, mode: "light", status: "resolved", targetIds: [light.id], canonicalSourceId: light.id },
  ]);
});
it("retains unsupported selector/layer contexts without contaminating global resolution", () => {
  const g = graph(":root { --x: #123456; --a: var(--x); } .card { --x: red; } @layer base { :root { --x: blue; } }");
  expect(g.nodes).toHaveLength(4);
  expect(g.nodes[3].context.ancestors).toEqual(["@layer base"]);
  expect(g.resolutions.find(r => r.nodeId === g.nodes[1].id)?.status).toBe("unsupported");
  expect(g.resolutions.filter(r => r.status === "unsupported")).toHaveLength(4);
  expect(g.uncertainties.filter(u => u.category === "unsupported")).toHaveLength(4);
});
it("refuses to choose between duplicate declarations instead of implementing cascade", () => {
  const g = graph(":root { --x: red; } :root { --x: blue; --a: var(--x); }");
  const r = g.resolutions.find(r => r.nodeId === g.nodes[2].id)!;
  expect(r.status).toBe("ambiguous"); expect(r.targetIds).toHaveLength(2);
  expect(r.canonicalSourceId).toBeUndefined(); expect(redundantAliasIds(g).size).toBe(0);
});
it("reports cycles including upstream aliases without fabricating a canonical source", () => {
  const g = graph(":root { --a: var(--b); --b: var(--a); --c: var(--a); }");
  expect(g.resolutions.every(r => r.status === "cycle" && !r.canonicalSourceId)).toBe(true);
  expect(g.uncertainties).toHaveLength(3); expect(redundantAliasIds(g).size).toBe(0);
});
it("reports missing references separately from unresolved semantic roles", () => {
  const g = graph(":root { --a: var(--absent); --b: var(--a); --custom: #123456; }");
  expect(g.resolutions.filter(r => r.status === "missing")).toHaveLength(2);
  expect(g.uncertainties.filter(u => u.userDecisionRequired)).toEqual([
    expect.objectContaining({ nodeId: g.nodes[2].id, category: "semantic" }),
  ]);
});
it("preserves fallback and calc expressions with references but never scalarizes them", () => {
  const g = graph(":root { --space: 4px; --a: var(--space, 8px); --b: calc(var(--space) * 2); }");
  expect(g.nodes.map(n => n.kind)).toEqual(["source", "derived", "derived"]);
  for (const r of g.resolutions.filter(r => r.status === "derived")) {
    expect(r.targetIds).toEqual([g.nodes[0].id]); expect(r.canonicalSourceId).toBeUndefined();
  }
  expect(g.nodes[1].rawValue).toBe("var(--space, 8px)"); expect(redundantAliasIds(g).size).toBe(0);
});
it("does not interpret an unsupported Tailwind variant as a shared global declaration", () => {
  const g = graph("@theme reference { --primary: red; } :root { --x: var(--primary); }");
  expect(g.nodes[0].context.supported).toBe(false);
  expect(g.resolutions.find(r => r.nodeId === g.nodes[1].id)?.status).toBe("unsupported");
});
it("does not turn a name-rule candidate into verified design intent", () => {
  const r = analyzeProject(project(":root { --primary: #123456; }"));
  expect(r.graph.nodes[0].candidates).toEqual([{ target: "colors.primary", status: "proposed", evidence: "name-rule" }]);
  expect(r.ok).toBe(false); expect(r.outputs).toHaveLength(0);
});
it("keeps distinct known semantic roles and collisions even when source values are equal", () => {
  const r = analyzeProject(project(":root { --primary: #123456; --text: var(--primary); --brand: #123456; }"));
  expect(r.aliasDecisionReduction).toHaveLength(0);
  expect(r.manual_decisions.some(d => d.kind === "conflict" && !d.resolved)).toBe(true);
  expect(r.ok).toBe(false);
});
it("preserves unknown semantic alias decisions and explicit old answers", () => {
  const p = project(":root { --custom: #123456; --export: var(--custom); }");
  const first = analyzeProject(p), alias = first.found[1];
  expect(first.manual_decisions.filter(d => d.kind === "mapping")).toHaveLength(2);
  expect(first.aliasDecisionReduction).toHaveLength(0);
  const reviewed = analyzeProject(p, { decisions: { [`map:${alias.id}`]: { ignore: true } } });
  expect(reviewed.manual_decisions.find(d => d.id === `map:${alias.id}`)?.resolved).toBe(true);
  expect(reviewed.diagnostics.some(d => d.code === "UNUSED_DECISION")).toBe(false);
  expect(first.graph).toEqual(analyzeProject(p).graph);
});
it("does not re-resolve inherited root aliases in a descendant dark scope", () => {
  const g=graph(":root { --a: red; --b: var(--a); } .dark { --a: blue; --c: var(--b); }");
  const c=g.nodes.find(n=>n.name==="--c")!;
  expect(g.resolutions.find(r=>r.nodeId===c.id)?.status).toBe("unsupported");
  expect(g.resolutions.find(r=>r.nodeId===g.nodes[1].id && r.mode==="light")?.canonicalSourceId).toBe(g.nodes[0].id);
});
it("distinguishes Tailwind definition-time alias behavior from inline consumer references", () => {
  for(const variant of ["", " static"]) {
    const g=graph(`:root { --a: red; } .dark { --a: blue; } @theme${variant} { --color-a: var(--a); }`);
    expect(g.resolutions.filter(r=>r.nodeId===g.nodes[2].id).every(r=>r.status==="unsupported")).toBe(true);
  }
  const g=graph(":root { --a: red; } .dark { --a: blue; } @theme inline { --color-a: var(--a); }");
  expect(g.resolutions.filter(r=>r.nodeId===g.nodes[2].id).every(r=>r.status==="resolved")).toBe(true);
});
it("does not prioritize CSS over a same-named Tailwind declaration", () => {
  const g=graph(":root { --a: red; --b: var(--a); } @theme { --a: blue; }");
  expect(g.resolutions.find(r=>r.nodeId===g.nodes[1].id)?.status).toBe("ambiguous");
});
it("does not equate distinct dark selectors or assume unknown stylesheet order", () => {
  const g=graph('.dark { --a: red; } [data-theme="dark"] { --b: var(--a); }');
  expect(g.resolutions.find(r=>r.nodeId===g.nodes[1].id)?.status).toBe("unsupported");
  const p=project(":root { --a: red; }"); fs.writeFileSync(path.join(p,"other.css"),".dark { --a: blue; --b: var(--a); }");
  const next=buildTokenGraph(discover(p).found);const b=next.nodes.find(n=>n.name==="--b")!;
  expect(next.resolutions.find(r=>r.nodeId===b.id)?.status).toBe("ambiguous");
});
it("does not resolve CSS-wide keywords or registered custom properties as literals", () => {
  for(const value of ["initial","inherit","unset","revert-layer","currentColor"]) {
    const g=graph(`:root { --a: ${value}; --b: var(--a); }`);
    expect(g.resolutions.every(r=>r.status==="unsupported")).toBe(true);
  }
  const p=project(":root { --a: red; --b: var(--a); }");
  fs.writeFileSync(path.join(p,"registered.css"),'@property --a { syntax: "<color>"; inherits: false; initial-value: blue; }');
  const r=analyzeProject(p); expect(r.graph.resolutions.every(r=>r.status==="unsupported")).toBe(true);expect(r.ok).toBe(false);
  fs.writeFileSync(path.join(p,"tokens.css"),":root { --b: var(--a); }");
  expect(analyzeProject(p).graph.resolutions.every(r=>r.status==="unsupported")).toBe(true);
});
it("retains primary and link roles on one source, and never groups unknown roles", () => {
  const r=analyzeProject(project(":root { --brand: #2563eb; --button-bg: var(--brand); } @theme inline { --color-primary: var(--brand); --color-link: var(--brand); }"));
  const primary=r.found.find(n=>n.variable==="--color-primary")!,link=r.found.find(n=>n.variable==="--color-link")!,button=r.found.find(n=>n.variable==="--button-bg")!;
  expect(r.aliasDecisionReduction.map(n=>n.id)).toEqual([primary.id]);
  expect(r.mappings.find(m=>m.sourceId===link.id)?.target).toBe("colors.link");
  expect(r.manual_decisions.some(d=>d.id===`map:${button.id}`&&!d.resolved)).toBe(true);
});
it("groups only an explicit Tailwind namespace export when its source role is unknown", () => {
  const r=analyzeProject(project(":root { --card: #123456; --sidebar: #123456; } @theme inline { --color-card: var(--card); --color-sidebar: var(--sidebar); }"));
  expect(r.aliasDecisionReduction).toHaveLength(2);
  expect(r.manual_decisions.filter(d=>d.kind==="mapping")).toHaveLength(2);
  expect(r.graph.nodes.every(n=>n.candidates.length===0)).toBe(true);
});
