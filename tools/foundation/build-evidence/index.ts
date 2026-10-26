import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureDesignFoundation } from '../capture/index.js';
import { inspectBuildContext, type StylesheetObservation, type MapEvidence } from '../build-context/index.js';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const MAX = 8 * 1024 * 1024;
const inside = (root: string, file: string) => file === root || file.startsWith(root + path.sep);
const relative = (p: string) => typeof p === 'string' && !!p && !path.isAbsolute(p) && !p.includes('\\') && !p.includes('\0') && p.split('/').every(s => !!s && s !== '.' && s !== '..');
const credentialName = (p: string) => p.split('/').some(s => /^(?:\.env(?:\..*)?|\.npmrc|\.netrc|\.aws|\.ssh|id_rsa|id_ed25519|credentials(?:\.json)?|secrets?\.json)$/i.test(s) || /\.(?:pem|key|p12)$/i.test(s));
function rootDir(p: string): string {
  if (fs.lstatSync(p).isSymbolicLink() || !fs.statSync(p).isDirectory()) throw new Error('Real directory required');
  return fs.realpathSync(p);
}
function bytes(root: string, file: string, max = MAX): Buffer {
  if (!relative(file)) throw new Error('Unsafe relative path');
  let current = root;
  for (const part of file.split('/')) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink refused'); }
  if (!inside(root, fs.realpathSync(current))) throw new Error('Path escape');
  const before = fs.lstatSync(current);
  if (!before.isFile() || before.nlink !== 1 || before.size > max) throw new Error('Nonregular, hardlinked or oversized input');
  const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = fs.fstatSync(fd);
    if (opened.ino !== before.ino || opened.dev !== before.dev) throw new Error('File changed');
    const b = Buffer.alloc(Math.min(opened.size + 1, max + 1)); let n = 0, count;
    while (n < b.length && (count = fs.readSync(fd, b, n, b.length - n, null)) > 0) n += count;
    const after = fs.fstatSync(fd), named = fs.lstatSync(current);
    if (n !== opened.size || n > max || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || named.ino !== opened.ino || named.isSymbolicLink()) throw new Error('File changed during capture');
    return b.subarray(0, n);
  } finally { fs.closeSync(fd); }
}
function files(root: string, limit = 500): string[] {
  const out: string[] = []; let entries = 0;
  function walk(dir: string, depth: number) {
    if (depth > 40) throw new Error('Directory depth limit');
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name < b.name ? -1 : 1)) {
      if (++entries > limit * 4) throw new Error('Entry limit');
      const f = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new Error('Output symlink refused');
      if (e.isDirectory()) walk(f, depth + 1); else { out.push(path.relative(root, f).split(path.sep).join('/')); if(out.length > limit) throw new Error('File limit'); }
    }
  }
  walk(root, 0); return out;
}
function seedIdentity(root: string) {
  const h = createHash('sha256'); let count = 0;
  function walk(dir: string, depth: number) {
    if(depth > 80) throw new Error('Dependency depth limit');
    for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name < b.name ? -1 : 1)) {
      if(++count > 100000) throw new Error('Dependency entry limit');
      const f=path.join(dir,e.name), rel=path.relative(root,f);
      if(e.isSymbolicLink()) { if(!inside(root,fs.realpathSync(f))) throw new Error('Dependency link escapes seed'); h.update(JSON.stringify([rel,'link',fs.readlinkSync(f)])); }
      else if(e.isDirectory()) walk(f,depth+1);
      else h.update(JSON.stringify([rel,sha(bytes(root,rel.split(path.sep).join('/'),128*1024*1024))]));
    }
  }
  walk(root,0); return {sha256:h.digest('hex'),entries:count};
}
export interface BuildOptions {
  approved: true; sourceRoot: string; sourceFiles: readonly string[]; dependencyRoot: string; evidenceParent: string;
  repository: string; sourceCommit: string;
  /** Absolute reviewed Node executable and relative reviewed script; never a shell. */
  node: string; script: string; args: readonly string[]; outputDirectory: string;
  configFiles: readonly string[]; packages: readonly string[]; timeoutMs?: number;
}
export interface EvidenceFile { runId: string; path: string; sha256: string; bytes: number }
export interface BuildReceipt {
  schemaVersion: '0.1'; runId: string; startedAt: string; finishedAt: string;
  source: { repository: string; commit: string; revisionTrust: 'caller-asserted'; files: EvidenceFile[] };
  command: { node: string; nodeSha256: string; script: string; args: string[]; collectorRuntime: string; platform: string };
  configFiles: string[]; outputDirectory:string; dependencies: {sha256:string;entries:number}; packages: Array<{name:string;version:string;sha256:string}>;
  sandbox: {kind:'macos-seatbelt';profileSha256:string;network:'denied';environmentKeys:string[]};
  execution: {exitCode:number|null;signal:string|null;error:boolean;stdoutSha256:string;stderrSha256:string;stdoutBytes:number;stderrBytes:number};
  status:'success'|'failed'|'invalid'; inputUnchanged:boolean; outputs:EvidenceFile[]; diagnostics:string[];
  trust:'local-controlled-record-not-attestation';
}
function save(root:string, file:string, data:Buffer|string) { const target=path.join(root,file); fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700}); fs.writeFileSync(target,data,{flag:'wx',mode:0o600}); }
function record(runId:string,p:string,data:Buffer):EvidenceFile{return{runId,path:p,sha256:sha(data),bytes:data.length};}
/** One explicit local build, no installation, command discovery, shell or inherited environment. */
export function collectBuildEvidence(o: BuildOptions) {
  if(process.platform !== 'darwin') throw new Error('OS isolation adapter unsupported');
  if(!o || o.approved !== true || !Array.isArray(o.sourceFiles) || !o.sourceFiles.length || o.sourceFiles.length > 500 ||
    new Set(o.sourceFiles).size !== o.sourceFiles.length || o.sourceFiles.some(f=>!relative(f)||credentialName(f)||f.split('/').includes('node_modules')) ||
    !relative(o.script) || !o.script.startsWith('node_modules/') || !relative(o.outputDirectory) || o.outputDirectory.includes('/') || o.outputDirectory === 'node_modules' ||
    !path.isAbsolute(o.node) || !/^[a-f0-9]{40}$/i.test(o.sourceCommit) ||
    o.args.some(a=>typeof a!=='string'||a.length>1000||/[\r\n\0]/.test(a)||/(?:token|password|secret|credential|https?:\/\/)/i.test(a)) ||
    o.configFiles.some(f=>!o.sourceFiles.includes(f)) || o.packages.some(p=>!/^(@[a-z0-9_-]+\/)?[a-z0-9_.-]+$/i.test(p))) throw new Error('Unapproved or unsafe build specification');
  const original=rootDir(o.sourceRoot), deps=rootDir(o.dependencyRoot), parent=rootDir(o.evidenceParent);
  if(inside(original,parent)||inside(deps,parent)||o.sourceFiles.some(f=>f===o.outputDirectory||f.startsWith(o.outputDirectory+'/'))) throw new Error('Evidence/output overlaps input');
  const runId=randomUUID(), run=fs.mkdtempSync(path.join(parent,'run-'));fs.chmodSync(run,0o700);
  const work=path.join(run,'work'), home=path.join(run,'home'), temp=path.join(run,'temp');
  for(const d of [work,home,temp,path.join(run,'inputs'),path.join(run,'outputs')])fs.mkdirSync(d,{mode:0o700});
  let total=0;
  const inputFiles=o.sourceFiles.slice().sort().map(f=>{const b=bytes(original,f);total+=b.length;if(total>128*1024*1024)throw new Error('Input size limit');save(path.join(run,'inputs'),f,b);save(work,f,b);return record(runId,f,b);});
  const dependencyIdentity=seedIdentity(deps);
  fs.cpSync(deps,path.join(work,'node_modules'),{recursive:true,verbatimSymlinks:true,mode:fs.constants.COPYFILE_FICLONE});
  if(JSON.stringify(seedIdentity(path.join(work,'node_modules')))!==JSON.stringify(dependencyIdentity)||JSON.stringify(seedIdentity(deps))!==JSON.stringify(dependencyIdentity))throw new Error('Dependency seed changed');
  if(fs.existsSync(path.join(work,o.outputDirectory)))throw new Error('Build output must not preexist');
  const packages=o.packages.map(name=>{const b=bytes(work,`node_modules/${name}/package.json`);const p=JSON.parse(b.toString('utf8'));if(p.name!==name||typeof p.version!=='string')throw new Error('Package identity mismatch');return{name,version:p.version,sha256:sha(b)};});
  // The executable/script is explicit and inspected, but never an authenticated compiler claim.
  bytes(work,o.script);
  const q=(s:string)=>JSON.stringify(s);
  const writable=[work,home,temp].map(p=>`(subpath ${q(p)})`).join(' ');
  const profile=`(version 1)\n(allow default)\n(deny network*)\n(deny file-read-data (require-all (subpath "/Users") (require-not (subpath ${q(run)}))))\n(deny file-read-data (require-all (require-any (subpath "/private/var/folders") (subpath "/private/tmp") (subpath "/Volumes") (subpath "/var/root") (subpath "/private/var/root") (subpath "/Library/Keychains")) (require-not (subpath ${q(run)}))))\n(deny file-write* (require-not (require-any ${writable} (literal "/dev/null"))))\n(deny mach-lookup (global-name "com.apple.securityd"))\n`;
  save(run,'sandbox.sb',profile);
  const env={PATH:path.dirname(o.node)+':/usr/bin:/bin',HOME:home,TMPDIR:temp,LANG:'C',TZ:'UTC',CI:'1'};
  const startedAt=new Date().toISOString();
  const result=spawnSync('/usr/bin/sandbox-exec',['-f',path.join(run,'sandbox.sb'),o.node,o.script,...o.args],{cwd:work,env,timeout:o.timeoutMs??120000,maxBuffer:4*1024*1024,encoding:'buffer'});
  const diagnostics:string[]=[];let unchanged=true;
  for(const f of inputFiles){try{if(sha(bytes(work,f.path))!==f.sha256||sha(bytes(original,f.path))!==f.sha256)unchanged=false;}catch{unchanged=false;}}
  if(!unchanged)diagnostics.push('INPUT_CHANGED');
  const outputs:EvidenceFile[]=[];total=0;
  try { const out=rootDir(path.join(work,o.outputDirectory));for(const f of files(out)){if(credentialName(f))throw new Error('Credential filename in output');const b=bytes(out,f);total+=b.length;if(total>128*1024*1024)throw new Error('Output size limit');save(path.join(run,'outputs'),f,b);outputs.push(record(runId,f,b));} }
  catch{diagnostics.push('OUTPUT_CAPTURE_FAILED');}
  if(!outputs.some(f=>f.path.endsWith('.css')))diagnostics.push('NO_CSS_OUTPUT');
  if(!outputs.some(f=>f.path.endsWith('.css.map')))diagnostics.push('NO_CSS_MAP');
  const receipt:BuildReceipt={schemaVersion:'0.1',runId,startedAt,finishedAt:new Date().toISOString(),source:{repository:o.repository,commit:o.sourceCommit,revisionTrust:'caller-asserted',files:inputFiles},
    command:{node:o.node,nodeSha256:sha(fs.readFileSync(o.node)),script:o.script,args:[...o.args],collectorRuntime:process.version,platform:process.platform},configFiles:[...o.configFiles],outputDirectory:o.outputDirectory,dependencies:dependencyIdentity,packages,
    sandbox:{kind:'macos-seatbelt',profileSha256:sha(profile),network:'denied',environmentKeys:Object.keys(env)},
    execution:{exitCode:result.status,signal:result.signal,error:!!result.error,stdoutSha256:sha(result.stdout??''),stderrSha256:sha(result.stderr??''),stdoutBytes:result.stdout?.length??0,stderrBytes:result.stderr?.length??0},
    status:!unchanged||diagnostics.includes('OUTPUT_CAPTURE_FAILED')?'invalid':result.status===0&&!result.error&&!diagnostics.includes('NO_CSS_OUTPUT')?'success':'failed',inputUnchanged:unchanged,outputs,diagnostics,trust:'local-controlled-record-not-attestation'};
  const text=JSON.stringify(receipt,null,2)+'\n';save(run,'receipt.json',text);
  return {directory:run,receiptSha256:sha(text),receipt};
}

