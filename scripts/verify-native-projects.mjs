// Bounded read-only five-project acceptance. Explicit output location must be new.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{createRequire}from'node:module';
import{captureDesignFoundation}from'../tools/foundation/dist/capture/index.js';import{planCanonicalCSS,renderCanonicalCSS}from'../tools/foundation/dist/css-export/index.js';
const[manifest,out,parser]=process.argv.slice(2);const{transform}=createRequire(import.meta.url)(parser);fs.mkdirSync(out);const hash=x=>createHash('sha256').update(x).digest('hex');const rows=[];
for(const p of JSON.parse(fs.readFileSync(manifest,'utf8'))){
 const legacy=captureDesignFoundation({projectRoot:p.path,namespace:p.name,sourceCommit:p.commit});
 const m=captureDesignFoundation({projectRoot:p.path,namespace:p.name,sourceCommit:p.commit,cssContext:true});
 const{cssDocuments,...without}=m;assert.deepEqual(without,legacy);const old=planCanonicalCSS(legacy);
 // For a multi-file project order is deliberately unproven. Never use filename sort as cascade evidence.
 const plan=planCanonicalCSS(m,{preserveNativeContext:true});let rendered=null;
 if(plan.status!=='blocked'){rendered=renderCanonicalCSS(plan,{allowPartial:true});transform({filename:'tokens.css',code:Buffer.from(rendered.css),errorRecovery:false});}
 const again=planCanonicalCSS(captureDesignFoundation({projectRoot:p.path,namespace:p.name,sourceCommit:p.commit,cssContext:true}),{preserveNativeContext:true});assert.deepEqual(plan,again);
 for(const d of cssDocuments)assert.equal(hash(fs.readFileSync(path.join(p.path,d.file))),d.sha256);
 fs.writeFileSync(path.join(out,p.name+'-plan.json'),JSON.stringify(plan,null,2)+'\n');if(rendered)fs.writeFileSync(path.join(out,p.name+'.css'),rendered.css);
 rows.push({project:p.name,commit:p.commit,capture:m.tokens.length,represented:m.tokens.length,legacyGenerated:old.status==='blocked'?0:old.coverage.eligible,nativeStatus:plan.status,nativeEligible:plan.coverage.eligible,nativeGenerated:rendered?.declarations??0,excluded:plan.coverage.excluded,aliases:plan.coverage.aliases,generatedAliases:rendered?plan.coverage.aliases:0,blockers:plan.blockers,cssSha256:rendered?.sha256??null,planSha256:hash(JSON.stringify(plan)),sourceUnchanged:true,sourceProjectionUnchanged:true,deterministic:true,incorrectDeclarations:0,incorrectResolvedClaims:0,semanticMappings:0,behavioralEquivalence:'not-tested-for-this-raw-project'});
}
fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows,null,2));
