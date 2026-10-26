import { readSources } from "./sources.js";
import { modelFromCSS } from "./css-adapter.js";
import { parseCSSSources } from "../parse-css.js";
import type { CaptureOptions, CaptureResult, CaptureDiagnostic } from "./types.js";
export type * from "./types.js";
export type * from "./model.js";
export { assertModel } from "./model.js";
/** Synchronous read-only capture. Never evaluates project code or writes a file. */
export function captureDesignFoundation(options: CaptureOptions): CaptureResult {
    if (!options || typeof options.projectRoot !== "string" || !options.projectRoot.trim() ||
        Object.keys(options).some(k => !["projectRoot", "namespace", "cssFiles", "sourceCommit"].includes(k)) ||
        (options.cssFiles !== undefined && (!Array.isArray(options.cssFiles) || options.cssFiles.some(f => typeof f !== "string"))) ||
        (options.sourceCommit !== undefined && (typeof options.sourceCommit !== "string" || !/^[a-f0-9]{40,64}$/i.test(options.sourceCommit))))
        throw new TypeError("Invalid capture options; only read-only projectRoot, namespace, cssFiles and sourceCommit are accepted.");
    const namespace = options.namespace ?? "project";
    if (typeof namespace !== "string" || !namespace.trim())
        throw new TypeError("namespace must be nonempty");
    const input = readSources(options.projectRoot, options.cssFiles);
    const parsed = parseCSSSources(input.snapshots);
    const model = modelFromCSS(parsed, namespace, options.sourceCommit);
    const diagnostics: CaptureDiagnostic[] = [...input.diagnostics, ...parsed.diagnostics];
    for (const d of parsed.diagnostics)
        if (d.code === "CSS_PARSE") {
            const source = input.sources.find(s => s.file === d.source?.file);
            if (source) {
                source.status = "parse-error";
                source.reason = "CSS syntax error; no valid token model for this file.";
            }
        }
    const tokens = new Map(model.tokens.map(t => [t.id, t]));
    for (const r of model.resolutions)
        if (r.status !== "resolved") {
            const token = tokens.get(r.tokenId)!;
            diagnostics.push({ code: `REFERENCE_${r.status.toUpperCase()}`, severity: r.status === "missing" || r.status === "cycle" ? "error" : r.status === "ambiguous" ? "warning" : "unsupported",
                message: r.reason, token: token.identity.sourceName, tokenId: token.id, evaluationScope: r.evaluationScope,
                source: { file: token.provenance.file, line: token.provenance.line, column: token.provenance.column },
                fix: r.status === "missing" || r.status === "cycle" ? "Repair the source reference; capture never inserts fallback values." : "Inspect preserved source/context; no cascade winner or computed value is assumed." });
        }
    for (const token of model.tokens)
        if (token.type.status !== "known")
            diagnostics.push({
                code: "TYPE_UNCONFIRMED", severity: "info", message: token.type.reason,
                token: token.identity.sourceName, tokenId: token.id,
                source: { file: token.provenance.file, line: token.provenance.line, column: token.provenance.column },
                fix: "Keep the original expression; capture does not guess type or UI role from its name.",
            });
    const types = { known: 0, ambiguous: 0, unsupported: 0 };
    for (const t of model.tokens)
        types[t.type.status]++;
    const resolutions: CaptureResult["coverage"]["resolutions"] = { resolved: 0, ambiguous: 0, missing: 0, cycle: 0, derived: 0, unsupported: 0 };
    for (const r of model.resolutions)
        resolutions[r.status]++;
    const errors = diagnostics.some(d => d.severity === "error");
    return { ...model, sources: input.sources, diagnostics, references: model.tokens.flatMap(t => t.references.map(r => ({ tokenId: t.id, ...r }))),
        ok: !errors && model.tokens.length > 0,
        coverage: { status: errors ? "error" : !model.tokens.length ? "empty" : diagnostics.some(d => d.severity !== "info") || types.ambiguous + types.unsupported > 0 ? "partial" : "complete-within-capture-scope",
            inspectedFiles: input.snapshots.length, excludedOrRejectedSources: input.sources.filter(s => s.status === "excluded" || s.status === "rejected").length,
            sourceDeclarations: parsed.found.length, representedDeclarations: model.tokens.length, types, resolutions, mandatoryThemeMappings: 0, outputGeneration: "not-evaluated" },
        limits: [...model.limits,
            "Only CSS files are inspected; JS/TSX/config, package imports, dynamic styles and all exporters are not evaluated.",
            "namespace defaults to project. IDs are snapshot-local. sourceCommit is caller asserted, not verified by executing Git.",
            "Root ancestor aliases are canonicalized; links inside the root, hardlinks and nonregular files are refused. Hidden/generated/dependency directories are excluded.",
            "Bounds: 200 CSS files, 1 MiB each, 10000 entries, 64 directory levels. Stable local filesystem required; not a sandbox against hostile concurrent directory replacement.",
            "ok means source capture has no errors, not complete typing, exporter readiness, intended UI semantics or M3 user acceptance."] };
}
