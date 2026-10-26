import type { Analysis, Decision, Mode } from "./types.js";
import type { Resolution, TokenNode } from "./graph.js";

type Input = Pick<Analysis, "theme" | "graph" | "mappings" | "manual_decisions" | "diagnostics" | "proposed" | "plannedOutputPaths">;
export interface OutputImpact {
  decisionId: string; sourceIds: string[]; themeTargets: string[]; modes: Mode[];
  cssTokens: string[]; tailwindTokens: string[]; dtcgPaths: string[];
  certainty: "conditional-on-choice" | "unassigned";
  blockedFiles: string[]; note: string;
}
export interface ReviewDecision {
  id: string; reason: string; sourceIds: string[];
  sources: Array<Pick<TokenNode, "id" | "name" | "provenance" | "context" | "candidates">>;
  aliasChains: Array<{ mode: Mode; nodeIds: string[]; continuesAt?: string; status: Resolution["status"] }>;
  possibleActions: string[]; impact: OutputImpact;
}
export interface DiscoveryReview {
  schemaVersion: 1;
  discoveredSources: Array<Pick<TokenNode,"id"|"name"|"rawValue"|"kind"|"context"|"provenance">>;
  resolvedAliases: Array<Resolution & { chain: string[]; continuesAt?: string }>;
  semanticProposals: Array<{ sourceId: string; target: string; certainty: "proposal"; source: TokenNode["provenance"]; context: TokenNode["context"]; appliedModes: Mode[]; editableVia?: string; blockedBy: string[] }>;
  defaultProposals: Analysis["proposed"];
  requiredDecisions: ReviewDecision[];
  recordedDecisions: Decision[];
  unsupportedExcluded: Array<{ sourceId?: string; classification: "unsupported" | "reference-blocker" | "explicit-exclusion" | "coverage-limit"; reason: string; repair: string; blockedFiles?: string[] }>;
  outputImpact: OutputImpact[];
  limits: string[];
}
const kebab = (s:string) => s.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();
/** Impact metadata, not a second generator. Wildcards explicitly describe token families. */
function tokenImpact(target: string, modes: Mode[]) {
  const css: string[]=[], tw: string[]=[];
  if (target.startsWith("colors.")) {
    const name=kebab(target.slice(7));css.push(`--theme-${name}`,`--theme-${name}-rgb`);tw.push(`--color-${name}`);
    if(name==="primary") { css.push("--theme-primary-hover*","--theme-primary-active*");tw.push("--color-primary-hover","--color-primary-active"); }
  } else if(target==="typography.fontFamily") {css.push("--theme-font-family","--theme-font-family-heading");tw.push("--font-sans");}
  else if(target==="typography.baseSize" || target==="typography.scale") {css.push("--theme-font-size-*");tw.push("--text-*");}
  else if(target.startsWith("typography.weights.")) {const k=target.slice(19);css.push(`--theme-font-weight-${k}`);tw.push(`--font-weight-${k}`);if(k==="regular"){css.push("--theme-font-weight-normal");tw.push("--font-weight-normal");}}
  else if(target.startsWith("typography.lineHeights.")) {const k=target.slice(23);css.push(`--theme-line-height-${k}`);tw.push(`--leading-${k}`);}
  else if(target.startsWith("spacing.values.")) {const k=target.slice(15);css.push(`--theme-spacing-${k}`);tw.push(`--spacing-${k}`);}
  else if(target==="spacing.baseUnit") {css.push("--theme-spacing-*");tw.push("--spacing","--spacing-*");}
  else if(target.startsWith("borders.")) {
    const names:Record<string,string[]>={thin:["border-thin"],default:["border-width"],thick:["border-thick"],radiusSubtle:["radius-subtle","radius-base"],radiusRelaxed:["radius-relaxed","radius-medium"],radiusPill:["radius-pill"],defaultStyle:["border-style"]};
    css.push(...(names[target.slice(8)]??[]).map(x=>`--theme-${x}`));
  }
  const dtcg=target==="borders.defaultStyle" ? ["$extensions.com.spexop.theme.source.borders.defaultStyle"] : modes.map(mode=>`${mode}.${target}`);
  return {css,tw,dtcg};
}

