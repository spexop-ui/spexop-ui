import type { FoundValue, Location, Mode } from "./types.js";
export interface SemanticCandidate { target: string; status: "proposed"; evidence: "name-rule"; }
export interface TokenContext { selector: string; mode: Mode | "shared"; origin: FoundValue["origin"]; ancestors: string[]; supported: boolean; sourceOrder: number; }
export interface TokenNode {
  id: string; name: string; rawValue: string;
  kind: "source" | "alias" | "derived";
  context: TokenContext; provenance: Location;
  references: string[]; candidates: SemanticCandidate[];
}
export interface Resolution {
  nodeId: string; mode: Mode;
  status: "resolved" | "missing" | "cycle" | "ambiguous" | "derived" | "unsupported";
  targetIds: string[]; canonicalSourceId?: string; reason?: string;
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
  const nodes: TokenNode[] = found.map((v, sourceOrder) => {
    const references = [...new Set([...v.value.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]))];
    const alias = simpleAlias.test(v.value);
    const derived = !alias && (references.length > 0 || /[a-z-]+\(/i.test(v.value) && !/^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i.test(v.value));
    const role = candidate?.(v);
    return {id:v.id,name:v.variable,rawValue:v.value,kind:alias?"alias":derived?"derived":"source",
      context:{selector:v.selector,mode:v.origin==="tailwind-theme"?"shared":v.mode,origin:v.origin,ancestors:v.ancestors??[],supported:v.supported,sourceOrder},
      provenance:v.source,references,candidates:role?[{target:role,status:"proposed",evidence:"name-rule"}]:[]};
  });
  const byId = new Map(nodes.map(n=>[n.id,n]));
  const indexes = new Map<string,TokenNode[]>();
  for(const n of nodes) {
    if (!n.context.supported) continue;
    const k=`${n.context.mode}:${n.name}`;
    indexes.set(k,[...(indexes.get(k)??[]),n]);
  }
  const allByName = new Map<string, TokenNode[]>();
  for (const n of nodes) allByName.set(n.name, [...(allByName.get(n.name) ?? []), n]);
  const targets = (name: string, mode: Mode): TokenNode[] => {
    const shared = indexes.get(`shared:${name}`) ?? [];
    const light = indexes.get(`light:${name}`) ?? [];
    const dark = indexes.get(`dark:${name}`) ?? [];
    if (mode === "light" || !dark.length) return [...light, ...shared];
    // A unique supported dark declaration is applicable only in its recorded selector.
    // If it might share the root element, require higher specificity or known later order.
    const canOverride = dark.length === 1 && light.every(l =>
      /^(?:html|:root)/.test(dark[0].context.selector.trim()) ||
      l.provenance.file === dark[0].provenance.file && l.context.sourceOrder < dark[0].context.sourceOrder);
    return [...dark, ...(canOverride ? [] : light), ...shared];
  };
  const unsupportedName = (name: string) => (allByName.get(name) ?? []).some(n => !n.context.supported);
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
      let reason: string | undefined;
      if(!current.context.supported)status=current.kind==="derived"?"derived":"unsupported";
      else if(current.kind==="derived")status="derived";
      else if (/^(?:initial|inherit|unset|revert|revert-layer|revert-rule|currentcolor)$/i.test(current.rawValue.trim())) {
        status="unsupported"; reason="CSS-wide/context-dependent value needs computed style, not literal substitution.";
      } else if (current.kind === "alias" && current.context.origin === "tailwind-theme" && current.context.selector.trim() !== "@theme inline") {
        status="unsupported"; reason="Non-inline Tailwind aliases resolve at their definition, not the utility consumer; generated CSS is not evaluated.";
      } else if (mode === "dark" && current.context.mode === "light" && current.kind === "alias") {
        status="unsupported"; reason="Inherited aliases are computed before inheritance; root versus descendant placement is not proven.";
      } else if (current.references.some(unsupportedName)) {
        status="unsupported"; reason="Reference has declarations in unsupported scopes; applicability cannot be proven.";
      } else if (current.kind === "alias" && current.context.mode === "dark" && refs.some(r => r.context.mode === "dark" && r.context.selector.trim() !== current!.context.selector.trim())) {
        status="unsupported"; reason="Different dark selectors are not proven to match the same element.";
      } else if (current.kind === "source" && (targets(current.name, mode).length > 1 || unsupportedName(current.name))) {
        status = unsupportedName(current.name) ? "unsupported" : "ambiguous";
        reason = "Competing declarations require cascade/scope evaluation; source order is recorded but not used to choose a winner.";
      } else if(current.kind==="source")status="resolved";
      else if(refs.length!==1)status=refs.length?"ambiguous":"missing";
      if(status){terminal={nodeId:current.id,mode,status,targetIds:refs.map(n=>n.id),...(reason?{reason}:{}),...(status==="resolved"?{canonicalSourceId:current.id}:{})};results.set(key(current.id),terminal);break;}
      current=refs[0];
    }
    for(const n of path.reverse()) {
      if(results.has(key(n.id)))continue;
      const refs=n.references.flatMap(name=>targets(name,mode));
      const result:Resolution={nodeId:n.id,mode,status:terminal!.status,targetIds:refs.map(x=>x.id),...(terminal!.reason?{reason:terminal!.reason}:{}),...(terminal!.canonicalSourceId?{canonicalSourceId:terminal!.canonicalSourceId}:{})};
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
  return {schemaVersion:1,nodes,resolutions,uncertainties,limits:["Resolved means a declaration or reference under its recorded selector, never whole-app computed style; mode selectors are not interchangeable","Derived expressions and fallbacks are not evaluated","Semantic candidates are proposals; names alone never establish intended UI roles","DTCG input adapter not implemented; existing Theme DTCG output/reread unchanged"]};
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
      const direct = r.targetIds.length === 1 ? nodes.get(r.targetIds[0]) : undefined;
      const sameProposedRole = n.candidates.length > 0 && n.candidates[0].target === source.candidates[0]?.target;
      const namespaceExport = n.context.selector.trim() === "@theme inline" && direct && n.name === `--color-${direct.name.slice(2)}`;
      return sameProposedRole || !!namespaceExport;
    }))redundant.add(n.id);
  }
  return redundant;
}
