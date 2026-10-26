import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { analyzeProject, createAnswersTemplate } from "../index.js";
const dirs:string[]=[];
function project(css:string){const p=fs.mkdtempSync(path.join(os.tmpdir(),"spx-review-"));dirs.push(p);fs.writeFileSync(path.join(p,"tokens.css"),css);return p;}
afterEach(()=>{for(const p of dirs.splice(0))fs.rmSync(p,{recursive:true,force:true});});
it("shows value-validation blockers next to semantic proposals even when CSS resolution succeeds",()=>{
 const r=analyzeProject(project(":root { --spacing: 0.25rem; }"));
 const id=r.found[0].id;
 expect(r.graph.resolutions.find(x=>x.nodeId===id)?.status).toBe("resolved");
 expect(r.review.semanticProposals.find(x=>x.sourceId===id)?.blockedBy).toContain("UNSUPPORTED_UNIT");
 expect(r.review.unsupportedExcluded.some(x=>x.sourceId===id&&x.reason.includes("UNSUPPORTED_UNIT"))).toBe(true);
 expect(r.ok).toBe(false);expect(r.outputs).toEqual([]);
});
it("reports every original source and explains unresolved semantic alias chains without invented output names",()=>{
 const p=project(":root { --custom: #123456; --role: var(--custom); }");const r=analyzeProject(p);
 expect(r.review.discoveredSources.map(s=>s.id)).toEqual(r.found.map(s=>s.id));
 const role=r.found[1],d=r.review.requiredDecisions.find(d=>d.id===`map:${role.id}`)!;
 expect(d.aliasChains[0].nodeIds).toEqual([role.id,r.found[0].id]);
 expect(d.sources[0].provenance).toEqual(role.source);expect(d.impact.certainty).toBe("unassigned");
 expect(d.impact.cssTokens).toEqual([]);expect(d.impact.blockedFiles).toEqual(r.plannedOutputPaths);
 expect(fs.readdirSync(p)).toEqual(["tokens.css"]);
});
it("keeps prepare-answers exactly aligned with required decisions and recorded answers",()=>{
 const p=project(":root { --custom: #123456; --alias: var(--custom); }");const first=analyzeProject(p);
 const id=`map:${first.found[0].id}`;const r=analyzeProject(p,{inputHash:first.inputHash,decisions:{[id]:{ignore:true}}});const t=createAnswersTemplate(r);
 expect(t.guidance.map(d=>d.id)).toEqual(r.review.requiredDecisions.map(d=>d.id));
 expect(Object.keys(t.decisions).sort()).toEqual([...r.review.requiredDecisions,...r.review.recordedDecisions].map(d=>d.id).sort());
 expect(t.guidance.every(d=>d.review?.impact.blockedFiles.length===3)).toBe(true);
 expect(r.review.unsupportedExcluded.some(x=>x.sourceId===first.found[0].id&&x.classification==="explicit-exclusion")).toBe(true);
});
it("does not ask arbitrary mapping questions for unsupported contexts or pretend they are editable proposals",()=>{
 const r=analyzeProject(project(':root { --base: red; } @theme { --color-primary: var(--base); } .widget { --unknown: blue; }'));
 const ids=r.found.slice(1).map(n=>n.id);expect(r.manual_decisions.some(d=>ids.some(id=>d.id===`map:${id}`))).toBe(false);
 expect(r.review.unsupportedExcluded.some(x=>x.sourceId===ids[0]&&x.blockedFiles?.length===3)).toBe(true);
 const proposal=r.review.semanticProposals.find(x=>x.sourceId===ids[0])!;
 expect(proposal.certainty).toBe("proposal");expect(proposal.editableVia).toBeUndefined();expect(proposal.blockedBy.length).toBeGreaterThan(0);
});
it("allows an explicit semantic proposal correction without rewriting source values",()=>{
 const p=project(":root { --primary: #2563eb; }");const first=analyzeProject(p),source=first.found[0];
 const r=analyzeProject(p,{inputHash:first.inputHash,decisions:{[`map:${source.id}`]:{target:"colors.link"}}});
 expect(r.mappings.find(m=>m.sourceId===source.id)).toMatchObject({target:"colors.link",value:"#2563eb",method:"user"});
 expect(r.review.semanticProposals[0]).toMatchObject({target:"colors.primary",certainty:"proposal",appliedModes:[]});
 const impact=r.review.outputImpact.find(d=>d.decisionId===`map:${source.id}`)!;
 expect(impact.cssTokens).toContain("--theme-link");expect(impact.tailwindTokens).toContain("--color-link");expect(impact.dtcgPaths).toContain("light.colors.link");
 expect(r.found).toEqual(first.found);
});
it("preserves separate primary and link proposal identities even when aliases share one source",()=>{
 const r=analyzeProject(project(":root { --brand: #2563eb; } @theme inline { --color-primary: var(--brand); --color-link: var(--brand); }"));
 const proposals=r.review.semanticProposals.filter(p=>p.sourceId.includes("--color-"));
 expect(proposals.map(p=>p.target)).toEqual(["colors.primary","colors.link"]);
 expect(new Set(proposals.map(p=>p.sourceId)).size).toBe(2);
 expect(r.review.resolvedAliases.filter(a=>a.mode==="light").every(a=>a.canonicalSourceId===r.found[0].id)).toBe(true);
});
it("maps impact metadata to real generated CSS Tailwind and DTCG fields",()=>{
 const p=project(fs.readFileSync("examples/design-foundation-journey/src/legacy.css","utf8"));
 // This test uses reviewed fixture decisions only, not universal defaults.
 const old=JSON.parse(fs.readFileSync("examples/design-foundation-journey/foundation-decisions.json","utf8"));
 old.inputHash=analyzeProject(p).inputHash;
 old.decisions=Object.fromEntries(Object.entries(old.decisions).map(([k,v])=>[k.replace("src/legacy.css", "tokens.css"),v]));
 const r=analyzeProject(p,old);expect(r.ok).toBe(true);
 const css=r.outputs.find(x=>x.path.endsWith("/theme.css"))!.content,tw=r.outputs.find(x=>x.path.endsWith("/tailwind.css"))!.content;
 const dtcg=JSON.parse(r.outputs.find(x=>x.path.endsWith(".json"))!.content);
 for(const impact of r.review.outputImpact) {
   for(const name of impact.cssTokens.filter(n=>!n.includes("*")))expect(css).toContain(`${name}:`);
   for(const name of impact.tailwindTokens.filter(n=>!n.includes("*")))expect(tw).toContain(`${name}:`);
   for(const name of impact.dtcgPaths.filter(n=>!n.startsWith("$extensions"))) {
     let value:unknown=dtcg;for(const key of name.split("."))value=(value as Record<string,unknown>)[key];expect(value).toBeDefined();
   }
 }
 expect(r.review.requiredDecisions).toHaveLength(0);
});