/** The expected digest must come from the collector return, not from inside this bundle. */
export function verifyBuildEvidence(directory:string,expectedReceiptSha256:string) {
  const errors:string[]=[];let receipt:BuildReceipt|undefined;
  try {
    const root=rootDir(directory), b=bytes(root,'receipt.json');
    if(!/^[a-f0-9]{64}$/.test(expectedReceiptSha256)||sha(b)!==expectedReceiptSha256)throw new Error('Receipt anchor mismatch');
    receipt=JSON.parse(b.toString('utf8')) as BuildReceipt;
    if(receipt.schemaVersion!=='0.1'||! /^[0-9a-f-]{36}$/.test(receipt.runId)||receipt.trust!=='local-controlled-record-not-attestation')throw new Error('Receipt schema');
    if(sha(bytes(root,'sandbox.sb'))!==receipt.sandbox.profileSha256)throw new Error('Sandbox profile changed');
    for(const [kind,records]of [['inputs',receipt.source.files],['outputs',receipt.outputs]] as const){
      if(!Array.isArray(records)||records.length>500||new Set(records.map(f=>f.path)).size!==records.length)throw new Error('File inventory invalid');
      const actual=files(rootDir(path.join(root,kind)));
      if(JSON.stringify([...actual].sort())!==JSON.stringify(records.map(f=>f.path).sort()))throw new Error('Unrecorded or missing file');
      for(const f of records){if(f.runId!==receipt.runId||!relative(f.path))throw new Error('Cross-run or unsafe file');const data=bytes(path.join(root,kind),f.path);if(data.length!==f.bytes||sha(data)!==f.sha256)throw new Error('File content changed');}
    }
    if(receipt.status!=='success'||receipt.execution.exitCode!==0||receipt.execution.error||receipt.execution.signal||!receipt.inputUnchanged)errors.push('BUILD_NOT_ACCEPTED');
  }catch{errors.push('INTEGRITY_FAILED');}
  return {ok:errors.length===0,errors,receipt};
}

