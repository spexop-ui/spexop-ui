import { describe,it,expect } from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import postcss from 'postcss';
import {verifyBuildEvidence,buildContextFromEvidence,collectBuildEvidence,type BuildReceipt,type BuildOptions} from '../build-evidence/index.js';
const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
/** Synthetic receipt tests validate integrity, not actual build execution/attestation. */
function bundle() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'build-receipt-')),runId=randomUUID();
  const source=':root { --brand: #123456; --alias: var(--brand); }';
  const result=postcss([{postcssPlugin:'fixture',Once(){}}]).process(source,{from:'/work/src/input.css',to:'/work/dist/assets/site.css',map:{inline:false,annotation:'site.css.map',sourcesContent:true}});
  const data:Record<string,string>={'inputs/src/input.css':source,'outputs/assets/site.css':result.css,'outputs/assets/site.css.map':result.map!.toString(),'sandbox.sb':'test-only synthetic profile'};
  for(const[p,s]of Object.entries(data)){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);}
  const record=(p:string,s:string)=>({runId,path:p,bytes:Buffer.byteLength(s),sha256:hash(s)});
  const receipt:BuildReceipt={schemaVersion:'0.1',runId,startedAt:'2026-10-26T00:00:00Z',finishedAt:'2026-10-26T00:00:01Z',source:{repository:'https://example.test/repo',commit:'a'.repeat(40),revisionTrust:'caller-asserted',files:[record('src/input.css',source)]},command:{node:process.execPath,nodeSha256:'0'.repeat(64),script:'node_modules/vite/bin/vite.js',args:['build','--outDir','dist'],collectorRuntime:process.version,platform:process.platform},configFiles:[],outputDirectory:'dist',dependencies:{sha256:'0'.repeat(64),entries:0},packages:[{name:'vite',version:'8.2.0',sha256:'0'.repeat(64)}],sandbox:{kind:'macos-seatbelt',profileSha256:hash(data['sandbox.sb']),network:'denied',environmentKeys:['PATH','HOME','TMPDIR']},execution:{exitCode:0,signal:null,error:false,stdoutSha256:hash(''),stderrSha256:hash(''),stdoutBytes:0,stderrBytes:0},status:'success',inputUnchanged:true,outputs:[record('assets/site.css',result.css),record('assets/site.css.map',result.map!.toString())],diagnostics:[],trust:'local-controlled-record-not-attestation'};
  const seal=()=>{const text=JSON.stringify(receipt);fs.writeFileSync(path.join(root,'receipt.json'),text);return hash(text);};
  const anchor=seal();const edit=(p:string,s:string)=>{fs.writeFileSync(path.join(root,p),s);const f=(p.startsWith('inputs/')?receipt.source.files:receipt.outputs).find(f=>p.endsWith(f.path));if(f){f.sha256=hash(s);f.bytes=Buffer.byteLength(s);}};
  return{root,receipt,anchor,seal,edit,data,cleanup:()=>fs.rmSync(root,{recursive:true})};
}
describe('local build evidence integrity',()=>{
  it('binds exact source-map declarations to run identity, never behavioral equivalence',()=>{
    const b=bundle();try{expect(verifyBuildEvidence(b.root,b.anchor).ok).toBe(true);const r=buildContextFromEvidence(b.root,b.anchor);expect(r.runBoundPositionalLinks).toHaveLength(2);expect(r.context.coverage.provenSourceBuildRelations).toBe(0);expect(r.runBoundPositionalLinks.every(l=>l.certainty==='partial'&&l.runId===b.receipt.runId)).toBe(true);expect(r.behavioralEquivalence).toBe('not-proven');}finally{b.cleanup();}
  });
  it.each(['receipt','css','map','source','profile','extra','missing'])('rejects modified %s against external anchor',kind=>{
    const b=bundle();try{const target={receipt:'receipt.json',css:'outputs/assets/site.css',map:'outputs/assets/site.css.map',source:'inputs/src/input.css',profile:'sandbox.sb',extra:'outputs/extra.css',missing:'outputs/assets/site.css.map'}[kind]!;
      if(kind==='missing')fs.unlinkSync(path.join(b.root,target));else fs.appendFileSync(path.join(b.root,target),'changed');
      expect(verifyBuildEvidence(b.root,b.anchor).ok).toBe(false);
    }finally{b.cleanup();}
  });
  it('rejects foreign run membership even with resealed test metadata',()=>{const b=bundle();try{b.receipt.outputs[1].runId=randomUUID();expect(verifyBuildEvidence(b.root,b.seal()).ok).toBe(false);}finally{b.cleanup();}});
  it.each(['failed','partial','source-changed','timeout'])('does not accept %s build',kind=>{const b=bundle();try{
    if(kind==='failed')b.receipt.execution.exitCode=1;
    if(kind==='partial')b.receipt.status='invalid';
    if(kind==='source-changed')b.receipt.inputUnchanged=false;
    if(kind==='timeout'){b.receipt.execution.signal='SIGTERM';b.receipt.execution.error=true;}
    expect(()=>buildContextFromEvidence(b.root,b.seal())).toThrow();
  }finally{b.cleanup();}});
  it.each(['stale-source','missing-content','broken-mappings','renamed-token','missing-map','duplicate-generated'])('does not promote unsupported %s map links',kind=>{
    const b=bundle();try{const raw=JSON.parse(b.data['outputs/assets/site.css.map']);
      if(kind==='stale-source')raw.sourcesContent[0]+='/* stale */';
      if(kind==='missing-content')delete raw.sourcesContent;
      if(kind==='broken-mappings')raw.mappings='!!!';
      if(kind==='renamed-token')b.edit('outputs/assets/site.css',b.data['outputs/assets/site.css'].replaceAll('--brand','--renamed').replaceAll('--alias','--other'));
      if(kind==='missing-map'){fs.unlinkSync(path.join(b.root,'outputs/assets/site.css.map'));b.receipt.outputs.pop();}
      else {if(kind==='duplicate-generated'){raw.mappings='AAAA,AAAA';}b.edit('outputs/assets/site.css.map',JSON.stringify(raw));}
      const r=buildContextFromEvidence(b.root,b.seal());expect(r.runBoundPositionalLinks).toHaveLength(0);expect(r.context.coverage.provenSourceBuildRelations).toBe(0);
    }finally{b.cleanup();}
  });
  it.each(['symlink','hardlink','escape','oversized'])('refuses %s artifact',kind=>{const b=bundle();try{
    const p=path.join(b.root,'outputs/assets/site.css');
    if(kind==='symlink'){fs.unlinkSync(p);fs.symlinkSync(path.join(b.root,'inputs/src/input.css'),p);}
    if(kind==='hardlink'){fs.unlinkSync(p);fs.linkSync(path.join(b.root,'inputs/src/input.css'),p);}
    if(kind==='escape')b.receipt.outputs[0].path='../outside.css';
    if(kind==='oversized')fs.writeFileSync(p,Buffer.alloc(8*1024*1024+1));
    expect(verifyBuildEvidence(b.root,kind==='escape'?b.seal():b.anchor).ok).toBe(false);
  }finally{b.cleanup();}});
  it('does not bind wrong browser body or invent load order',()=>{const b=bundle();try{
    const r=buildContextFromEvidence(b.root,b.anchor,{documentURL:'http://localhost/',observedAt:'2026-10-26T00:00:00Z',collector:'test',state:'light',completeDocumentInventory:true,dynamicChangesObserved:false,shadowRootsObserved:false,slots:[{id:'x',order:1,root:'document',kind:'link',url:'http://localhost/site.css',media:'',disabled:false,alternate:false,cssText:'wrong'}]});expect(r.context.sourceOrder).toBeNull();expect(r.context.slots[0].artifactFiles).toHaveLength(0);
  }finally{b.cleanup();}});
  it.each(['.env','.env.production','.npmrc','keys/private.pem'])('rejects credential input %s before any execution',p=>{
    expect(()=>collectBuildEvidence({approved:true,sourceFiles:[p]} as unknown as BuildOptions)).toThrow();
  });
  it('rejects preexisting dependency directory as output',()=>{expect(()=>collectBuildEvidence({approved:true,sourceFiles:['source.css'],script:'node_modules/tool.js',outputDirectory:'node_modules'} as unknown as BuildOptions)).toThrow();});
});
