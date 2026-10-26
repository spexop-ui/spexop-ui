import postcss, { type ChildNode, type Container } from 'postcss';
import type { CanonicalToken, CanonicalDesignModel } from './model.js';
import { modelFromCSS } from './css-adapter.js';
import { parseCSSSources } from '../parse-css.js';
import type { CSSSnapshot } from '../parse-css.js';
import { createHash } from 'node:crypto';
export type CSSStructureNode = {
    kind: 'layer';
    id: string;
    name: string;
    children: CSSStructureNode[];
} | {
    kind: 'layer-order';
    id: string;
    names: string;
} | {
    kind: 'rule';
    id: string;
    selector: string;
    tokenIds: string[];
};
export interface CSSDocumentContext {
    file: string;
    sha256: string;
    sourceText: string;
    nodes: CSSStructureNode[];
    unsupported: Array<{
        code: string;
        line: number;
        message: string;
    }>;
    orderEvidence: 'source-file-order';
}
/** Capture structural slots, not a cascade evaluator. Optional; legacy capture output unchanged. */
export function captureCSSContexts(snapshots: readonly CSSSnapshot[], tokens: CanonicalToken[]): CSSDocumentContext[] {
    return snapshots.map(({ file, css }) => {
        const unsupported: CSSDocumentContext['unsupported'] = [];
        const id = (n: ChildNode) => `${file}:${n.source?.start?.offset ?? -1}`;
        const issue = (n: ChildNode, code: string, message: string) => unsupported.push({ code, line: n.source?.start?.line ?? 1, message });
        const root = postcss.parse(css, { from: file });
        root.walkAtRules(n => {
            const name = n.name.toLowerCase();
            if (['import', 'tailwind', 'apply', 'theme', 'reference', 'config', 'plugin', 'utility', 'variant', 'custom-variant', 'source'].includes(name))
                issue(n, 'NON_NATIVE_OR_IMPORT', 'Compiler/import semantics require a separately evidenced compiled input; not native CSS layer evidence.');
            if (name === 'layer') {
                let a = n.parent;
                while (a && a.type !== 'root') {
                    if (a.type !== 'atrule' || a.name.toLowerCase() !== 'layer') {
                        issue(n, 'LAYER_CONTEXT', 'Layer introduction within unsupported conditional/rule context.');
                        break;
                    }
                    a = a.parent;
                }
            }
        });
        const walk = (parent: Container): CSSStructureNode[] => {
            const nodes: CSSStructureNode[] = [];
            for (const n of parent.nodes ?? []) {
                if (n.type === 'atrule' && n.name.toLowerCase() === 'layer') {
                    const name = n.params.trim(), ident = '[A-Za-z_][A-Za-z0-9_-]*(?:\\.[A-Za-z_][A-Za-z0-9_-]*)*';
                    if (n.nodes ? (name !== '' && !new RegExp(`^${ident}$`).test(name)) : !new RegExp(`^${ident}(?:\\s*,\\s*${ident})*$`).test(name)) {
                        issue(n, 'LAYER_NAME', 'Layer name/order syntax is outside the unescaped native subset.');
                        continue;
                    }
                    if (n.nodes)
                        nodes.push({ kind: 'layer', id: id(n), name, children: walk(n) });
                    else
                        nodes.push({ kind: 'layer-order', id: id(n), names: name });
                }
                else if (n.type === 'rule') {
                    // Nested selectors are not flattened. Their tokens remain in the model but have no supported slot.
                    const ids = (n.nodes ?? []).filter(d => d.type === 'decl' && d.prop.startsWith('--')).map(d => tokens.find(t => t.provenance.file === file && t.provenance.line === d.source?.start?.line && t.provenance.column === d.source?.start?.column)?.id).filter((x): x is string => !!x);
                    if (ids.length)
                        nodes.push({ kind: 'rule', id: id(n), selector: n.selector, tokenIds: ids });
                }
            }
            return nodes;
        };
        return { file, sourceText: css, sha256: createHash('sha256').update(css).digest('hex'), nodes: walk(root), unsupported, orderEvidence: 'source-file-order' };
    });
}
/** Rebuild structural evidence from bounded, hash-bound CSS. Serialized models remain usable. */
export function verifyCSSContexts(docs: readonly CSSDocumentContext[], model: CanonicalDesignModel): boolean {
    try {
        const tokens = model.tokens;
        if (docs.length > 200 || new Set(docs.map(d => d.file)).size !== docs.length)
            return false;
        for (const d of docs) {
            if (typeof d.sourceText !== 'string' || Buffer.byteLength(d.sourceText) > 1024 * 1024 || createHash('sha256').update(d.sourceText).digest('hex') !== d.sha256)
                return false;
            const local = tokens.filter(t => t.provenance.file === d.file);
            const declarations = new Map<string, postcss.Declaration>();
            postcss.parse(d.sourceText).walkDecls(n => { declarations.set(`${n.source?.start?.line}:${n.source?.start?.column}`, n); });
            for (const t of local) {
                const n = declarations.get(`${t.provenance.line}:${t.provenance.column}`);
                if (!n || n.prop !== t.identity.sourceName || n.value !== t.value.raw || n.source!.input.css.slice(n.source?.start?.offset, n.source?.end?.offset ?? -1) !== t.provenance.rawDeclaration || !!n.important !== t.provenance.important || t.provenance.fileSha256 !== d.sha256)
                    return false;
            }
        }
        const snapshots = docs.map(d => ({ file: d.file, css: d.sourceText }));
        const reconstructed = modelFromCSS(parseCSSSources(snapshots), model.namespace);
        const withoutCommit = (list: CanonicalToken[]) => list.map(t => ({ ...t, provenance: { ...t.provenance, commit: undefined } }));
        if (JSON.stringify(withoutCommit(reconstructed.tokens)) !== JSON.stringify(withoutCommit(tokens)) || JSON.stringify(reconstructed.contexts) !== JSON.stringify(model.contexts))
            return false;
        const expected = captureCSSContexts(docs.map(d => ({ file: d.file, css: d.sourceText })), tokens);
        return JSON.stringify(expected) === JSON.stringify(docs);
    }
    catch {
        return false;
    }
}
