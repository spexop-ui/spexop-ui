/** Canonical capture contract v0.1. No Theme roles, CSS evaluator, IO or framework dependency. */
export type TokenType = "color" | "dimension" | "percentage" | "number" | "fontFamily" | "fontWeight" | "typography" | "shadow" | "border" | "duration" | "cubicBezier";
export type Literal = {
    type: "color";
    colorSpace: "srgb" | "oklch";
    components: [
        number,
        number,
        number
    ];
    alpha: number;
} | {
    type: "dimension";
    value: number;
    unit: string;
} | {
    type: "number" | "fontWeight" | "percentage";
    value: number;
} | {
    type: "duration";
    value: number;
    unit: "ms" | "s";
} | {
    type: "cubicBezier";
    value: [
        number,
        number,
        number,
        number
    ];
} | {
    type: "fontFamily";
    value: string[];
};
export type TypeEvidence = {
    status: "known";
    type: TokenType;
    evidence: "value-syntax" | "explicit-source-type";
} | {
    status: "ambiguous" | "unsupported";
    candidates: TokenType[];
    reason: string;
};
export interface Reference {
    syntax: "css-var" | "dtcg-alias";
    name: string;
    raw: string;
    fallback?: string;
}
export type Value = {
    kind: "literal";
    raw: string;
    literal: Literal;
} | {
    kind: "alias";
    raw: string;
    reference: Reference;
} | {
    kind: "expression";
    raw: string;
    references: Reference[];
} | {
    kind: "unparsed";
    raw: string;
};
export interface Context {
    id: string;
    axes: Record<string, string>;
    source: {
        kind: "css";
        selector: string;
        ancestors: string[];
        order: number;
        origin: "css" | "tailwind-theme";
        supported: boolean;
    } | {
        kind: "dtcg";
        path: string[];
    } | {
        kind: "explicit";
        scope: string;
    };
}
export interface CanonicalToken {
    id: string;
    identity: {
        namespace: string;
        sourceName: string;
        path: string[];
        familyId: string;
    };
    contextId: string;
    value: Value;
    type: TypeEvidence;
    references: Reference[];
    provenance: {
        file: string;
        line: number;
        column: number;
        commit?: string;
        fileSha256: string;
        rawDeclaration: string;
        important: boolean;
    };
    semantics: {
        declared: Array<{
            role: string;
            evidence: string;
        }>;
        proposals: Array<{
            role: string;
            evidence: string;
        }>;
    };
}
export interface ReferenceResolution {
    tokenId: string;
    evaluationScope: string;
    status: "resolved" | "ambiguous" | "missing" | "cycle" | "derived" | "unsupported";
    targetIds: string[];
    canonicalId?: string;
    reason: string;
}
export interface CanonicalDesignModel {
    schemaVersion: "0.1";
    namespace: string;
    contexts: Context[];
    evaluationScopes: Array<{
        id: string;
        axes: Record<string, string>;
    }>;
    tokens: CanonicalToken[];
    resolutions: ReferenceResolution[];
    diagnostics: Array<{
        code: string;
        message: string;
        source?: {
            file: string;
            line: number;
            column: number;
        };
    }>;
    limits: string[];
}
export function assertModel(model: CanonicalDesignModel): void {
    if (model.schemaVersion !== "0.1")
        throw new Error("Unknown model version");
    const ids = new Set(model.tokens.map(t => t.id)), contexts = new Set(model.contexts.map(c => c.id));
    if (ids.size !== model.tokens.length || contexts.size !== model.contexts.length)
        throw new Error("Duplicate identity");
    for (const t of model.tokens) {
        if (!contexts.has(t.contextId) || !t.provenance.rawDeclaration || !t.identity.sourceName)
            throw new Error("Incomplete source evidence");
        if (t.value.kind === "literal" && (t.type.status !== "known" || t.value.literal.type !== t.type.type))
            throw new Error("Literal/type mismatch");
        if (t.value.kind === "literal") {
            const v = t.value.literal;
            if (v.type === "color") {
                if (!["srgb", "oklch"].includes(v.colorSpace) || v.components.length !== 3 || !v.components.every(Number.isFinite) || !Number.isFinite(v.alpha) || v.alpha < 0 || v.alpha > 1)
                    throw new Error("Invalid color components");
            }
            else if (v.type === "cubicBezier") {
                if (v.value.length !== 4 || !v.value.every(Number.isFinite) || v.value[0] < 0 || v.value[0] > 1 || v.value[2] < 0 || v.value[2] > 1)
                    throw new Error("Invalid cubicBezier");
            }
            else if (v.type === "fontFamily") {
                if (!v.value.length || v.value.some(x => typeof x !== "string" || !x.trim()))
                    throw new Error("Invalid font family");
            }
            else {
                if (!Number.isFinite(v.value))
                    throw new Error("Non-finite scalar");
                if (v.type === "fontWeight" && (v.value < 1 || v.value > 1000))
                    throw new Error("Invalid font weight");
                if (v.type === "duration" && !["ms", "s"].includes(v.unit))
                    throw new Error("Invalid duration unit");
                if (v.type === "dimension" && !/^[a-z%]+$/.test(v.unit))
                    throw new Error("Invalid dimension unit");
            }
        }
    }
    const scopes = new Set(model.evaluationScopes.map(s => s.id)), records = new Set<string>();
    if (scopes.size !== model.evaluationScopes.length)
        throw new Error("Duplicate evaluation scope");
    for (const r of model.resolutions) {
        const key = JSON.stringify([r.tokenId, r.evaluationScope]);
        if (records.has(key) || !scopes.has(r.evaluationScope) || !ids.has(r.tokenId) || r.targetIds.some(id => !ids.has(id)))
            throw new Error("Invalid reference identity");
        records.add(key);
        if (r.status === "resolved" && (!r.canonicalId || !ids.has(r.canonicalId)))
            throw new Error("Resolved without source");
        if (r.status !== "resolved" && r.canonicalId)
            throw new Error("Uncertain result cannot claim a canonical source");
    }
    const tokens = new Map(model.tokens.map(t => [t.id, t])), rs = new Map(model.resolutions.map(r => [JSON.stringify([r.tokenId, r.evaluationScope]), r]));
    const validated = new Set<string>();
    for (const start of model.resolutions.filter(r => r.status === "resolved")) {
        const own = tokens.get(start.tokenId)!, terminal = tokens.get(start.canonicalId!)!;
        if (own.type.status === "known" && terminal.type.status === "known" && own.type.type !== terminal.type.type)
            throw new Error("Alias type differs from terminal type");
        if (validated.has(JSON.stringify([start.tokenId, start.evaluationScope])))
            continue;
        let r = start;
        const seen = new Set<string>();
        while (r.targetIds.length) {
            if (validated.has(JSON.stringify([r.tokenId, r.evaluationScope])))
                break;
            if (r.targetIds.length !== 1 || seen.has(r.tokenId))
                throw new Error("Resolved chain branches or cycles");
            seen.add(r.tokenId);
            const next = rs.get(JSON.stringify([r.targetIds[0], r.evaluationScope]));
            if (!next || next.status !== "resolved" || next.canonicalId !== start.canonicalId)
                throw new Error("Resolved chain lacks consistent evidence");
            r = next;
        }
        if (!validated.has(JSON.stringify([r.tokenId, r.evaluationScope])) && r.tokenId !== start.canonicalId)
            throw new Error("Canonical identity differs from terminal source");
        seen.add(r.tokenId);
        for (const id of seen)
            validated.add(JSON.stringify([id, start.evaluationScope]));
    }
}
