import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postcss from 'postcss';
import {afterEach, expect, it} from 'vitest';
import {captureDesignFoundation} from '../capture/index.js';
import {planCanonicalCSS, renderCanonicalCSS} from '../css-export/index.js';
import type {CSSStructureNode} from '../capture/css-context.js';
import {captureCSSContexts} from '../capture/css-context.js';

const roots:string[]=[];
function project(files:Record<string,string>){const root=fs.mkdtempSync(path.join(os.tmpdir(),'spx-native-independent-'));roots.push(root);for(const [name,css] of Object.entries(files))fs.writeFileSync(path.join(root,name),css);return root;}
function capture(css:string){return captureDesignFoundation({projectRoot:project({'source.css':css}),cssContext:true});}
const native={preserveNativeContext:true} as const;
function refuses(model:ReturnType<typeof capture>){expect(()=>renderCanonicalCSS(planCanonicalCSS(model,native),{allowPartial:true})).toThrow();}
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});

it('independent native: raw channel type remains unknown and model does not acquire resolved evidence',()=>{
 const m=capture('@layer base{:root{--channel:0 72.2% 50.6%;--alias:var(--channel)}}');const before=JSON.stringify(m),p=planCanonicalCSS(m,native);
 expect(p.status).toBe('ready');expect(p.entries[0].type.status).not.toBe('known');expect(p.nativeContext?.resolution).toBe('preserved-not-evaluated');
 expect(renderCanonicalCSS(p).css).toContain('--channel: 0 72.2% 50.6%');expect(JSON.stringify(m)).toBe(before);
});

it('independent native: preserves order-only, ordinary-only, anonymous and nested layer introductions',()=>{
 const m=capture('@layer z,a;@layer z{body{color:red}}@layer a{@layer inner{:root{--x:1px}}}@layer{:root{--y:2px}}');const css=renderCanonicalCSS(planCanonicalCSS(m,native)).css;
 const seen:string[]=[];postcss.parse(css).walkAtRules(r=>{seen.push(`${r.name}:${r.params}`);});expect(seen).toEqual(['layer:z,a','layer:z','layer:a','layer:inner','layer:']);expect(css).not.toContain('color:red');
});

it('independent native: unknown multi-file order blocks; explicit exact order is labeled caller asserted',()=>{
 const root=project({'a.css':'@layer a{:root{--x:1px}}','b.css':'@layer b{:root{--x:2px}}'}),m=captureDesignFoundation({projectRoot:root,cssContext:true});refuses(m);
 for(const sourceOrder of [['a.css'],['a.css','a.css'],['b.css','unknown.css']])expect(planCanonicalCSS(m,{...native,sourceOrder}).status).toBe('blocked');
 const p=planCanonicalCSS(m,{...native,sourceOrder:['b.css','a.css']});expect(p.nativeContext?.orderEvidence).toBe('caller-asserted-order');const css=renderCanonicalCSS(p).css;expect(css.indexOf('@layer b')).toBeLessThan(css.indexOf('@layer a'));
});

it.each(['@import "x.css";','@theme{--compiler:red}','@tailwind base;','@media print{@layer x{}}'])('independent native: context blocker remains global with partial consent: %s',prefix=>{refuses(capture(prefix+':root{--keep:1px}'));});

it.each([String.raw`:root{--\62 rand:red;--keep:1px}`,String.raw`@property --\62 rand{syntax:"<color>";inherits:false;initial-value:red}:root{--keep:1px}`])('independent native: escaped identity cannot bypass global refusal: %s',css=>{refuses(capture(css));});

it('independent native: excluded override closes layered family and transitive aliases',()=>{
 const m=capture('@layer base{:root{--x:1px;--a:var(--x);--b:var(--a);--keep:2px}}@media print{:root{--x:3px}}'),p=planCanonicalCSS(m,native);
 expect(p.status).toBe('partial');expect(p.entries.filter(e=>e.output).map(e=>e.name)).toEqual(['--keep']);expect(()=>renderCanonicalCSS(p)).toThrow();expect(renderCanonicalCSS(p,{allowPartial:true}).declarations).toBe(1);
});

