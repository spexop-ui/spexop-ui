import type { FoundValue, Location, Mode } from "./types.js";
export interface SemanticCandidate { target: string; status: "proposed"; evidence: "name-rule"; }
export interface TokenContext { selector: string; mode: Mode | "shared"; origin: FoundValue["origin"]; ancestors: string[]; supported: boolean; }
export interface TokenNode {
  id: string; name: string; rawValue: string;
  kind: "source" | "alias" | "derived";
  context: TokenContext; provenance: Location;
  references: string[]; candidates: SemanticCandidate[];
}
export interface Resolution {
  nodeId: string; mode: Mode;
  status: "resolved" | "missing" | "cycle" | "ambiguous" | "derived" | "unsupported";
  targetIds: string[]; canonicalSourceId?: string;
}
export interface Uncertainty {
  nodeId: string; category: "reference" | "unsupported" | "semantic";
  reason: string; userDecisionRequired: boolean;
  affectedOutputs: string[];
}
export interface TokenGraph {
  schemaVersion: 1;
  nodes: TokenNode[];
  resolutions: Resolution[];
  uncertainties: Uncertainty[];
  limits: string[];
}
const simpleAlias = /^var\(\s*(--[\w-]+)\s*\)$/;
/** Pure graph over declarations; no filesystem, CSS evaluation or Theme generation. */
export function buildTokenGraph(found: FoundValue[], candidate?: (v: FoundValue) => string | undefined): TokenGraph {
  const nodes: TokenNode[] = found.map(v => {
    const references = [...new Set([...v.value.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]))];
    const alias = simpleAlias.test(v.value);
    const derived = !alias && (references.length > 0 || /[a-z-]+\(/i.test(v.value) && !/^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i.test(v.value));
    const role = candidate?.(v);
    return {id:v.id,name:v.variable,rawValue:v.value,kind:alias?"alias":derived?"derived":"source",
      context:{selector:v.selector,mode:v.origin==="tailwind-theme"?"shared":v.mode,origin:v.origin,ancestors:v.ancestors??[],supported:v.supported},
      provenance:v.source,references,candidates:role?[{target:role,status:"proposed",evidence:"name-rule"}]:[]};
  });
  const byId = new Map(nodes.map(n=>[n.id,n]));
  const indexes = new Map<string,TokenNode[]>();
  for(const n of nodes) {
    if (!n.context.supported) continue;
    const k=`${n.context.mode}:${n.name}`;
    indexes.set(k,[...(indexes.get(k)??[]),n]);
  }
  const targets=(name:string,mode:Mode):TokenNode[]=>
    indexes.get(`${mode}:${name}`) ?? (mode==="dark"?indexes.get(`light:${name}`):undefined) ?? indexes.get(`shared:${name}`) ?? [];
  const results=new Map<string,Resolution>();
  // Memoized iterative walk; provenance stays as direct edges, not quadratic expanded paths.
  for(const mode of ["light","dark"] as const) for(const start of nodes) {
    if(start.context.mode!=="shared" && start.context.mode!==mode) continue;
    const key=(id:string)=>`${mode}:${id}`;
    if(results.has(key(start.id))) continue;
    const path:TokenNode[]=[], active=new Set<string>();let current:TokenNode|undefined=start;
    let terminal:Resolution|undefined;
    while(current) {
      const known=results.get(key(current.id));if(known){terminal=known;break;}
      if(active.has(current.id)){terminal={nodeId:current.id,mode,status:"cycle",targetIds:[]};break;}
      active.add(current.id);path.push(current);
      const refs: TokenNode[]=current.references.flatMap(n=>targets(n,mode));
      let status:Resolution["status"]|undefined;
      if(!current.context.supported)status=current.kind==="derived"?"derived":"unsupported";
      else if(current.kind==="derived")status="derived";
      else if(current.kind==="source")status="resolved";
      else if(refs.length!==1)status=refs.length?"ambiguous":"missing";
      if(status){terminal={nodeId:current.id,mode,status,targetIds:refs.map(n=>n.id),...(status==="resolved"?{canonicalSourceId:current.id}:{})};results.set(key(current.id),terminal);break;}
      current=refs[0];
    }
    for(const n of path.reverse()) {
      if(results.has(key(n.id)))continue;
      const refs=n.references.flatMap(name=>targets(name,mode));
      const result:Resolution={nodeId:n.id,mode,status:terminal!.status,targetIds:refs.map(x=>x.id),...(terminal!.canonicalSourceId?{canonicalSourceId:terminal!.canonicalSourceId}:{})};
      results.set(key(n.id),result);terminal=result;
    }
  }
  const resolutions=[...results.values()].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)||a.mode.localeCompare(b.mode));
  const resolutionIndex = new Map<string, Resolution[]>();
  for (const r of resolutions) resolutionIndex.set(r.nodeId, [...(resolutionIndex.get(r.nodeId) ?? []), r]);
  const uncertainties:Uncertainty[]=[];
  for(const n of nodes) {
    const rs=resolutionIndex.get(n.id) ?? [];
    if(rs.some(r=>r.status!=="resolved"))uncertainties.push({nodeId:n.id,category:rs.some(r=>r.status==="derived"||r.status==="unsupported")?"unsupported":"reference",reason:rs.map(r=>`${r.mode}:${r.status}`).join(", "),userDecisionRequired:false,affectedOutputs:["reference resolution","Foundation generation"]});
    else if(n.kind==="source" && !n.candidates.length)uncertainties.push({nodeId:n.id,category:"semantic",reason:"Source is known; no unambiguous proposed Theme role. Aliases remain evidence, not independent values.",userDecisionRequired:true,affectedOutputs:["Theme semantic mapping","CSS/Tailwind/DTCG"]});
  }
  // Readability assertion: every edge points to an actual declaration, never a synthesized value.
  for(const r of resolutions)if(r.targetIds.some(id=>!byId.has(id)))throw new Error("Invalid graph edge");
  return {schemaVersion:1,nodes,resolutions,uncertainties,limits:["Conditional selector/mode resolution, not full CSS cascade or active import proof","Derived expressions and fallbacks are not evaluated","Semantic candidates are proposals; names alone never establish intended UI roles","DTCG input adapter not implemented; existing Theme DTCG output/reread unchanged"]};
}
/** Aliases sharing one role/source require no second scalar decision. Distinct role candidates remain distinct. */
export function redundantAliasIds(graph:TokenGraph):Set<string> {
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));const grouped=new Map<string,Resolution[]>();
  for(const r of graph.resolutions)grouped.set(r.nodeId,[...(grouped.get(r.nodeId)??[]),r]);
  const redundant=new Set<string>();
  for(const n of graph.nodes) {
    if(n.kind!=="alias" || !n.context.supported)continue;
    const rs=grouped.get(n.id)??[];
    if(!rs.length || rs.some(r=>r.status!=="resolved"))continue;
    if(rs.every(r=>{
      const source=nodes.get(r.canonicalSourceId!)!;
      return !n.candidates.length || n.candidates[0].target===source.candidates[0]?.target;
    }))redundant.add(n.id);
  }
  return redundant;
}
