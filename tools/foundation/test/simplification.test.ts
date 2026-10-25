import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";
import { analyzeProject, createAnswersTemplate, writeAnswersTemplate, writeFoundation } from "../index.js";
import { defaultRules } from "../defaults.js";
const dirs: string[] = [];
const css = fs.readFileSync("examples/design-foundation-journey/src/legacy.css", "utf8");
function fixture() {
 const p=fs.mkdtempSync(path.join(os.tmpdir(),"spx-simple-")); dirs.push(p);
 fs.mkdirSync(path.join(p,"src")); fs.writeFileSync(path.join(p,"src/legacy.css"),css);
 return p;
}
function answers(p:string) {
 const r=analyzeProject(p);
 const original=JSON.parse(fs.readFileSync("examples/design-foundation-journey/foundation-decisions.json","utf8"));
 for(const [token,rule] of Object.entries(defaultRules)) if(rule.classification!=="C") delete original.decisions[`value:${token}`];
 return {...original,inputHash:r.inputHash};
}
afterEach(()=>{for(const p of dirs.splice(0))fs.rmSync(p,{recursive:true,force:true});});
it("classifies 15 historical scalar answers without treating proposals as discovered",()=>{
 const old=JSON.parse(fs.readFileSync("examples/design-foundation-journey/foundation-decisions.json","utf8"));
 const counts={A:0,B:0,C:0};
 for(const id of Object.keys(old.decisions).filter(x=>x.startsWith("value:"))) counts[defaultRules[id.slice(6)].classification]++;
 expect(counts).toEqual({A:2,B:11,C:2});
 const r=analyzeProject(fixture());
 expect(r.proposed.filter(x=>x.classification==="B")).toHaveLength(11);
 expect(r.proposed.every(x=>x.origin==="documented-default" && x.reason && x.editableVia)).toBe(true);
 expect(r.ok).toBe(false);
});
it("uses seven explicit Fieldwork choices while preserving old twenty-answer output",()=>{
 const p=fixture(), o=answers(p), r=analyzeProject(p,o);
 const old=JSON.parse(fs.readFileSync("examples/design-foundation-journey/foundation-decisions.json","utf8"));old.inputHash=r.inputHash;
 expect(Object.keys(o.decisions)).toHaveLength(7);
 expect(r.ok).toBe(true);expect(r.metrics.manualDecisions).toBe(7);
 expect(r.outputs).toEqual(analyzeProject(p,old).outputs);
});
it("keeps source values and ambiguous mapping ahead of defaults",()=>{
 const p=fixture();fs.appendFileSync(path.join(p,"src/legacy.css"),'\n:root { --custom-color: #123456; --text-base: 20px; }');
 const r=analyzeProject(p);
 expect(r.manual_decisions.some(d=>d.kind==="conflict"&&!d.resolved)).toBe(true);
 expect(r.manual_decisions.some(d=>d.reason.includes("--custom-color")&&!d.resolved)).toBe(true);
 expect(r.ok).toBe(false);
});
it("allows editable proposals to be changed and rejects invalid explicit values",()=>{
 const p=fixture(),o=answers(p);o.decisions["value:typography.weights.medium"]={value:550};
 let r=analyzeProject(p,o);expect(r.ok).toBe(true);expect(r.theme.typography.weights.medium).toBe(550);
 o.decisions["value:typography.weights.medium"]={};r=analyzeProject(p,o);
 expect(r.ok).toBe(false);expect(r.diagnostics.some(d=>d.code==="INVALID_DECISION")).toBe(true);
});
it("does not auto-answer required scale, contrast or inheritance",()=>{
 const p=fixture(),o=answers(p);delete o.decisions["value:typography.scale"];
 expect(analyzeProject(p,o).ok).toBe(false);
 o.decisions["value:typography.scale"]={value:1.25};delete o.decisions["override:light.colors.textMuted"];
 expect(analyzeProject(p,o).diagnostics.some(d=>d.code==="CONTRAST"&&d.severity==="error")).toBe(true);
 fs.writeFileSync(path.join(p,"src/legacy.css"),css.replace("--brand: #60a5fa;",""));
 expect(analyzeProject(p).manual_decisions.some(d=>d.kind==="inheritance"&&!d.resolved)).toBe(true);
});
it("explains superseded proposal without applying its old value to discovered mapping",()=>{
 const p=fixture(),o=answers(p);o.decisions["value:borders.radiusSubtle"]={value:99};
 const r=analyzeProject(p,o);expect(r.ok).toBe(true);expect(r.theme.borders.radiusSubtle).toBe(8);
 expect(r.diagnostics.some(d=>d.code==="SUPERSEDED_PROPOSAL"&&d.source)).toBe(true);
 expect(createAnswersTemplate(r).decisions).not.toHaveProperty("value:borders.radiusSubtle");
});
it("templates unresolved answers as blocking empty objects and records optional proposals",()=>{
 const p=fixture(),r=analyzeProject(p),t=createAnswersTemplate(r);
 expect(Object.values(t.decisions).every(x=>Object.keys(x).length===0)).toBe(true);
 expect(t.optionalProposals).toHaveLength(13);expect(t.guidance.length).toBe(6);
 expect(analyzeProject(p,t).ok).toBe(false);expect(()=>writeFoundation(p,t)).toThrow("blocked");
 expect(fs.existsSync(path.join(p,".spexop"))).toBe(false);
});
it("writes answers exclusively and refuses symlinks, traversal and output collisions",()=>{
 const p=fixture(),r=analyzeProject(p);writeAnswersTemplate(p,"answers.json",r);
 const before=fs.readFileSync(path.join(p,"answers.json"));
 expect(()=>writeAnswersTemplate(p,"answers.json",r)).toThrow();
 expect(fs.readFileSync(path.join(p,"answers.json"))).toEqual(before);
 expect(()=>writeAnswersTemplate(p,"../escape.json",r)).toThrow();
 fs.symlinkSync(os.tmpdir(),path.join(p,"link"));
 expect(()=>writeAnswersTemplate(p,"link/answers.json",r)).toThrow("real directory");
});
it("CLI preserves decisions alias, prepares safe templates and reports blocked first run",()=>{
 const p=fixture(),cli=path.resolve("tools/foundation/dist/cli.js");
 const first=spawnSync(process.execPath,[cli,p,"--prepare-answers","answers.json"],{encoding:"utf8"});
 expect(first.status).toBe(1);expect(JSON.parse(first.stdout).answersWritten).toBe("answers.json");
 fs.writeFileSync(path.join(p,"reviewed.json"),JSON.stringify(answers(p)));
 for(const flag of ["--answers","--decisions"]) {
 const out=JSON.parse(execFileSync(process.execPath,[cli,p,flag,path.join(p,"reviewed.json")],{encoding:"utf8"}));
 expect(out.ok).toBe(true);expect(out.writePerformed).toBe(false);
 }
 expect(spawnSync(process.execPath,[cli,p,"--prepare-answers","new.json","--write"]).status).toBe(1);
 expect(fs.existsSync(path.join(p,"new.json"))).toBe(false);
});
