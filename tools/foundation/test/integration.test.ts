import {describe,it,expect,afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reviewFoundation,formatIntegrationReview} from '../integration/index.js';
import {runIntegrationCLI} from '../integration/cli.js';
import {renderCanonicalCSS} from '../css-export/index.js';
const roots:string[]=[];
function project(css:string){const root=fs.mkdtempSync(path.join(os.tmpdir(),'spx-integration-'));roots.push(root);fs.writeFileSync(path.join(root,'tokens.css'),css);return root;}
function run(args:string[]){let out='',err='';const code=runIntegrationCLI(args,{out:s=>out+=s,err:s=>err+=s});return {code,out,err};}
afterEach(()=>{for(const p of roots.splice(0))fs.rmSync(p,{recursive:true,force:true});});
describe('bounded integration review',()=>{
 it('retains exact source details/exclusions and never reports app safety',()=>{
  const root=project(':root{--brand:#abc;--link:var(--brand);--font:Inter;--derived:calc(2px * 2)}');const {review,plan}=reviewFoundation({projectRoot:root});
  expect(review.status).toBe('partial');expect(review.applicationSafety).toBe('not-evaluated');expect(review.exportable.length).toBe(2);expect(review.excluded.length).toBe(2);
  expect(review.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({name:'--link',disposition:'exported'})]));
  expect(review.excluded.every(e=>e.provenance.line>0&&e.reasons.length>0)).toBe(true);
  expect(formatIntegrationReview(review)).toContain('Keep ALL original stylesheets');
  expect(()=>renderCanonicalCSS(plan)).toThrow();expect(renderCanonicalCSS(plan,{allowPartial:true}).declarations).toBe(2);
  expect(fs.readdirSync(root)).toEqual(['tokens.css']);
 });
 it('does not treat ready as app acceptance and stays deterministic',()=>{const root=project(':root{--a:1rem} .dark{--a:2rem}');const a=reviewFoundation({projectRoot:root}),b=reviewFoundation({projectRoot:root});expect(a).toEqual(b);expect(a.review.status).toBe('ready');expect(a.review.risks.join(' ')).toContain('no universally safe import order');expect(renderCanonicalCSS(a.plan).sha256).toBe(renderCanonicalCSS(b.plan).sha256);});
 it('reports complete blocked source errors rather than only zero counts',()=>{const r=reviewFoundation({projectRoot:project(':root{--a:var(--missing)}')});expect(r.review.status).toBe('blocked');expect(r.review.discovered.diagnostics.some(d=>d.code==='REFERENCE_MISSING')).toBe(true);expect(run([project(''), '--preview','--allow-partial']).code).toBe(2);});
 it('bounds default presentation but preserves all detailed entries',()=>{const root=project(':root{'+Array.from({length:200},(_,i)=>`--x${i}:${i}px;`).join('')+'}');const {review}=reviewFoundation({projectRoot:root});expect(review.exportable).toHaveLength(200);expect(formatIntegrationReview(review).split('\n').length).toBeLessThan(45);});
 it('keeps all references and excluded dependencies',()=>{const {review}=reviewFoundation({projectRoot:project(':root{--a:var(--missing);--b:var(--a);--ok:1px}')});expect(review.dependencies).toHaveLength(2);expect(review.dependencies.every(d=>d.disposition==='excluded')).toBe(true);});
});
describe('focused review command',()=>{
 it('defaults to read only and requires explicit partial write',()=>{const root=project(':root{--a:1px;--font:Inter}');expect(run([root]).code).toBe(0);expect(run([root,'--write','generated']).code).toBe(2);expect(fs.existsSync(path.join(root,'generated'))).toBe(false);expect(run([root,'--preview','--allow-partial']).out).toContain('--a: 1px');expect(fs.readdirSync(root)).toEqual(['tokens.css']);});
 it('writes only new outputs and refuses reuse without changing source',()=>{const css=':root{--a:1px;--font:Inter}',root=project(css);expect(run([root,'--css','tokens.css','--write','generated','--allow-partial']).code).toBe(0);expect(run([root,'--css','tokens.css','--write','generated','--allow-partial']).code).toBe(1);expect(fs.readFileSync(path.join(root,'tokens.css'),'utf8')).toBe(css);expect(fs.readdirSync(path.join(root,'generated'))).toEqual(['plan.json','tokens.css']);});
 it.each([['--css'],['--write'],['--json','--preview'],['--allow-partial','--allow-partial'],['--unknown'],['--write','../escape'],['--write','/tmp/escape']].map(args=>({args})))('refuses bad arguments $args',({args})=>{expect(run([project(':root{--a:1px}'),...args]).code).toBe(1);});
 it('emits parseable full JSON and preserves explicit source scope',()=>{const root=project(':root{--a:1px}');fs.writeFileSync(path.join(root,'other.css'),':root{--a:2px}');const r=run([root,'--css','tokens.css','--json']);expect(r.code).toBe(0);const parsed=JSON.parse(r.out);expect(parsed.review.discovered.declarations).toBe(1);expect(parsed.review.applicationSafety).toBe('not-evaluated');});
 it('does not opt in to Tailwind transformations implicitly',()=>{const root=project('@theme{--spacing:4px}');expect(run([root]).code).toBe(2);expect(run([root,'--theme-literals']).code).toBe(0);expect(run([root,'--theme-literals']).out).toContain('unlayered');});
});
