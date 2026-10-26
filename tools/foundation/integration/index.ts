import { captureDesignFoundation, type CaptureOptions, type CaptureResult } from '../capture/index.js';
import { planCanonicalCSS, type CSSPlanOptions, type CSSExportPlan } from '../css-export/index.js';

export interface IntegrationReview {
  schemaVersion: '0.1';
  status: CSSExportPlan['status'];
  applicationSafety: 'not-evaluated';
  discovered: { declarations: number; inspectedFiles: number; sources: CaptureResult['sources']; diagnostics: CaptureResult['diagnostics'] };
  exportable: CSSExportPlan['entries'];
  excluded: CSSExportPlan['entries'];
  exclusionGroups: Array<{ code: string; declarations: number; explanation: string }>;
  dependencies: Array<{ tokenId: string; name: string; references: CSSExportPlan['entries'][number]['references']; disposition: 'exported' | 'excluded'; reason: string[] }>;
  preserveSources: string[];
  contexts: Array<{ selector: string; declarations: number }>;
  blockers: CSSExportPlan['blockers'];
  risks: string[];
  steps: string[];
  limits: string[];
}
const explanations: Record<string,string> = {
  CSS_NAME:'The identifier cannot be serialized by this bounded exporter; no automatic renaming.',
  PROVENANCE:'Source location or declaration evidence is incomplete or inconsistent.',
  CONTEXT:'Selector, layer, priority or registration semantics cannot be proved here.',
  THEME:'Tailwind declarations require separate treatment; utilities and inline use-site behavior are not reproduced.',
  SELECTOR:'The selector is outside the documented root/dark subset.',
  VALUE:'The value is unknown, derived, a fallback or otherwise outside supported literals.',
  ALIAS:'The alias syntax or reference evidence is unsupported.',
  GRAPH_EVIDENCE:'Reference/context proof is incomplete or inconsistent.',
  RESOLUTION:'The value has missing, cyclic, ambiguous or unsupported resolution.',
  REFERENCE:'The lexical alias and resolved target disagree.',
  COLLISION:'Same-name declarations have unproven precedence; no winner is guessed.',
  OVERRIDE_CLOSURE:'An excluded same-name override prevents safe family export.',
  DEPENDENCY_CLOSURE:'An alias depends on a missing, excluded or transformed declaration.'
};
/** Read-only orchestration. Original plan stays usable by renderCanonicalCSS; JSON is audit only. */
export function reviewFoundation(options: CaptureOptions, planOptions: CSSPlanOptions = {}) {
  const capture = captureDesignFoundation(options);
  const plan = planCanonicalCSS(capture, planOptions);
  const exportable = plan.entries.filter(e => e.status !== 'unsupported');
  const excluded = plan.entries.filter(e => e.status === 'unsupported');
  const groups = new Map<string,number>();
  for (const e of excluded) for (const code of new Set(e.reasons.map(r => r.split(':')[0]))) groups.set(code,(groups.get(code)??0)+1);
  const selectors = new Map<string,number>();
  for (const rule of plan.rules) selectors.set(rule.selector,(selectors.get(rule.selector)??0)+rule.declarations.length);
  const review: IntegrationReview = {
    schemaVersion:'0.1',status:plan.status,applicationSafety:'not-evaluated',
    discovered:{declarations:capture.tokens.length,inspectedFiles:capture.coverage.inspectedFiles,sources:capture.sources,diagnostics:capture.diagnostics},
    exportable,excluded,
    exclusionGroups:[...groups].sort(([a],[b])=>a.localeCompare(b,'en')).map(([code,declarations])=>({code,declarations,explanation:explanations[code]??'Inspect the full source-linked reason; no supported transformation is assumed.'})),
    dependencies:plan.entries.filter(e=>e.references.length).map(e=>({tokenId:e.tokenId,name:e.name,references:e.references,disposition:e.status==='unsupported'?'excluded':'exported',reason:e.reasons})),
    preserveSources:capture.sources.filter(s=>s.status==='inspected'||s.status==='parse-error').map(s=>s.file),
    contexts:[...selectors].map(([selector,declarations])=>({selector,declarations})),blockers:plan.blockers,
    risks:[
      'Keep ALL original stylesheets, imports, ordinary rules, fonts, Tailwind processing and excluded tokens. Even ready is not a replacement stylesheet.',
      'Adding duplicate variables can change cascade precedence, theme overrides and alias inheritance. There is no universally safe import order.',
      'CSS/TSX usage, active import graph, DOM matching and runtime theme behavior were not analyzed. A token name does not prove which screen or component uses it.',
      ...(plan.coverage.transformed ? ['Opt-in Tailwind literals become unlayered :root, :host variables; pruning, utilities and inline semantics are not reproduced. Review this context change manually.'] : []),
      'A successful preview or write is not application acceptance. Compare actual computed styles before keeping the integration.'
    ],
    steps:plan.status==='blocked' ? [
      'STOP: no CSS can be generated in this scope. --allow-partial cannot override blockers or zero exportable declarations.',
      'Inspect source-linked exclusion reasons and capture diagnostics in --json. Keep all source CSS and imports unchanged; do not write or integrate an artifact.',
      'If the cause is unsupported syntax/context, report that limitation. Do not rewrite the app or remove files from analysis merely to improve coverage.'
    ] : [
      'Inspect source paths, excluded reasons and selectors. Confirm the chosen CSS files are actually used by the application; discovery alone cannot prove this.',
      'Preview without writing. If partial, explicitly accept the listed exclusions only for a bounded experiment; never remove the source stylesheet.',
      'Write into a NEW directory only after review. Reuse explicit --css selections on later runs so generated CSS is not recaptured as a new source.',
      'In a disposable branch/copy, manually add one import of the generated tokens.css. Choose its position by inspecting the existing cascade; preserve all existing imports and source declarations.',
      'Compare original versus additive output on two screens, light/dark, navigation and a form/filter. Check colors, border/radius, spacing, fonts and relevant aliases. Record retained sources and import position.',
      'If any unexpected computed-style difference appears, remove only the newly added import and stop. Do not fix the source automatically. Identical styles demonstrate only this tested integration, not new visual capability or whole-CSS equivalence.'
    ],limits:[...capture.limits,...plan.limits]
  };
  if(plan.nativeContext){
    review.risks.push('Native layers must retain their original introduction order and identity, especially anonymous layers. Separate generated imports are not a demonstrated integration.');
    if(plan.status!=='blocked')review.steps=[
      'Review the hash-bound native source structure, excluded families, layer introductions and declared source order. Multi-file order is caller asserted, not inferred.',
      'Preview only. Preserve all original CSS. No application imports or declarations are changed by this API.',
      'Behavioral proof requires supported declarations in the same original slots and layers, with identical retained ordinary/excluded rules. A generated import is not equivalent by default.',
      'Use a disposable verification harness or independently reviewed source-slot integration. Native export does not provide a source rewriter or automatic integration command.',
      'Compare computed styles with identical DOM, viewport, mode and load conditions; include wrong-order/layer controls. Stop on any difference. M3 user acceptance remains separate.'
    ];
  }
  return {review,plan};
}
/** Compact default view; complete per-token records remain available via JSON. */
export function formatIntegrationReview(r: IntegrationReview): string {
  const clean = (s:string) => s.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');
  const lines=[`Foundation integration: ${r.status.toUpperCase()} (application safety: NOT EVALUATED)`,
    `Discovered: ${r.discovered.declarations} declarations in ${r.discovered.inspectedFiles} CSS files.`,
    `Exportable: ${r.exportable.length}. Excluded: ${r.excluded.length}. No semantic mapping required.`,
    `Dependencies: ${r.dependencies.filter(d=>d.disposition==='exported').length} exported alias declarations; ${r.dependencies.filter(d=>d.disposition==='excluded').length} excluded reference-bearing declarations.`,
    'Excluded / unsupported (reason counts can overlap):',...r.exclusionGroups.map(g=>`  ${g.code}: ${g.declarations} — ${g.explanation}`),
    ...r.blockers.map(b=>`BLOCKER ${b.code}: ${clean(b.message)}`),
    `Capture diagnostics: ${r.discovered.diagnostics.length}; see --json for every source location and reason.`,
    'Output contexts:',...r.contexts.slice(0,8).map(c=>`  ${clean(c.selector)}: ${c.declarations}`),
    ...(r.contexts.length>8?[`  +${r.contexts.length-8} contexts in --json`]:[]),
    'Preserve original sources:',...r.preserveSources.slice(0,8).map(f=>`  ${clean(f)}`),
    ...(r.preserveSources.length>8?[`  +${r.preserveSources.length-8} files in --json`]:[]),
    'Risks:',...r.risks.map(s=>`  ${s}`),'Integration guidance:',...r.steps.map((s,i)=>`  ${i+1}. ${s}`),
    'Use --json for full names, raw values, contexts, source line/column, exclusions and references.'];
  return lines.join('\n')+'\n';
}
