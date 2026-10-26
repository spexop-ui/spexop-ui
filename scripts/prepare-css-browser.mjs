// Acceptance-only integration copy. Not product code; original Fieldwork and prior evidence are immutable.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import postcss from 'postcss';
import {captureDesignFoundation} from '../tools/foundation/dist/capture/index.js';import{planCanonicalCSS,renderCanonicalCSS}from'../tools/foundation/dist/css-export/index.js';
const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('SOURCE NEW-OUTPUT');fs.mkdirSync(out);
for(const f of ['src','index.html','vite.config.ts','tsconfig.json','package.json'])fs.cpSync(path.join(source,f),path.join(out,f),{recursive:true});
fs.symlinkSync(path.resolve(source,'node_modules'),path.join(out,'node_modules'),'dir');
const original=fs.readFileSync(path.join(source,'src/legacy.css'),'utf8');
fs.copyFileSync(path.join(source,'.spexop/foundation/tailwind.css'),path.join(out,'src/base-theme.css'));
// Synthetic two-step alias probe extends the acceptance copy only; counts separately from real-project matrix.
const probes='\n:root { --acceptance-alias: var(--brand); --acceptance-chain: var(--acceptance-alias); }\n';
fs.writeFileSync(path.join(out,'src/source-theme.css'),original+probes);
const capture=captureDesignFoundation({projectRoot:out,cssFiles:['src/source-theme.css']}),plan=planCanonicalCSS(capture),result=renderCanonicalCSS(plan,{allowPartial:true});
const accepted=new Set(plan.entries.filter(e=>e.output).map(e=>`${e.provenance.line}:${e.provenance.column}:${e.name}`));
const remaining=postcss.parse(original+probes);remaining.walkDecls(d=>{if(accepted.has(`${d.source.start.line}:${d.source.start.column}:${d.prop}`))d.remove();});
remaining.walkRules(r=>{if(!r.nodes.length)r.remove();});
fs.writeFileSync(path.join(out,'src/export-theme.css'),remaining.toString()+'\n'+result.css);
// Retain unsupported declarations, ordinary rules, Tailwind import and utility definitions in BOTH copies.
const main=fs.readFileSync(path.join(out,'src/main.tsx'),'utf8').replace('import "../.spexop/foundation/tailwind.css";',`import './base-theme.css';\nif(new URLSearchParams(location.search).get('variant')==='export') await import('./export-theme.css'); else await import('./source-theme.css');\nimport './acceptance-probes.css';`);
fs.writeFileSync(path.join(out,'src/main.tsx'),main);
fs.writeFileSync(path.join(out,'src/acceptance-probes.css'),'.eyebrow {color: var(--acceptance-chain)} .site-header { background:var(--surface); color:var(--ink); border-color:var(--line); padding:var(--space-4) var(--space-6); } .panel {border-color:var(--line);border-radius:var(--radius)}');
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(source,'src/legacy.css'))),sha(original));
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2));
fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({source,sourceSHA256:sha(original),planCoverage:plan.coverage,exportHash:result.sha256,syntheticAliasDeclarations:2,retainedUnsupported:plan.coverage.excluded,scope:'Actual Fieldwork React application: existing legacy token CSS consumed by explicit header/panel/eyebrow bindings in BOTH acceptance copies. Two additional alias probes. Partial replacement retains font and base Theme/Tailwind styles. This is a bounded integration comparison, NOT untouched-application or raw onboarding success.'},null,2));
console.log(JSON.stringify(plan.coverage));
