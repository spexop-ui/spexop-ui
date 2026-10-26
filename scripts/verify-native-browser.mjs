import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
import {captureDesignFoundation} from '../tools/foundation/dist/capture/index.js';
import {planCanonicalCSS,renderCanonicalCSS} from '../tools/foundation/dist/css-export/index.js';

// Generic disposable browser proof. No application-specific source adapter or source writes.
const out=path.resolve(process.argv[2]??'../outputs/oss-005j/browser-fixture');
fs.mkdirSync(out,{recursive:true});
const sourceDir=path.join(out,'sources');fs.mkdirSync(sourceDir,{recursive:true});
const sourceOrder=['first.css','second.css'];
const sources=[`:root { --tone: rgb(0 128 0); }
@layer reset, base;
@layer reset { #probe { box-sizing: border-box; } }
@layer base {
 :root { --tone: rgb(255 0 0); --channel: 0 72.2% 50.6%; }
 .dark { --channel: 210 90% 60%; }
}
@layer shell { @layer inner { :root { --nested: 13px; } } }
@layer { :root { --anon: 17px; } #probe { border-top-style: solid; } }
@layer shared { :root { --order: 3px; } }
#probe { color:hsl(var(--channel)); background-color:var(--tone); border-top-width:var(--order); margin-left:var(--nested); padding-top:var(--anon); font:16px Arial; width:200px; height:100px; }
`, `@layer shared { :root { --order: 7px; } }
`];
sourceOrder.forEach((name,i)=>fs.writeFileSync(path.join(sourceDir,name),sources[i]));
const sha=text=>createHash('sha256').update(text).digest('hex');
const before=sources.map(sha);
const model=captureDesignFoundation({projectRoot:sourceDir,cssFiles:sourceOrder,cssContext:true});
const plan=planCanonicalCSS(model,{preserveNativeContext:true,sourceOrder});
const rendered=renderCanonicalCSS(plan,{allowPartial:true});
fs.writeFileSync(path.join(out,'canonical.css'),rendered.css);
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2));

