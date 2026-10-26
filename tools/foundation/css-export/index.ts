import { nativeCSSPlan } from './native.js';
import type { CSSDocumentContext } from '../capture/css-context.js';
import postcss from 'postcss';
import { createHash } from 'node:crypto';
import { assertModel, type CanonicalDesignModel, type CanonicalToken, type Context } from '../capture/model.js';
import { modelFromCSS } from '../capture/css-adapter.js';
import { parseCSSSources } from '../parse-css.js';
import { buildTokenGraph } from '../graph.js';
import type { FoundValue } from '../source-types.js';
export { writeCanonicalCSS } from './write.js';
export interface CSSPlanOptions {
  preserveNativeContext?: boolean;
  sourceOrder?: readonly string[];
  /** Explicit opt-in: materialize literal @theme variables in :root, :host.
   * Does NOT reproduce utilities, Tailwind pruning or @theme inline alias semantics. */
  themeLiterals?: 'materialize';
}
export interface CSSPlanEntry {
  tokenId: string;
  identity: CanonicalToken['identity'];
  type: CanonicalToken['type'];
  name: string;
  value: string;
  context: Context;
  provenance: CanonicalToken['provenance'];
  references: CanonicalToken['references'];
  status: 'exact-preservation' | 'safe-transformation' | 'unsupported';
  reasons: string[];
  output?: { selector: string; layer?: never };
}
export interface CSSExportPlan {
  schemaVersion: '0.1';
  nativeContext?: {css:string;sourceOrder:readonly string[];orderEvidence:string;documents:CSSDocumentContext[];resolution:'preserved-not-evaluated'};
  namespace: string;
  status: 'ready' | 'partial' | 'blocked';
  entries: CSSPlanEntry[];
  rules: Array<{ selector: string; layer?: never; declarations: Array<{ tokenId: string; name: string; value: string }> }>;
  blockers: Array<{ code: string; message: string }>;
  coverage: { captured: number; eligible: number; excluded: number; aliases: number; exact: number; transformed: number; semanticMappings: 0 };
  limits: string[];
}
const authentic = new WeakSet<object>();
const namePattern = /^--[A-Za-z_][A-Za-z0-9_-]*$/;
const dark = /^(?:\.dark|html\.dark|:root\.dark|\[data-theme=["']dark["']\]|html\[data-theme=["']dark["']\]|:root\[data-theme=["']dark["']\])$/;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { for (const x of Object.values(v)) freeze(x); Object.freeze(v); }
  return v;
}
function declarationMatches(t: CanonicalToken): boolean {
  // Reparse the exact source slice and value separately. No raw text is allowed to inject rules.
  try {
    for (const text of [t.provenance.rawDeclaration, `${t.identity.sourceName}: ${t.value.raw};`]) {
      const ast = postcss.parse(`:root {${text}}`, { map: false }), rule = ast.nodes[0];
      if (ast.nodes.length !== 1 || rule.type !== 'rule' || rule.nodes.length !== 1) return false;
      const d = rule.nodes[0];
      if (d.type !== 'decl' || d.prop !== t.identity.sourceName || d.value !== t.value.raw || !!d.important !== t.provenance.important) return false;
    }
    return true;
  } catch { return false; }
}
/** Read-only, no Theme roles or generators. Retains every excluded record in the plan. */
export function planCanonicalCSS(model: CanonicalDesignModel, options: CSSPlanOptions = {}): CSSExportPlan {
  assertModel(model);
  if (Object.keys(options).some(k => !['themeLiterals','preserveNativeContext','sourceOrder'].includes(k)) || (options.preserveNativeContext!==undefined&&typeof options.preserveNativeContext!=='boolean') || (options.sourceOrder!==undefined&&(!Array.isArray(options.sourceOrder)||options.sourceOrder.some(s=>typeof s!=='string')||!options.preserveNativeContext)) || (options.preserveNativeContext&&options.themeLiterals!==undefined) || (options.themeLiterals !== undefined && options.themeLiterals !== 'materialize')) throw new TypeError('Invalid CSS plan options');
  if(options.preserveNativeContext){const plan=nativeCSSPlan(model,options);authentic.add(plan);return freeze(plan);}
  const contexts = new Map(model.contexts.map(c => [c.id, c]));
  // Recheck the supplied graph against lexical references and contexts; missing/forged scope records cannot certify export.
  const found: FoundValue[] = model.tokens.map(t => {
    const c = contexts.get(t.contextId)!.source;
    return {id:t.id,variable:t.identity.sourceName,value:t.value.kind==='literal'?'0':t.value.raw,
      selector:c.kind==='css'?c.selector:'',mode:c.kind==='css'&&dark.test(c.selector.trim())?'dark':'light',
      origin:c.kind==='css'?c.origin:'css',supported:c.kind==='css'&&c.supported,ancestors:c.kind==='css'?c.ancestors:[],source:t.provenance};
  });
  const expected = buildTokenGraph(found).resolutions;
  const signature = (r:{evaluationScope:string;status:string;targetIds:string[];canonicalId?:string}) => JSON.stringify([r.evaluationScope,r.status,[...r.targetIds].sort(),r.canonicalId??null]);
  const entries = model.tokens.map<CSSPlanEntry>(t => {
    const context = contexts.get(t.contextId)!;
    const e: CSSPlanEntry = { tokenId: t.id, identity: structuredClone(t.identity), type: structuredClone(t.type), name: t.identity.sourceName, value: t.value.raw,
      context: structuredClone(context), provenance: structuredClone(t.provenance), references: structuredClone(t.references), status: 'unsupported', reasons: [] };
    const reject = (why: string) => { e.reasons.push(why); return e; };
    if (!namePattern.test(e.name)) return reject('CSS_NAME: only unescaped ASCII custom-property identifiers are supported; no renaming.');
    if (!t.provenance.file || !Number.isInteger(t.provenance.line) || t.provenance.line < 1 || !Number.isInteger(t.provenance.column) || t.provenance.column < 1 || !/^[a-f0-9]{64}$/.test(t.provenance.fileSha256) || !declarationMatches(t)) return reject('PROVENANCE: missing location/hash or declaration/value disagreement.');
    if (context.source.kind !== 'css' || !context.source.supported || context.source.ancestors.length || t.provenance.important) return reject('CONTEXT: unsupported selector/layer/registration/priority or expression; no cascade approximation.');
    const selector = context.source.selector.trim();
    const theme = context.source.origin === 'tailwind-theme';
    if (theme) {
      if (!options.themeLiterals || !/^@theme(?:\s+static)?$/.test(selector) || t.value.kind !== 'literal') return reject('THEME: only explicitly opted-in literal materialization; aliases/inline use-site semantics require a Tailwind exporter.');
      e.output = { selector: ':root, :host' };
    } else if (selector === ':root' || dark.test(selector)) e.output = { selector };
    else return reject('SELECTOR: outside root/documented dark subset.');
    if (t.value.kind === 'literal') {
      const checked = modelFromCSS(parseCSSSources([{file:'check.css',css:`:root { ${e.name}: ${e.value}; }`}]), 'check').tokens[0];
      if (checked?.value.kind !== 'literal' || t.type.status !== 'known' || checked.type.status !== 'known' || checked.type.type !== t.type.type || JSON.stringify(checked.value.literal) !== JSON.stringify(t.value.literal) || t.references.length) return reject('VALUE: raw literal/type/reference evidence disagrees or is not a supported literal.');
    } else if (t.value.kind === 'alias') {
      const match = /^var\(\s*(--[A-Za-z_][A-Za-z0-9_-]*)\s*\)$/.exec(e.value);
      if (!match || t.references.length !== 1 || t.references[0].name !== match[1] || t.references[0].syntax !== 'css-var' || t.references[0].fallback !== undefined || t.references[0].raw !== e.value || JSON.stringify(t.value.reference) !== JSON.stringify(t.references[0])) return reject('ALIAS: unsupported or inconsistent reference syntax.');
    } else return reject('VALUE: unparsed/unknown, CSS-wide, fallback or derived expression cannot be emitted by this slice.');
    const resolutions = model.resolutions.filter(r => r.tokenId === t.id);
    const expectedSignatures = expected.filter(r=>r.nodeId===t.id).map(r=>signature({evaluationScope:r.mode,status:r.status,targetIds:r.targetIds,canonicalId:r.canonicalSourceId})).sort();
    if (JSON.stringify(expectedSignatures)!==JSON.stringify(resolutions.map(signature).sort())) return reject('GRAPH_EVIDENCE: missing or inconsistent scope/target resolution records.');
    if (!resolutions.length || resolutions.some(r => r.status !== 'resolved')) return reject('RESOLUTION: missing/cycle/ambiguous/unsupported evaluation; no claimed cascade winner.');
    if (t.value.kind === 'alias' && resolutions.some(r => r.targetIds.length !== 1 || model.tokens.find(x => x.id === r.targetIds[0])?.identity.sourceName !== t.references[0].name)) return reject('REFERENCE: graph target does not match lexical alias.');
    e.status = theme ? 'safe-transformation' : 'exact-preservation';
    return e;
  });
  const exclude = (e: CSSPlanEntry, why: string) => { e.status = 'unsupported'; e.output = undefined; if (!e.reasons.includes(why)) e.reasons.push(why); };
  const names = new Map<string, CSSPlanEntry[]>();
  for (const e of entries) names.set(e.name, [...(names.get(e.name) ?? []), e]);
  for (const group of names.values()) {
    const keys = group.map(e => JSON.stringify([e.context.source, e.provenance.file]));
    // A repeated selector name or cross-file family needs import/cascade order not in the contract.
    const selectors = group.map(e => e.context.source.kind === 'css' ? e.context.source.selector.trim() : '');
    if (new Set(group.map(e => e.provenance.file)).size > 1 || new Set(selectors).size !== group.length || new Set(keys).size !== keys.length || (group.length > 1 && group.some(e => e.status==='safe-transformation')))
      for (const e of group) exclude(e, 'COLLISION: duplicate name/scope, cross-file order or transformed namespace overlap is unproven; no implicit renaming.');
  }
  // Fixed-point dependency AND override closure: dropping an override or target must not change a surviving family.
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of entries.filter(x => x.status !== 'unsupported')) {
      const family = names.get(e.name)!;
      const badFamily = family.some(x => x.status === 'unsupported');
      const badRef = e.references.some(r => !names.has(r.name) || names.get(r.name)!.some(x => x.status === 'unsupported' || x.status==='safe-transformation'));
      if (badFamily || badRef) { exclude(e, badFamily ? 'OVERRIDE_CLOSURE: excluded declaration of the same name may change behavior.' : 'DEPENDENCY_CLOSURE: missing/excluded/transformed dependency prevents equivalent alias export.'); changed = true; }
    }
  }
  for (const e of entries) if (e.status === 'unsupported') e.output = undefined;
  const included = entries.filter(e => e.output).sort((a,b) => a.provenance.file < b.provenance.file ? -1 : a.provenance.file > b.provenance.file ? 1 : a.provenance.line - b.provenance.line || a.provenance.column - b.provenance.column);
  // Preserve declaration ordering; no selector regrouping across intervening rules.
  const rules: CSSExportPlan['rules'] = included.map(e => ({...e.output!,declarations:[{tokenId:e.tokenId,name:e.name,value:e.value}]}));
  const blockers = model.diagnostics.filter(d => ['CSS_IDENTITY_UNSUPPORTED','CSS_PARSE','ROOT_INVALID','INPUT_OUTSIDE_SCOPE','ENUMERATION_FAILED','SCOPE_LIMIT','SOURCE_REFUSED','NO_TOKENS'].includes(d.code)).map(d => ({code:d.code,message:d.message}));
  // CSS escapes can denote the same identifier as a supported ASCII spelling.
  // Without decoding/proving identity we cannot certify family closure, even for partial output.
  if (entries.some(e => e.name.includes('\\'))) blockers.push({code:'ESCAPED_IDENTITY',message:'Escaped custom-property names may overlap included families; export is blocked until identity can be proved.'});
  const excluded = entries.length - included.length;
  const plan: CSSExportPlan = {schemaVersion:'0.1', namespace:model.namespace, status:blockers.length || !included.length ? 'blocked' : excluded ? 'partial' : 'ready', entries, rules, blockers,
    coverage:{captured:entries.length,eligible:included.length,excluded,aliases:included.filter(e=>e.references.length).length,exact:included.filter(e=>e.status==='exact-preservation').length,transformed:included.filter(e=>e.status==='safe-transformation').length,semanticMappings:0},
    limits:[...model.limits, 'Lossless means included declaration names, raw values, alias relationships and supported selector contexts; not byte-identical stylesheet or whole-application cascade equivalence.',
      'Unsupported records stay in this plan. Partial output requires explicit allowPartial; never replace the entire source stylesheet with a partial artifact.',
      'Only custom properties are exported. Imports, ordinary rules, registrations, keyframes and utility generation are not reproduced. External styles and DOM placement require integration review.',
      'Top-level @theme / @theme static literal materialization is opt-in unlayered :root, :host variables, matching top-level Tailwind declaration placement. @theme inline, pruning and utilities are not reproduced; this does not claim complete Tailwind equivalence.',
      'Namespaces are provenance identities, not CSS prefixes. Cross-namespace or colliding names are not silently renamed.']};
  authentic.add(plan);
  return freeze(plan);
}
/** Pure preview serialization. Partial output is explicit and labeled, never reported complete. */
export function renderCanonicalCSS(plan: CSSExportPlan, options: {allowPartial?: boolean} = {}) {
  if (!authentic.has(plan) || Object.keys(options).some(k=>k!=='allowPartial') || (options.allowPartial !== undefined && typeof options.allowPartial !== 'boolean')) throw new TypeError('Use an unmodified planCanonicalCSS result and valid render options');
  if (plan.status === 'blocked' || (plan.status === 'partial' && !options.allowPartial)) throw new Error('CSS export blocked; inspect exclusions or explicitly accept partial output.');
  const css = '/* Spexop canonical CSS: '+plan.status+'; see export plan for scope and exclusions. */\n' + (plan.nativeContext ? plan.nativeContext.css : plan.rules.map(r => {
    const body = `${r.selector} {\n${r.declarations.map(d=>`  ${d.name}: ${d.value};`).join('\n')}\n}`;
    return body;
  }).join('\n'))+'\n';
  const parsed = postcss.parse(css, { map: false }), decls: Array<{name:string;value:string}> = [];
  parsed.walkDecls(d=>{decls.push({name:d.prop,value:d.value});});
  if (JSON.stringify(decls) !== JSON.stringify(plan.rules.flatMap(r=>r.declarations.map(d=>({name:d.name,value:d.value}))))) throw new Error('CSS serialization round-trip failed');
  return {status:plan.status,css,sha256:hash(css),declarations:decls.length,excluded:plan.coverage.excluded};
}