it.each(['var(--missing)','var(--x, red)','calc(1px + 2px)','url(../font.woff2)','inherit'])('independent native: unsupported raw values stay excluded: %s',value=>{
 const p=planCanonicalCSS(capture(`:root{--x:${value};--keep:1px}`),native);expect(p.entries.find(e=>e.name==='--x')?.status).toBe('unsupported');expect(p.coverage.eligible).toBe(1);
});

it('independent native: cycle is not converted to resolved evidence',()=>{const p=planCanonicalCSS(capture(':root{--a:var(--b);--b:var(--a);--keep:1px}'),native);expect(p.entries.filter(e=>e.output).map(e=>e.name)).toEqual(['--keep']);});

it.each(['VAR(--missing)',String.raw`v\61 r(--missing)`,String.raw`u\72 l(../image.png)`])('independent native: function spelling cannot evade reference/resource exclusions: %s',value=>{
 const p=planCanonicalCSS(capture(`:root{--x:${value};--keep:1px}`),native);expect(p.entries.find(e=>e.name==='--x')?.status).toBe('unsupported');expect(p.coverage.eligible).toBe(1);
});

it.each(['layer-name','rule-order','layer-order','unknown-slot','injected-layer-rule'])('independent native: forged source structural evidence refuses output: %s',change=>{
 const m=capture('@layer a,b;@layer a{:root{--x:1px;--y:2px}}');const nodes=m.cssDocuments![0].nodes;
 const layer=nodes.find((n):n is Extract<CSSStructureNode,{kind:'layer'}>=>n.kind==='layer')!;
 const rule=layer.children[0] as Extract<CSSStructureNode,{kind:'rule'}>;
 if(change==='layer-name')layer.name='b';
 if(change==='rule-order')rule.tokenIds.reverse();
 if(change==='layer-order')(nodes[0] as Extract<CSSStructureNode,{kind:'layer-order'}>).names='b,a';
 if(change==='unknown-slot')rule.tokenIds.push('fabricated:token');
 if(change==='injected-layer-rule')layer.name='a {} @media print';
 refuses(m);
});

it('independent native: capture source and preview remain byte identical',()=>{
 const root=project({'source.css':'@layer base{:root{--channel:0 72.2% 50.6%}}'}),before=fs.readFileSync(path.join(root,'source.css'));const m=captureDesignFoundation({projectRoot:root,cssContext:true});renderCanonicalCSS(planCanonicalCSS(m,native));expect(fs.readdirSync(root)).toEqual(['source.css']);expect(fs.readFileSync(path.join(root,'source.css'))).toEqual(before);
});

it('independent native: UTF-8 BOM does not shift declaration evidence',()=>{
 const m=capture('\uFEFF@layer base{:root{--x:1px}}');expect(planCanonicalCSS(m,native).status).toBe('ready');
});

it('independent native: source snapshot detects a removed override even when slots are rebuilt',()=>{
 const m=capture(':root{--x:1px;--keep:2px}.brand{--x:3px}');const omitted=m.tokens.find(t=>t.value.raw==='3px')!;
 m.tokens=m.tokens.filter(t=>t.id!==omitted.id);m.resolutions=[];
 m.cssDocuments=captureCSSContexts(m.cssDocuments!.map(d=>({file:d.file,css:d.sourceText})),m.tokens);
 refuses(m);
});

it.each(['@PROPERTY --x{syntax:"<length>";inherits:false;initial-value:0px}:root{--x:1px}',String.raw`:root{--x:1px;\2d \2d x:3px}`])('independent native: removed diagnostics cannot erase source guards: %s',css=>{
 const m=capture(css);m.diagnostics=[];refuses(m);
});
