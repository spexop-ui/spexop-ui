// Trusted local acceptance harness. The worker is deliberately a TEST DOUBLE.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {createState,prepare,allowRetry,persist,statusView} from '../../tools/companion/dist/core.js';
import {coordinate,snapshot} from '../../tools/companion/dist/coordinate.js';
import {panel} from '../../tools/companion/dist/panel.js';import {notConfiguredWorker} from '../../tools/companion/dist/provider.js';
const [rootArg,outArg,depsArg]=process.argv.slice(2);if(!rootArg||!outArg||!depsArg)throw Error('Usage: run.mjs <prepared Fieldwork copy> <new output directory> <reviewed fixture node_modules>');
const projectRoot=fs.realpathSync(rootArg),out=path.resolve(outArg),deps=fs.realpathSync(depsArg);fs.mkdirSync(out,{mode:0o700});
function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'?[]:e.isDirectory()?list(path.join(dir,e.name)):[path.relative(projectRoot,path.join(dir,e.name))]);}
const files=list(projectRoot).sort(),initial=snapshot(projectRoot,files),app=initial.contents['src/App.tsx'].toString('utf8');
const state=createState({schemaVersion:'r1.1',taskId:'SPX-OSS-005-T1',milestoneId:'M5-R1',projectRoot,baseRevision:initial.revision,allowedFiles:['src/App.tsx'],sourceHashes:{'src/App.tsx':initial.hashes['src/App.tsx']},instruction:'Workspace name must reject fewer than two non-space characters; preserve valid save, email, select, navigation and theme.',criteria:['scope','quality','browser'],maxAttempts:2,timeoutMs:60000,maxOutputBytes:65536});
const stateFile=path.join(out,'state.json'),save=s=>persist(stateFile,s);prepare(state);save(state);
const statusServer=panel(stateFile,5211);await new Promise(resolve=>statusServer.once('listening',resolve));
const apiState=createState(state.contract);await coordinate({state:apiState,worker:notConfiguredWorker(),files,candidateParent:out,save:()=>{},verify:async()=>{throw Error('No API configured');}});persist(path.join(out,'api-not-configured.json'),apiState);
let attempt=0;const worker={kind:'test-double',capability:{status:'READY',provider:'local-fixture-only',model:'NO_LLM_EXECUTION',accessVerified:true,costApproved:true,observedAt:new Date().toISOString()},execute:async input=>{
 attempt++;fs.writeFileSync(path.join(out,`feedback-${attempt}.json`),JSON.stringify(input.feedback,null,2));
 if(attempt===1)return{externalRunId:'simulation-scope-negative',changes:[{path:'src/not-allowed.ts',content:'scope-negative fixture'}]};
 const before='defaultValue={profile.workspace}',after=before+'\n                  onInput={(event) => event.currentTarget.setCustomValidity(event.currentTarget.value.trim().length < 2 ? "Enter at least two non-space characters." : "")}';
 if(!app.includes(before))throw Error('Fixture no longer matches reviewed baseline');return{externalRunId:'simulation-valid-output',changes:[{path:'src/App.tsx',content:app.replace(before,after)}]};
}};
async function verify(c){
 fs.symlinkSync(deps,path.join(c.directory,'node_modules'),'dir');const log=[];for(const [name,script,args]of [['typecheck','typescript/bin/tsc',['--noEmit']],['lint',null,[]],['build','vite/bin/vite.js',['build']]]){
  let result;if(name==='lint'){const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');result=spawnSync(process.execPath,[path.join(repo,'node_modules/eslint/bin/eslint.js'),path.join(c.directory,'src/App.tsx'),'--no-ignore','--max-warnings','0','--config',path.join(repo,'eslint.config.js')],{cwd:c.directory,encoding:'utf8',timeout:60000});}
  else result=spawnSync(process.execPath,[path.join(deps,script),...args],{cwd:c.directory,encoding:'utf8',timeout:60000,env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',HOME:out,TMPDIR:out,LANG:'C',CI:'1'}});
  log.push({name,exitCode:result.status,error:!!result.error,stdout:result.stdout,stderr:result.stderr});
 }
 fs.writeFileSync(path.join(out,'quality.json'),JSON.stringify({revision:c.revision,checks:log},null,2));
 const {spawn}=await import('node:child_process');const server=spawn(process.execPath,[path.join(deps,'vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5212','--strictPort'],{cwd:c.directory,stdio:'ignore',env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',HOME:out,TMPDIR:out,LANG:'C'}});
 fs.writeFileSync(path.join(out,'candidate.json'),JSON.stringify({...c,route:'http://127.0.0.1:5212/#settings',executionKind:'test-double',apiIntegration:'NOT_CONFIGURED'},null,2));
 console.log('BROWSER_PENDING '+c.revision);const until=Date.now()+600000;let browser=null;
 while(Date.now()<until){const file=path.join(out,'browser.json');if(fs.existsSync(file)){browser=JSON.parse(fs.readFileSync(file,'utf8'));break;}await new Promise(resolve=>setTimeout(resolve,250));}
 server.kill();
 const unchanged=snapshot(projectRoot,files).revision===initial.revision;
 return [{criterion:'scope',result:unchanged?'PASS':'FAIL',reason:'Worker returned only allowed App.tsx; original source inventory unchanged'},
 {criterion:'quality',result:log.every(r=>r.exitCode===0&&!r.error)?'PASS':'FAIL',reason:'Independent typecheck/lint/build exit statuses; see quality.json'},
 {criterion:'browser',result:browser?.revision===c.revision?browser.result:'UNKNOWN',reason:browser?.reason??'No current-revision browser evidence'}].map(x=>({...x,revision:c.revision,artifact:path.join(out,x.criterion==='browser'?'browser.json':'quality.json'),actor:'independent'}));
}
const options={state,worker,files,candidateParent:out,save,verify};const first=await coordinate(options);if(first.state.phase!=='FAILED')throw Error('Expected isolated scope failure');
fs.writeFileSync(path.join(out,'scope-negative.json'),JSON.stringify(statusView(state),null,2));allowRetry(state);save(state);const result=await coordinate(options);
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({state:statusView(state),api:statusView(apiState),initialRevision:initial.revision,sourceUnchanged:snapshot(projectRoot,files).revision===initial.revision,candidates:result.candidates},null,2));
console.log('DONE '+state.phase+'; panel http://127.0.0.1:5211/');
