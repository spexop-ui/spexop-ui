import { createHash } from 'node:crypto';
import postcss from 'postcss';
import type { CaptureResult } from '../capture/index.js';
import { verifyCSSContexts } from '../capture/css-context.js';
import { planCanonicalCSS } from '../css-export/index.js';
import { inspectViteManifest } from './vite.js';

export type Certainty = 'proven' | 'partial' | 'unknown' | 'unsupported';
export interface MapEvidence {
  artifact: string;
  text: string;
  /** Snapshot binding, NOT an authenticated compiler receipt. */
  artifactSha256: string;
  mapSha256: string;
  /** Exact map sources identifiers -> captured file paths. No filename guessing. */
  sources: Record<string, string>;
}
export interface StylesheetObservation {
  documentURL: string;
  observedAt: string;
  collector: string;
  state: string;
  completeDocumentInventory: boolean;
  dynamicChangesObserved: boolean;
  shadowRootsObserved: boolean;
  slots: Array<{
    id: string; order: number; root: string;
    kind: 'link' | 'style' | 'adopted';
    url: string | null; media: string; disabled: boolean; alternate: boolean;
    /** Actual response/stylesheet text, never a local-file hash substituted for observation. */
    cssText?: string;
  }>;
}
export interface BuildContextInput {
  source: CaptureResult;
  compiled: CaptureResult;
  compiler: { name: string; version?: string; evidence: string };
  maps?: readonly MapEvidence[];
  manifest?: string;
  observation?: StylesheetObservation;
}
export const cssArtifactHash = (text: string): string => createHash('sha256').update(text).digest('hex');
type Diagnostic = { code: string; message: string; artifact?: string };
function requireCapture(c: CaptureResult): void {
  if (!c.cssDocuments || !verifyCSSContexts(c.cssDocuments, c)) throw new TypeError('Verified cssContext capture required');
  if (c.cssDocuments.length > 200) throw new TypeError('Too many CSS documents');
}

