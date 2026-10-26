import { buildTokenGraph } from "../graph.js";
import type { parseCSSSources } from "../parse-css.js";
import { colorValue } from "./color.js";
import { assertModel, type CanonicalDesignModel, type CanonicalToken, type Literal, type Reference, type TypeEvidence } from "./model.js";
/** Small lexical shield, not a CSS expression evaluator. Quoted/comment text cannot create edges. */
export function maskText(value: string): string {
    return value.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, m => " ".repeat(m.length));
}
export function references(value: string): Reference[] {
    const mask = maskText(value), refs: Reference[] = [];
    for (const match of mask.matchAll(/(?<![\w-])var\(\s*(--[^\s(),]+)/g)) {
        const start = match.index!, open = mask.indexOf("(", start);
        let depth = 1, end = open + 1, comma = -1;
        for (; end < mask.length; end++) {
            if (mask[end] === "(")
                depth++;
            else if (mask[end] === ")" && !--depth)
                break;
            else if (mask[end] === "," && depth === 1 && comma < 0)
                comma = end;
        }
        if (depth)
            continue;
        refs.push({ syntax: "css-var", name: match[1], raw: value.slice(start, end + 1), ...(comma >= 0 ? { fallback: value.slice(comma + 1, end).trim() } : {}) });
    }
    return refs;
}
function infer(raw: string): {
    literal?: Literal;
    type: TypeEvidence;
} {
    const v = raw.trim();
    if (!/^(?:initial|inherit|unset|revert|revert-layer|currentcolor)$/i.test(v))
        try {
            const color = colorValue(v);
            return { literal: { type: "color", colorSpace: color.colorSpace as "srgb" | "oklch", components: color.components as [
                        number,
                        number,
                        number
                    ], alpha: color.alpha }, type: { status: "known", type: "color", evidence: "value-syntax" } };
        }
        catch { /* Other token types remain possible. */ }
    const number = "[+-]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][+-]?\\d+)?";
    const percent = new RegExp(`^(${number})%$`).exec(v);
    if (percent && Number.isFinite(+percent[1]))
        return { literal: { type: "percentage", value: +percent[1] }, type: { status: "known", type: "percentage", evidence: "value-syntax" } };
    const dimension = new RegExp(`^(${number})(px|rem|em|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$`).exec(v);
    if (dimension && Number.isFinite(+dimension[1]))
        return { literal: { type: "dimension", value: +dimension[1], unit: dimension[2] }, type: { status: "known", type: "dimension", evidence: "value-syntax" } };
    const duration = new RegExp(`^(${number})(ms|s)$`).exec(v);
    if (duration && Number.isFinite(+duration[1]))
        return { literal: { type: "duration", value: +duration[1], unit: duration[2] as "ms" | "s" }, type: { status: "known", type: "duration", evidence: "value-syntax" } };
    if (new RegExp(`^${number}$`).test(v) && Number.isFinite(+v))
        return { literal: { type: "number", value: +v }, type: { status: "known", type: "number", evidence: "value-syntax" } };
    const bez = /^cubic-bezier\(([^)]+)\)$/.exec(v), parts = bez?.[1].split(",").map(x => x.trim()), coords = parts?.every(x => new RegExp(`^${number}$`).test(x)) ? parts.map(Number) : undefined;
    if (coords?.length === 4 && coords.every(Number.isFinite) && coords[0] >= 0 && coords[0] <= 1 && coords[2] >= 0 && coords[2] <= 1)
        return { literal: { type: "cubicBezier", value: coords as [
                    number,
                    number,
                    number,
                    number
                ] }, type: { status: "known", type: "cubicBezier", evidence: "value-syntax" } };
    return { type: { status: "ambiguous", candidates: [], reason: "No unique supported type from value syntax; names do not certify a type." } };
}
/** CSS is an adapter. No targetFor/defaultTheme/required roles or user mapping decisions. */
export function modelFromCSS(discovery: ReturnType<typeof parseCSSSources>, namespace: string, commit?: string): CanonicalDesignModel {
    if (!namespace.trim())
        throw new Error("Explicit source namespace required");
    const captures = discovery.declarations;
    const lexicalUnsupported = new Set(discovery.found.filter(f => references(f.value).some(r => !/^--[\w-]+$/.test(r.name))).map(f => f.id));
    const clean = discovery.found.map(f => ({ ...f, supported: f.supported && !lexicalUnsupported.has(f.id), value: infer(f.value).literal ? "0" : maskText(f.value).replace(/(?<=[\w-])var\(/g, "xxx(") }));
    // The old graph only needs scalar-versus-expression, not scalar content. The adapter has already
    // validated typed literals (including cubic-bezier); source values remain untouched in the model.
    const graph = buildTokenGraph(clean);
    const prefix = (id: string) => `${namespace}::${id}`;
    const contexts = graph.nodes.map<CanonicalDesignModel["contexts"][number]>(n => ({ id: prefix(n.id) + ":context", axes: Object.fromEntries(n.context.mode === "dark" ? [["theme", "dark"]] : n.context.selector.trim() === ":root" ? [["theme", "light"]] : []), source: { kind: "css", selector: n.context.selector, ancestors: n.context.ancestors, order: n.context.sourceOrder, origin: n.context.origin, supported: n.context.supported } }));
    const tokens: CanonicalToken[] = discovery.found.map(f => {
        const capture = captures.get(f.id);
        if (!capture)
            throw new Error("Source capture missing");
        const refs = references(f.value), info = infer(f.value), direct = /^var\(\s*--[\w-]+\s*\)$/.test(f.value.trim());
        const value = direct && refs.length === 1 ? { kind: "alias" as const, raw: f.value, reference: refs[0] } : refs.length || (!info.literal && /[a-z-]+\(/i.test(maskText(f.value))) ? { kind: "expression" as const, raw: f.value, references: refs } : info.literal ? { kind: "literal" as const, raw: f.value, literal: info.literal } : { kind: "unparsed" as const, raw: f.value };
        return { id: prefix(f.id), identity: { namespace, sourceName: f.variable, path: [f.variable], familyId: JSON.stringify([namespace, f.variable]) }, contextId: prefix(f.id) + ":context", value, type: value.kind === "literal" ? info.type : { status: value.kind === "expression" ? "unsupported" : "ambiguous", candidates: [], reason: "Expression/reference type is not a declared semantic role." }, references: refs,
            provenance: { ...f.source, ...(commit ? { commit } : {}), fileSha256: capture.sha, rawDeclaration: capture.raw, important: capture.important }, semantics: { declared: [], proposals: [] } };
    });
    const ownDuplicates = new Set<string>(), groups = new Map<string, string[]>();
    for (const n of graph.nodes) {
        const k = JSON.stringify([n.name, n.context.selector]);
        groups.set(k, [...(groups.get(k) ?? []), n.id]);
    }
    for (const ids of groups.values())
        if (ids.length > 1)
            for (const id of ids)
                ownDuplicates.add(id);
    const resolutions = graph.resolutions.map(r => {
        if (lexicalUnsupported.has(r.nodeId))
            return { tokenId: prefix(r.nodeId), evaluationScope: r.mode, status: "unsupported" as const, targetIds: [], reason: "Escaped/non-ASCII reference names are preserved but not normalized by the bounded resolver." };
        const duplicate = ownDuplicates.has(r.nodeId) || r.targetIds.some(id => ownDuplicates.has(id));
        return { tokenId: prefix(r.nodeId), evaluationScope: r.mode, status: duplicate ? "ambiguous" as const : r.status, targetIds: r.targetIds.map(prefix), ...(!duplicate && r.canonicalSourceId ? { canonicalId: prefix(r.canonicalSourceId) } : {}), reason: duplicate ? "Same-name declarations have no proven cascade winner." : r.reason ?? `Bounded CSS graph: ${r.status}; this is not an application computed style.` };
    });
    const model: CanonicalDesignModel = { schemaVersion: "0.1", namespace, contexts, evaluationScopes: [{ id: "light", axes: { theme: "light" } }, { id: "dark", axes: { theme: "dark" } }], tokens, resolutions, diagnostics: discovery.diagnostics.map(d => ({ code: d.code, message: d.message, source: d.source })), limits: ["Snapshot declaration identity, not a stable ID across source edits.", "Original declarations/context are preserved; whole CSS AST/import order/cascade is not reproduced.", "CSS adapter handles root/dark/Tailwind subset only; arbitrary brand selectors remain recorded unsupported contexts.", "No intended role is inferred from a CSS custom-property name. Type is from supported value syntax only.", "No DTCG input, Resolver or output generation in capture."] };
    assertModel(model);
    return model;
}
