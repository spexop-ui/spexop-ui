// Explicit local acceptance harness; never modifies fixtures. Output directory must be new.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import postcss from 'postcss';
import {captureDesignFoundation} from '../tools/foundation/dist/capture/index.js';
import {planCanonicalCSS,renderCanonicalCSS} from '../tools/foundation/dist/css-export/index.js';
const [manifest,baseline,out,independentParserPath]=process.argv.slice(2);
if(!manifest||!baseline||!out||!independentParserPath)throw Error('fixtures.json 005G-captures NEW-output lightningcss-package-path');
const {transform}=createRequire(import.meta.url)(independentParserPath);
fs.mkdirSync(out);
const sha=x=>createHash('sha256').update(x).digest('hex'),rows=[];
for(const p of JSON.parse(fs.readFileSync(manifest,'utf8'))){
 const old=JSON.parse(fs.readFileSync(path.join(baseline,p.name+'.json'),'utf8'));
 const capture=captureDesignFoundation({projectRoot:p.path,namespace:p.name,sourceCommit:p.commit});
 assert.deepEqual(capture,old,'capture baseline changed');
 const before=Object.fromEntries(capture.sources.filter(s=>s.sha256).map(s=>[s.file,sha(fs.readFileSync(path.join(p.path,s.file)))]));
 const plan=planCanonicalCSS(capture), second=planCanonicalCSS(capture);
 assert.deepEqual(plan,second);
 let result=null; if(plan.status!=='blocked')result=renderCanonicalCSS(plan,{allowPartial:true});
 const decls=[]; if(result){
   // Lightning CSS is a separate parser, not the PostCSS serializer validation.
   transform({filename:'tokens.css',code:Buffer.from(result.css),minify:false,errorRecovery:false});
   postcss.parse(result.css).walkDecls(d=>decls.push({name:d.prop,value:d.value,selector:d.parent.selector}));
   assert.deepEqual(decls,plan.rules.flatMap(r=>r.declarations.map(d=>({name:d.name,value:d.value,selector:r.selector}))));
   assert.equal(result.sha256,renderCanonicalCSS(second,{allowPartial:true}).sha256);
 }
 for(const e of plan.entries.filter(e=>e.output)){
   const t=capture.tokens.find(t=>t.id===e.tokenId);assert.equal(t.identity.sourceName,e.name);assert.equal(t.value.raw,e.value);assert.deepEqual(e.references,t.references);assert.deepEqual(e.provenance,t.provenance);
   for(const ref of e.references)assert(plan.entries.filter(x=>x.name===ref.name).every(x=>x.output),'alias target excluded');
 }
 for(const [f,h]of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(p.path,f))),h);
 fs.writeFileSync(path.join(out,p.name+'-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 if(result)fs.writeFileSync(path.join(out,p.name+'.css'),result.css,{flag:'wx'});
 const materialized=planCanonicalCSS(capture,{themeLiterals:'materialize'});
 let materializedResult=null;
 if(materialized.status!=='blocked'){materializedResult=renderCanonicalCSS(materialized,{allowPartial:true});transform({filename:'theme-literals.css',code:Buffer.from(materializedResult.css),errorRecovery:false});fs.writeFileSync(path.join(out,p.name+'-opt-in.css'),materializedResult.css,{flag:'wx'});}
 fs.writeFileSync(path.join(out,p.name+'-opt-in-plan.json'),JSON.stringify(materialized,null,2)+'\n',{flag:'wx'});
 rows.push({project:p.name,commit:p.commit,captured:capture.tokens.length,...plan.coverage,status:plan.status,generated:result?.declarations??0,cssSha256:result?.sha256??null,planSha256:sha(JSON.stringify(plan)),wrongDeclarations:0,omittedWithoutPlan:0,sourceUnchanged:true,captureEqual005G:true,independentParser:result?'PASS':'NO_OUTPUT',limitedThemeOptIn:{eligible:materialized.coverage.eligible,transformed:materialized.coverage.transformed,generated:materializedResult?.declarations??0,sha256:materializedResult?.sha256??null},unsupported:plan.entries.filter(e=>!e.output).map(e=>({name:e.name,file:e.provenance.file,reasons:e.reasons}))});
}
fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(rows,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(({unsupported,...r})=>r),null,2));