/** Pure evidence inspection. Caller assertions never become authenticated build history. */
export function inspectBuildContext(input: BuildContextInput) {
  requireCapture(input.source); requireCapture(input.compiled);
  const diagnostics: Diagnostic[] = [];
  const artifactDocs = input.compiled.cssDocuments!;
  const artifacts = artifactDocs.map(d => ({ file: d.file, sha256: d.sha256,
    certainty: 'proven' as const, claim: 'captured-byte-identity' as const,
    tokenIds: input.compiled.tokens.filter(t => t.provenance.file === d.file).map(t => t.id),
    structure: structuredClone(d.nodes), unsupported: structuredClone(d.unsupported) }));
  const links: Array<{ sourceTokenId: string; compiledTokenId: string; artifact: string;
    mapSha256: string; certainty: 'partial'; evidence: 'exact-declaration-start-with-source-content';
    valueUnchanged: boolean }> = [];
  const maps = input.maps ?? [];
  if (maps.length > 200) throw new TypeError('Too many source maps');
  for (const artifact of artifacts) {
    const candidates = maps.filter(m => m.artifact === artifact.file);
    if (candidates.length !== 1) {
      diagnostics.push({ code: candidates.length ? 'MAP_AMBIGUOUS' : 'MAP_MISSING', artifact: artifact.file,
        message: 'Source-to-bundle provenance unknown; exactly one explicitly bound map required.' }); continue;
    }
    const map = candidates[0], doc = artifactDocs.find(d => d.file === artifact.file)!;
    try {
      if (map.text.length > 2 * 1024 * 1024 || map.artifactSha256 !== artifact.sha256 || cssArtifactHash(map.text) !== map.mapSha256)
        throw new Error('Map/bundle snapshot hash mismatch');
      const raw = JSON.parse(map.text);
      if (raw.version !== 3 || raw.sections || raw.sourceRoot || !Array.isArray(raw.sources) || !Array.isArray(raw.sourcesContent) ||
          raw.sources.length !== raw.sourcesContent.length || raw.sources.length > 200 || typeof raw.mappings !== 'string' ||
          raw.sources.some((s: unknown) => typeof s !== 'string') || new Set(raw.sources).size !== raw.sources.length)
        throw new Error('Only bounded flat maps with embedded source contents and no sourceRoot are supported');
      // Explicit prev prevents PostCSS from reading a sourceMappingURL from the filesystem.
      const parsed = postcss.parse(doc.sourceText, { from: artifact.file, map: { prev: map.text } });
      const consumer = parsed.source!.input.map!.consumer();
      const exact = new Map<string, Array<{ source: string; line: number; column: number }>>();
      let count = 0;
      consumer.eachMapping(m => {
        if (++count > 100000) throw new Error('Map segment limit');
        if (m.source === null || m.originalLine === null || m.originalColumn === null) return;
        const key = `${m.generatedLine}:${m.generatedColumn}`;
        const list = exact.get(key) ?? [];
        list.push({ source: m.source, line: m.originalLine, column: m.originalColumn }); exact.set(key, list);
      });
      const pending: typeof links = [];
      for (const token of input.compiled.tokens.filter(t => t.provenance.file === artifact.file)) {
        const segments = exact.get(`${token.provenance.line}:${token.provenance.column - 1}`) ?? [];
        if (segments.length !== 1) continue;
        const segment = segments[0], ix = raw.sources.indexOf(segment.source);
        const file = Object.hasOwn(map.sources, segment.source) ? map.sources[segment.source] : undefined;
        const sourceDoc = input.source.cssDocuments!.find(d => d.file === file);
        if (ix < 0 || !sourceDoc || raw.sourcesContent[ix] !== sourceDoc.sourceText) continue;
        const sourceTokens = input.source.tokens.filter(t => t.provenance.file === file &&
          t.provenance.line === segment.line && t.provenance.column === segment.column + 1 &&
          t.identity.sourceName === token.identity.sourceName);
        if (sourceTokens.length !== 1) continue;
        pending.push({ sourceTokenId: sourceTokens[0].id, compiledTokenId: token.id, artifact: artifact.file,
          mapSha256: map.mapSha256, certainty: 'partial', evidence: 'exact-declaration-start-with-source-content',
          valueUnchanged: sourceTokens[0].value.raw === token.value.raw });
      }
      links.push(...pending);
      if (pending.length !== artifact.tokenIds.length) diagnostics.push({ code: 'MAP_PARTIAL', artifact: artifact.file,
        message: 'Unmapped/changed-source/ambiguous declaration starts remain unknown; no approximate mapping.' });
    } catch {
      diagnostics.push({ code: 'MAP_REFUSED', artifact: artifact.file, message: 'Invalid, stale, mismatched or unsupported map; no provenance asserted.' });
    }
  }
  for (const m of maps) if (!artifacts.some(a => a.file === m.artifact)) diagnostics.push({ code: 'MAP_ORPHAN', artifact: m.artifact, message: 'Map has no captured artifact.' });
  const compilerSupported = input.compiler.name === 'vite';
  if (!compilerSupported) diagnostics.push({ code: 'COMPILER_UNSUPPORTED', message: 'Compiler adapter unsupported; artifact facts remain available.' });
  const manifest = compilerSupported && input.manifest !== undefined ? inspectViteManifest(input.manifest) : undefined;
  const observation = input.observation;
  const slots = (observation?.slots ?? []).map(s => ({ ...s, cssText: undefined,
    byteSha256: s.cssText === undefined ? null : cssArtifactHash(s.cssText),
    artifactFiles: s.cssText === undefined ? [] : artifacts.filter(a => a.sha256 === cssArtifactHash(s.cssText!)).map(a => a.file),
    certainty: 'partial' as Certainty, evidence: 'caller-supplied-browser-snapshot' as const }));
  const eligibleObservation = !!observation && typeof observation.documentURL === 'string' && !!observation.documentURL &&
    Number.isFinite(Date.parse(observation.observedAt)) && !!observation.collector && !!observation.state &&
    observation.completeDocumentInventory === true && observation.dynamicChangesObserved === false && observation.shadowRootsObserved === false &&
    slots.length > 0 && slots.length <= 200 && new Set(slots.map(s => s.id)).size === slots.length &&
    slots.every((s, i) => s.id && s.order === i && s.root === 'document' && s.kind === 'link' && typeof s.url === 'string' && s.url &&
      s.disabled === false && s.alternate === false && (s.media === '' || s.media === 'all') && s.artifactFiles.length === 1) &&
    new Set(slots.flatMap(s => s.artifactFiles)).size === artifacts.length && slots.length === artifacts.length;
  if (!eligibleObservation) diagnostics.push({ code: 'LOAD_CONTEXT_INCOMPLETE', message: 'No complete supported document snapshot; never infer order from paths or manifest. Repeated, conditional, inline, adopted and shadow slots require separate review.' });
  const sourceOrder = eligibleObservation ? slots.map(s => s.artifactFiles[0]) : null;
  return { schemaVersion: '0.1' as const, compiler: { ...input.compiler, certainty: compilerSupported ? 'partial' as const : 'unsupported' as const },
    artifacts, manifest, links, compiledTokens: structuredClone(input.compiled.tokens), contexts: structuredClone(input.compiled.contexts),
    references: structuredClone(input.compiled.tokens.flatMap(t => t.references.map(r => ({ tokenId: t.id, ...r })))), slots, observation: observation ? {
      documentURL: observation.documentURL, observedAt: observation.observedAt, collector: observation.collector, state: observation.state,
      completeDocumentInventory: observation.completeDocumentInventory, dynamicChangesObserved: observation.dynamicChangesObserved,
      shadowRootsObserved: observation.shadowRootsObserved, trust: 'caller-supplied-not-authenticated' as const } : null,
    sourceOrder, diagnostics,
    coverage: { sourceTokens: input.source.tokens.length, compiledTokens: input.compiled.tokens.length, positionalLinks: links.length,
      unmappedCompiledTokens: input.compiled.tokens.length - links.length, provenSourceBuildRelations: 0 },
    placementSafety: 'not-proven' as const, behavioralEquivalence: 'not-proven' as const,
    limits: ['Hash identity is not build history. Map links are positional, not semantic equivalence.',
      'Browser snapshot is caller evidence at one state/time; no trust or future stability is implied.',
      'No build/config/JS execution, URL fetch, filesystem writes, cascade evaluation or source replacement.',
      'No indexed maps, sourceRoot, approximate segments, transformed names, dynamic/shadow/adopted/conditional load planning.'] };
}

/** Existing exporter; order comes only from the checked supplied browser snapshot. */
export function planBuildCSS(input: BuildContextInput) {
  const context = inspectBuildContext(input);
  const plan = context.sourceOrder ? planCanonicalCSS(input.compiled, { preserveNativeContext: true, sourceOrder: context.sourceOrder }) : null;
  return { context, plan, placementSafety: 'not-proven' as const, behavioralEquivalence: 'not-proven' as const };
}
