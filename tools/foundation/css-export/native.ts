import postcss from 'postcss';
import type { CanonicalDesignModel, CanonicalToken } from '../capture/model.js';
import { verifyCSSContexts, type CSSStructureNode } from '../capture/css-context.js';
import type { CSSExportPlan, CSSPlanEntry, CSSPlanOptions } from './index.js';
import { parseCSSSources } from '../parse-css.js';
import { references } from '../capture/css-adapter.js';
const rootDark = /^(?::root|\.dark|html\.dark|:root\.dark|\[data-theme=["']dark["']\]|html\[data-theme=["']dark["']\]|:root\[data-theme=["']dark["']\])$/;
/** Preserve native syntax/context rather than claiming a scalar cascade winner. */
export function nativeCSSPlan(model: CanonicalDesignModel, options: CSSPlanOptions): CSSExportPlan {
    const supplied = model.cssDocuments ?? [];
    const contextValid = verifyCSSContexts(supplied, model);
    // Never walk or serialize unverified structural metadata, even for a blocked preview.
    const docs = contextValid ? supplied : [];
    const sourceDiagnostics = parseCSSSources(docs.map(d => ({ file: d.file, css: d.sourceText }))).diagnostics;
    const evidenceDiagnostics = [...model.diagnostics, ...sourceDiagnostics];
    const blockers: CSSExportPlan['blockers'] = evidenceDiagnostics.filter(d => ['CSS_IDENTITY_UNSUPPORTED', 'CSS_PARSE', 'ROOT_INVALID', 'INPUT_OUTSIDE_SCOPE', 'ENUMERATION_FAILED', 'SCOPE_LIMIT', 'SOURCE_REFUSED', 'NO_TOKENS'].includes(d.code)).map(d => ({ code: d.code, message: d.message }));
    if (!contextValid)
        blockers.push({ code: 'CONTEXT_EVIDENCE_INVALID', message: 'CSS structure differs from the hash-bound source snapshot.' });
    if (!docs.length)
        blockers.push({ code: 'CONTEXT_REQUIRED', message: 'Capture with cssContext:true before native-context export.' });
    const order = options.sourceOrder ?? (docs.length === 1 ? [docs[0].file] : []);
    if (order.length !== docs.length || new Set(order).size !== order.length || docs.some(d => !order.includes(d.file)))
        blockers.push({ code: 'SOURCE_ORDER_UNKNOWN', message: 'Provide exact sourceOrder for all captured CSS files; filenames do not prove load order.' });
    for (const d of docs)
        for (const u of d.unsupported)
            blockers.push({ code: u.code, message: `${d.file}:${u.line}: ${u.message}` });
    const slots = new Map<string, {
        selector: string;
        layers: string[];
        file: string;
    }>();
    const walk = (nodes: CSSStructureNode[], file: string, layers: string[]) => {
        for (const n of nodes) {
            if (n.kind === 'layer')
                walk(n.children, file, [...layers, n.name || `<anonymous:${n.id}>`]);
            if (n.kind === 'rule')
                for (const id of n.tokenIds) {
                    if (slots.has(id))
                        blockers.push({ code: 'DUPLICATE_SLOT', message: 'A declaration has multiple structural slots.' });
                    slots.set(id, { selector: n.selector, layers, file });
                }
        }
    };
    for (const d of docs)
        walk(d.nodes, d.file, []);
    const contexts = new Map(model.contexts.map(c => [c.id, c]));
    const registered = new Set<string>();
    // Existing parser marks both registered declarations and their dependent aliases.
    for (const d of sourceDiagnostics)
        if (d.code === 'REGISTERED_PROPERTY' && d.source) {
            for (const t of model.tokens)
                if (t.provenance.file === d.source.file && t.provenance.line === d.source.line && t.provenance.column === d.source.column)
                    registered.add(t.id);
        }
    const validDeclaration = (t: CanonicalToken) => {
        try {
            for (const raw of [t.provenance.rawDeclaration, `${t.identity.sourceName}:${t.value.raw};`]) {
                const ast = postcss.parse(`:root{${raw}}`, { map: false }), r = ast.nodes[0];
                if (ast.nodes.length !== 1 || r.type !== 'rule' || r.nodes.length !== 1)
                    return false;
                const d = r.nodes[0];
                if (d.type !== 'decl' || d.prop !== t.identity.sourceName || d.value !== t.value.raw || !!d.important !== t.provenance.important)
                    return false;
            }
            return true;
        }
        catch {
            return false;
        }
    };
    const entries = model.tokens.map<CSSPlanEntry>(t => {
        const e: CSSPlanEntry = { tokenId: t.id, identity: structuredClone(t.identity), type: structuredClone(t.type), name: t.identity.sourceName, value: t.value.raw, context: structuredClone(contexts.get(t.contextId)!), provenance: structuredClone(t.provenance), references: structuredClone(t.references), status: 'unsupported', reasons: [] };
        const no = (r: string) => { e.reasons.push(r); return e; };
        const slot = slots.get(t.id);
        if (!/^--[A-Za-z_][A-Za-z0-9_-]*$/.test(e.name) || e.name.includes('\\')) {
            if (e.name.includes('\\'))
                blockers.push({ code: 'ESCAPED_IDENTITY', message: 'Escaped names may overlap other families.' });
            return no('CSS_NAME: unsupported identity.');
        }
        if (!validDeclaration(t) || !t.provenance.file || t.provenance.line < 1 || t.provenance.column < 1 || !docs.some(d => d.file === t.provenance.file && d.sha256 === t.provenance.fileSha256))
            return no('PROVENANCE: structural document and declaration evidence disagree.');
        if (!slot || slot.file !== t.provenance.file || !rootDark.test(slot.selector) || e.context.source.kind !== 'css' || slot.selector !== e.context.source.selector || t.provenance.important || registered.has(t.id))
            return no('CONTEXT: unsupported selector/priority/registration or absent source slot.');
        // Preserve valid custom-property token streams without inferring their consuming CSS type.
        // Only simple aliases are supported; no derived/fallback/runtime evaluation or relocatable URLs.
        if (/^(?:initial|inherit|unset|revert|revert-layer)$/i.test(e.value.trim()) || /\b(?:url|env|attr|calc|color-mix|light-dark)\s*\(/i.test(e.value) || /[{};]/.test(e.value))
            return no('VALUE: CSS-wide, derived or relative-resource semantics outside native subset.');
        // Escapes/comments and alternate function spelling are deliberately outside this slice.
        // This conservative boundary prevents a function from evading reference/resource checks.
        if (e.value.includes('\\') || e.value.includes('/*') || /\bvar\s*\(/i.test(e.value) && !/^var\(/.test(e.value))
            return no('LEXICAL: escaped/commented or alternate var spelling requires unsupported tokenization.');
        const refs = references(e.value);
        if (JSON.stringify(refs) !== JSON.stringify(t.references))
            return no('REFERENCE: lexical and model references disagree.');
        if (refs.length && !/^var\(\s*--[A-Za-z_][A-Za-z0-9_-]*\s*\)$/.test(e.value))
            return no('ALIAS: only direct simple aliases; derived/fallback not evaluated.');
        e.status = 'exact-preservation';
        e.output = { selector: slot.selector };
        return e;
    });
    const byName = new Map<string, CSSPlanEntry[]>();
    for (const e of entries)
        byName.set(e.name, [...(byName.get(e.name) ?? []), e]);
    // Eliminate acyclic names from leaves upward. Remaining names reach a cycle.
    // Iterative O(V+E) traversal avoids recursion/exponential work on branching alias families.
    const remaining = new Map<string, number>(), parents = new Map<string, Set<string>>();
    for (const [name, family] of byName) {
        const targets = new Set(family.flatMap(e => e.references.map(r => r.name)).filter(n => byName.has(n)));
        remaining.set(name, targets.size);
        for (const target of targets) {
            const set = parents.get(target) ?? new Set<string>();
            set.add(name);
            parents.set(target, set);
        }
    }
    const queue = [...remaining].filter(([, n]) => n === 0).map(([name]) => name);
    for (let i = 0; i < queue.length; i++)
        for (const parent of parents.get(queue[i]) ?? []) {
            const count = remaining.get(parent)! - 1;
            remaining.set(parent, count);
            if (count === 0)
                queue.push(parent);
        }
    const exclude = (e: CSSPlanEntry, reason: string) => { e.status = 'unsupported'; e.output = undefined; e.reasons.push(reason); };
    for (const e of entries)
        if (e.output && (e.references.some(r => !byName.has(r.name)) || remaining.get(e.name)! > 0))
            exclude(e, 'REFERENCE: missing or potentially cyclic alias family; no cascade evaluation.');
    let changed = true;
    while (changed) {
        changed = false;
        for (const e of entries.filter(e => e.output)) {
            if (byName.get(e.name)!.some(x => !x.output) || e.references.some(r => byName.get(r.name)?.some(x => !x.output))) {
                exclude(e, 'DEPENDENCY_CLOSURE: excluded override or dependency; keep original family.');
                changed = true;
            }
        }
    }
    const entryMap = new Map(entries.map(e => [e.tokenId, e]));
    const rules: CSSExportPlan['rules'] = [];
    const emit = (nodes: CSSStructureNode[]): string => nodes.map(n => {
        if (n.kind === 'layer-order')
            return `@layer ${n.names};`;
        if (n.kind === 'layer')
            return `@layer${n.name ? ' ' + n.name : ''} {\n${emit(n.children)}\n}`;
        const decls = n.tokenIds.map(id => entryMap.get(id)).filter((e): e is CSSPlanEntry => !!e?.output).map(e => ({ tokenId: e.tokenId, name: e.name, value: e.value }));
        if (!decls.length)
            return '';
        rules.push({ selector: n.selector, declarations: decls });
        return `${n.selector} {\n${decls.map(d => `  ${d.name}: ${d.value};`).join('\n')}\n}`;
    }).join('\n');
    const css = order.filter(file => docs.some(d => d.file === file)).map(file => emit(docs.find(d => d.file === file)!.nodes)).join('\n');
    const eligible = entries.filter(e => e.output).length;
    return { schemaVersion: '0.1', namespace: model.namespace, status: blockers.length || !eligible ? 'blocked' : eligible < entries.length ? 'partial' : 'ready', entries, rules, blockers, coverage: { captured: entries.length, eligible, excluded: entries.length - eligible, aliases: entries.filter(e => e.output && e.references.length).length, exact: eligible, transformed: 0, semanticMappings: 0 },
        nativeContext: { css, sourceOrder: order, orderEvidence: docs.length === 1 ? 'source-file-order' : 'caller-asserted-order', documents: structuredClone(docs), resolution: 'preserved-not-evaluated' },
        limits: ['Native context syntax preservation, NOT a new resolved/cascade winner or full application equivalence claim. Unknown token types remain unknown.',
            'Layer order statements and empty/anonymous/nested layer introductions are retained; ordinary rules, imports and utilities are not output. Partial CSS is not a whole stylesheet replacement.',
            'Integrate only in proven same stylesheet slots/order with identical retained ordinary/excluded CSS and DOM. Arbitrary additive placement can change behavior.',
            'Explicit multi-file sourceOrder is caller asserted, not discovered import/build order. Compiler directives/import-dependent layering require separate compiled input evidence.'] };
}