export function buildContextFromEvidence(directory:string,expectedReceiptSha256:string,observation?:StylesheetObservation) {
  const verified=verifyBuildEvidence(directory,expectedReceiptSha256);
  if(!verified.ok||!verified.receipt)throw new Error('Build evidence is not accepted');
  const root=rootDir(directory),r=verified.receipt;
  const source=captureDesignFoundation({projectRoot:path.join(root,'inputs'),cssFiles:r.source.files.filter(f=>f.path.endsWith('.css')).map(f=>f.path),sourceCommit:r.source.commit,namespace:'source:'+r.runId,cssContext:true});
  const compiled=captureDesignFoundation({projectRoot:path.join(root,'outputs'),cssFiles:r.outputs.filter(f=>f.path.endsWith('.css')).map(f=>f.path),namespace:'compiled:'+r.runId,cssContext:true});
  const maps:MapEvidence[]=[];const diagnostics:string[]=[];
  for(const doc of compiled.cssDocuments??[]){
    const annotations=[...doc.sourceText.matchAll(/\/\*#\s*sourceMappingURL=([^\s*]+)\s*\*\//g)];
    if(annotations.length!==1){diagnostics.push('MAP_ANNOTATION_MISSING_OR_AMBIGUOUS:'+doc.file);continue;}
    const url=annotations[0][1];if(!relative(url)||url.includes(':')||url.includes('?')||url.includes('#')){diagnostics.push('MAP_URL_UNSUPPORTED:'+doc.file);continue;}
    const mapPath=path.posix.join(path.posix.dirname(doc.file),url);
    const mf=r.outputs.find(f=>f.path===mapPath);if(!mf){diagnostics.push('MAP_NOT_IN_RUN:'+doc.file);continue;}
    try{
      const text=bytes(path.join(root,'outputs'),mapPath,2*1024*1024).toString('utf8'),raw=JSON.parse(text),bindings:Record<string,string>={};
      if(!Array.isArray(raw.sources)||raw.sourceRoot||raw.sections)throw new Error('Unsupported map');
      for(const name of raw.sources){
        if(typeof name!=='string'||path.isAbsolute(name)||name.includes(':')||name.includes('\\'))continue;
        // Source-map URLs are relative to map URL. The recorded build output directory is part of that coordinate system.
        const outDir=r.outputDirectory;
        if(!relative(outDir??''))continue;
        const candidate=path.posix.normalize(path.posix.join(outDir,path.posix.dirname(mapPath),name));
        if(relative(candidate)&&r.source.files.some(f=>f.path===candidate))bindings[name]=candidate;
      }
      maps.push({artifact:doc.file,text,artifactSha256:doc.sha256,mapSha256:mf.sha256,sources:bindings});
    }catch{diagnostics.push('MAP_UNSUPPORTED_OR_INVALID:'+doc.file);}
  }
  const vite=r.packages.find(p=>p.name==='vite');
  const manifestFile=r.outputs.find(f=>f.path==='.vite/manifest.json');
  const context=inspectBuildContext({source,compiled,compiler:{name:vite?'vite':'unsupported',version:vite?.version,evidence:`local run ${r.runId}; not attestation`},maps,manifest:manifestFile?bytes(path.join(root,'outputs'),manifestFile.path).toString('utf8'):undefined,observation});
  return {runId:r.runId,receiptSha256:expectedReceiptSha256,buildRunIntegrity:'verified-against-external-anchor' as const,source,compiled,context,diagnostics,
    runBoundPositionalLinks:context.links.map(l=>({...l,runId:r.runId,buildMembership:'same-recorded-run' as const})),behavioralEquivalence:'not-proven' as const};
}