// Independently project original AST to precisely the emitted declaration and layer topology.
const eligible=new Set(plan.entries.filter(e=>e.output).map(e=>e.tokenId));
const byLocation=new Map(model.tokens.map(t=>[`${t.provenance.file}:${t.provenance.line}:${t.provenance.column}`,t]));
function originalProjection(parent,file){const result=[];for(const n of parent.nodes??[]){
 if(n.type==='atrule'&&n.name.toLowerCase()==='layer')result.push(n.nodes?['layer',n.params.trim(),originalProjection(n,file)]:['order',n.params.trim()]);
 else if(n.type==='rule'){const ds=(n.nodes??[]).filter(d=>d.type==='decl'&&eligible.has(byLocation.get(`${file}:${d.source.start.line}:${d.source.start.column}`)?.id)).map(d=>[d.prop,d.value]);if(ds.length)result.push(['rule',n.selector,ds]);}
}return result;}
function emittedProjection(parent){const result=[];for(const n of parent.nodes??[]){if(n.type==='comment')continue;if(n.type==='atrule'&&n.name.toLowerCase()==='layer')result.push(n.nodes?['layer',n.params.trim(),emittedProjection(n)]:['order',n.params.trim()]);else if(n.type==='rule')result.push(['rule',n.selector,(n.nodes??[]).filter(d=>d.type==='decl').map(d=>[d.prop,d.value])]);else throw Error('Unexpected output structure');}return result;}
const expected=sources.flatMap((css,i)=>originalProjection(postcss.parse(css),sourceOrder[i]));
const actual=emittedProjection(postcss.parse(rendered.css));
if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Independent AST/context projection mismatch');
const generated=[];postcss.parse(rendered.css).walkDecls(d=>generated.push(d.clone()));
let generatedIndex=0;
const canonical=sources.map((css,i)=>{const ast=postcss.parse(css);ast.walkDecls(d=>{if(eligible.has(byLocation.get(`${sourceOrder[i]}:${d.source.start.line}:${d.source.start.column}`)?.id))d.replaceWith(generated[generatedIndex++].clone());});return ast.toString();});
if(generatedIndex!==generated.length)throw Error('Incomplete generated substitution');
const flatten=css=>{const ast=postcss.parse(css);const layers=[];ast.walkAtRules(r=>{if(r.name.toLowerCase()==='layer')layers.push(r);});for(const r of layers.reverse()){if(r.nodes)r.replaceWith(...r.nodes);else r.remove();}return ast.toString();};
const variants={source:sources,canonical,flattened:canonical.map(flatten),'reversed-order':[...canonical].reverse()};
const manifest={sourceOrder,sourceOrderEvidence:plan.nativeContext.orderEvidence,sourceHashes:before,canonicalHash:rendered.sha256,captured:model.tokens.length,eligible:plan.coverage.eligible,excluded:plan.coverage.excluded,astContextProjection:'PASS',replacement:'generated declaration AST nodes at original slots; original ordinary/excluded nodes and anonymous layer identities retained',fullReplacement:false};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
const html=`<!doctype html><meta charset="utf-8"><title>005J native CSS browser proof</title><style>body{font:15px system-ui;margin:24px}iframe{width:800px;height:600px;border:1px solid #aaa}pre{white-space:pre-wrap}</style><h1>005J native CSS browser proof</h1><p id="status">Running source/output and negative controls...</p><iframe id="fixture" title="Same DOM CSS fixture"></iframe><pre id="report"></pre><script>
const variants=${JSON.stringify(variants).replaceAll('<','\\u003c')};
const fixture=document.querySelector('#fixture');
fixture.srcdoc='<!doctype html><html><head><style id="slot0"></style><style id="slot1"></style></head><body><div id="probe">Native CSS consumer</div></body></html>';
fixture.onload=async()=>{try{const doc=fixture.contentDocument,win=fixture.contentWindow,probe=doc.querySelector('#probe'),slots=[doc.querySelector('#slot0'),doc.querySelector('#slot1')];const props=['color','backgroundColor','borderTopWidth','borderTopStyle','marginLeft','paddingTop','fontSize','fontFamily','width','height'];const results=[];for(const mode of ['light','dark']){doc.documentElement.className=mode==='dark'?'dark':'';for(const [variant,css] of Object.entries(variants)){slots.forEach((s,i)=>s.textContent=css[i]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const style=win.getComputedStyle(probe);results.push({mode,variant,viewport:[win.innerWidth,win.innerHeight],values:Object.fromEntries(props.map(p=>[p,style[p]])),sameDOM:probe===doc.querySelector('#probe'),sameSlots:slots.every((s,i)=>s===doc.querySelector('#slot'+i))});}}
const comparisons=['light','dark'].map(mode=>{const pick=v=>results.find(r=>r.mode===mode&&r.variant===v);const mismatches=v=>props.filter(p=>pick('source').values[p]!==pick(v).values[p]);return {mode,canonicalMismatches:mismatches('canonical'),flattenedMismatches:mismatches('flattened'),reversedMismatches:mismatches('reversed-order')};});const pass=comparisons.every(c=>!c.canonicalMismatches.length&&c.flattenedMismatches.length&&c.reversedMismatches.length)&&results.every(r=>r.sameDOM&&r.sameSlots&&r.viewport[0]===800&&r.viewport[1]===600);const report={pass,browser:navigator.userAgent,time:new Date().toISOString(),results,comparisons};document.querySelector('#status').textContent=pass?'PASS — same-slot equivalence; both negative controls detected':'FAIL — inspect measurements';document.querySelector('#report').textContent=JSON.stringify(report,null,2);await fetch('/results',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report)});}catch(e){document.querySelector('#status').textContent='ERROR '+e.message;}};
</script>`;
fs.writeFileSync(path.join(out,'index.html'),html);
const server=http.createServer((req,res)=>{if(req.method==='GET'&&req.url==='/'){res.setHeader('content-type','text/html');res.end(html);return;}if(req.method==='POST'&&req.url==='/results'){let body='';req.on('data',c=>{body+=c;if(body.length>100000)req.destroy();});req.on('end',()=>{const report=JSON.parse(body);report.sourceHashesAfter=sourceOrder.map(n=>sha(fs.readFileSync(path.join(sourceDir,n),'utf8')));report.sourceUnchanged=JSON.stringify(report.sourceHashesAfter)===JSON.stringify(before);fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(report,null,2));res.end('saved');console.log(JSON.stringify({pass:report.pass,sourceUnchanged:report.sourceUnchanged,comparisons:report.comparisons}));});return;}res.statusCode=404;res.end();});
server.listen(5199,'127.0.0.1',()=>console.log('http://127.0.0.1:5199/'));