export function createDiscoveryReview(input: Input): DiscoveryReview {
  const nodes=new Map(input.graph.nodes.map(n=>[n.id,n]));
  const resolutions=new Map(input.graph.resolutions.map(r=>[`${r.mode}:${r.nodeId}`,r]));
  const byLocation=new Map<string,string[]>();
  const locationKey=(s:TokenNode["provenance"])=>`${s.file}:${s.line}:${s.column}`;
  for(const n of nodes.values()) {const k=locationKey(n.provenance);byLocation.set(k,[...(byLocation.get(k)??[]),n.id]);}
  const trace=(id:string, mode:Mode)=>{
    const chain:string[]=[],seen=new Set<string>();let current:string|undefined=id;
    while(current && !seen.has(current) && chain.length<32) {
      chain.push(current);seen.add(current);const r=resolutions.get(`${mode}:${current}`);
      current=r?.targetIds.length===1?r.targetIds[0]:undefined;
    }
    return {chain,...(current&&!seen.has(current)?{continuesAt:current}:{})};
  };
  const impacts:OutputImpact[]=[];
  const required:ReviewDecision[]=[];
  for(const d of input.manual_decisions) {
    const sourceIds=[...new Set([
      ...(d.id.startsWith("map:") && nodes.has(d.id.slice(4))?[d.id.slice(4)]:[]),
      ...(d.source?byLocation.get(locationKey(d.source))??[]:[]),
      ...(d.options??[]).filter(id=>nodes.has(id)),
    ])];
    const sources=sourceIds.map(id=>nodes.get(id)!);
    const target=d.token?.replace(/^(light|dark)\./,"");
    const targets=[...new Set([...(target?[target]:[]),...(d.resolution?.target?[d.resolution.target]:[]),...(d.options??[]).filter(x=>/^(colors|spacing|typography|borders)\./.test(x))])];
    const possibleModes:Mode[]=d.token?.startsWith("dark.")?["dark"]:d.token?.startsWith("light.")?["light"]:
      sources.length && targets.length && sources.every(s=>s.context.mode==="light") && targets.every(t=>t.startsWith("colors."))?["light"]:
      sources.length && sources.every(s=>s.context.mode==="dark")?["dark"]:["light","dark"];
    const modes = possibleModes.filter(m=>m==="light" || input.theme.darkMode?.enabled);
    const tokens=targets.map(t=>tokenImpact(t,modes));
    const impact:OutputImpact={decisionId:d.id,sourceIds,themeTargets:targets,modes,
      cssTokens:[...new Set(tokens.flatMap(t=>t.css))],tailwindTokens:[...new Set(tokens.flatMap(t=>t.tw))],dtcgPaths:[...new Set(tokens.flatMap(t=>t.dtcg))],
      certainty:targets.length?"conditional-on-choice":"unassigned",blockedFiles:d.resolved?[]:input.plannedOutputPaths,
      note:targets.length?"Possible targets, not claimed emitted tokens. * means a generated family; downstream alias effects can be broader. Tailwind file also embeds the CSS variables. All three outputs are atomic.":"No semantic target is selected. No output token name is invented. Choose a role or explicitly exclude; unresolved decision blocks all outputs."};
    impacts.push(impact);
    if(!d.resolved) required.push({id:d.id,reason:d.reason,sourceIds,sources:sources.map(({id,name,provenance,context,candidates})=>({id,name,provenance,context,candidates})),
      aliasChains:sources.flatMap(n=>(["light","dark"] as const).flatMap(mode=>{const r=resolutions.get(`${mode}:${n.id}`);if(!r||n.kind!=="alias")return[];const t=trace(n.id,mode);return[{mode,nodeIds:t.chain,continuesAt:t.continuesAt,status:r.status}];})),
      possibleActions:d.kind==="mapping"?["Choose a supported Theme target", "Explicitly exclude this source",...(d.options??[])]:d.kind==="conflict"?["Choose a listed source",...(d.options??[])]:d.kind==="inheritance"?["Explicitly inherit light value","Provide an explicit dark value"]:["Provide a reviewed value"],impact});
  }
  const unresolvedNodes=new Map<string,Resolution[]>();
  for(const r of input.graph.resolutions)if(r.status!=="resolved")unresolvedNodes.set(r.nodeId,[...(unresolvedNodes.get(r.nodeId)??[]),r]);
  const diagnosticBlocks=new Map<string,string[]>();
  for(const d of input.diagnostics) if(d.source && (d.severity==="error" || d.severity==="unsupported")) {
    for(const id of byLocation.get(locationKey(d.source))??[]) diagnosticBlocks.set(id,[...(diagnosticBlocks.get(id)??[]),d.code]);
  }
  const unsupported:DiscoveryReview["unsupportedExcluded"]=[...unresolvedNodes].map(([sourceId,rs])=>({sourceId,
    classification:rs.some(r=>r.status==="unsupported"||r.status==="derived")?"unsupported":"reference-blocker",
    reason:rs.map(r=>`${r.mode}: ${r.status}${r.reason?` — ${r.reason}`:""}`).join("; "),repair:"Inspect source/context; semantic answers cannot resolve an unsupported CSS computation.",blockedFiles:input.plannedOutputPaths}));
  for(const d of input.manual_decisions)if(d.resolved&&d.resolution?.ignore)unsupported.push({sourceId:d.id.slice(4),classification:"explicit-exclusion",reason:d.reason,repair:"Explicit user exclusion; source file is preserved."});
  for(const d of input.diagnostics)if(["IMPORT_NOT_FOLLOWED","SYMLINK_SKIPPED","RUNTIME_NOT_CHECKED"].includes(d.code))unsupported.push({classification:"coverage-limit",reason:d.message,repair:d.fix});
  for(const d of input.diagnostics) if ((d.severity === "unsupported" || d.severity === "error") && !["GRAPH_RESOLUTION","IMPORT_NOT_FOLLOWED","SYMLINK_SKIPPED","RUNTIME_NOT_CHECKED"].includes(d.code)) {
    unsupported.push({sourceId:d.source?byLocation.get(locationKey(d.source))?.[0]:undefined,
      classification:d.severity==="unsupported"?"unsupported":"reference-blocker",reason:`${d.code}: ${d.message}`,repair:d.fix,blockedFiles:input.plannedOutputPaths});
  }
  return {schemaVersion:1,discoveredSources:input.graph.nodes.map(({id,name,rawValue,kind,context,provenance})=>({id,name,rawValue,kind,context,provenance})),
    resolvedAliases:input.graph.resolutions.filter(r=>r.status==="resolved"&&nodes.get(r.nodeId)?.kind==="alias").map(r=>({...r,...trace(r.nodeId,r.mode)})),
    semanticProposals:input.graph.nodes.flatMap(n=>n.candidates.map(c=>({sourceId:n.id,target:c.target,certainty:"proposal" as const,source:n.provenance,context:n.context,
      appliedModes:input.mappings.filter(m=>m.sourceId===n.id&&m.target===c.target).map(m=>m.mode),editableVia:unresolvedNodes.has(n.id)?undefined:`map:${n.id}`,blockedBy:[...new Set([...(unresolvedNodes.get(n.id)??[]).map(r=>`${r.mode}:${r.status}`),...(diagnosticBlocks.get(n.id)??[])])]}))),
    defaultProposals:input.proposed,requiredDecisions:required,recordedDecisions:input.manual_decisions.filter(d=>d.resolved),unsupportedExcluded:unsupported,outputImpact:impacts,
    limits:[...input.graph.limits,"Alias chains display up to 32 steps; continuesAt links to the complete graph, no source edges are discarded.","Output impact is a conditional model projection, not proof of active application usage or complete downstream dependency closure."]};
}
