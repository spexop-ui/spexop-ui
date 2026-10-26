import type { CanonicalDesignModel, Reference } from "./model.js";
import type { Diagnostic } from "../source-types.js";
export interface CaptureOptions {
    /** Explicit native-context metadata capture; default snapshot contract unchanged. */
    cssContext?: boolean;
    projectRoot: string;
    namespace?: string;
    cssFiles?: readonly string[];
    /** Caller assertion, not verified Git ancestry. File hashes are observed directly. */
    sourceCommit?: string;
}
export interface CapturedSource {
    file: string;
    status: "inspected" | "parse-error" | "excluded" | "rejected";
    sha256?: string;
    bytes?: number;
    reason?: string;
}
export interface CaptureDiagnostic extends Diagnostic {
    tokenId?: string;
    evaluationScope?: string;
}
export interface CaptureResult extends CanonicalDesignModel {
    ok: boolean;
    sources: CapturedSource[];
    references: Array<Reference & {
        tokenId: string;
    }>;
    diagnostics: CaptureDiagnostic[];
    coverage: {
        status: "complete-within-capture-scope" | "partial" | "empty" | "error";
        inspectedFiles: number;
        excludedOrRejectedSources: number;
        sourceDeclarations: number;
        representedDeclarations: number;
        types: {
            known: number;
            ambiguous: number;
            unsupported: number;
        };
        resolutions: Record<CanonicalDesignModel["resolutions"][number]["status"], number>;
        mandatoryThemeMappings: 0;
        outputGeneration: "not-evaluated";
    };
}
