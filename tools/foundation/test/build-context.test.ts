import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postcss from 'postcss';
import { captureDesignFoundation } from '../capture/index.js';
import { cssArtifactHash as hash, inspectBuildContext, planBuildCSS, type BuildContextInput, type StylesheetObservation } from '../build-context/index.js';
import { inspectViteManifest } from '../build-context/vite.js';

function capture(css: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-context-'));
  try {
    for (const [file, text] of Object.entries(css)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
    return captureDesignFoundation({ projectRoot: root, cssFiles: Object.keys(css), cssContext: true });
  } finally { fs.rmSync(root, { recursive: true }); }
}
const css = '@layer base { :root { --primary: 220 70% 50%; --alias: var(--primary); } .dark { --primary: 20 70% 30%; } }';
function input(files: Record<string, string> = { 'bundle.css': css }): BuildContextInput {
  return { source: capture({ 'source.css': css }), compiled: capture(files), compiler: { name: 'vite', evidence: 'reviewed configuration; not an authenticated receipt' } };
}
function observe(files: Record<string, string> = { 'bundle.css': css }): StylesheetObservation {
  return { documentURL: 'http://localhost/app', observedAt: '2026-10-26T00:00:00Z', collector: 'test fixture', state: 'light',
    completeDocumentInventory: true, dynamicChangesObserved: false, shadowRootsObserved: false,
    slots: Object.entries(files).map(([file, text], i) => ({ id: `slot-${i}`, order: i, root: 'document', kind: 'link', url: `http://localhost/${file}`,
      media: '', disabled: false, alternate: false, cssText: text })) };
}
function mappedInput() {
  const i = input();
  const result = postcss([{ postcssPlugin: "mapping-fixture", Once() { /* Force declaration mapping by the real compiler. */ } }]).process(css, { from: 'source.css', to: 'bundle.css', map: { inline: false, annotation: false, sourcesContent: true } });
  const text = result.map!.toString();
  i.compiled = capture({ 'bundle.css': result.css });
  i.maps = [{ artifact: 'bundle.css', text, artifactSha256: hash(result.css), mapSha256: hash(text), sources: { 'source.css': 'source.css' } }];
  return i;
}
describe('build/load evidence boundaries', () => {
  it('never follows an implicit sourceMappingURL outside the capture root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-sidecar-'));
    const file = path.join(root, 'sidecar.map');
    fs.writeFileSync(file, JSON.stringify({ version: 3, sources: ['source.css'], sourcesContent: [css], names: [], mappings: 'AAAA' }));
    const spy = vi.spyOn(fs, 'readFileSync');
    try {
      const i = input({ 'bundle.css': css + `\n/*# sourceMappingURL=${file} */` });
      i.observation = observe({ 'bundle.css': css + `\n/*# sourceMappingURL=${file} */` });
      planBuildCSS(i);
      expect(spy.mock.calls.filter(c => String(c[0]) === file)).toHaveLength(0);
    } finally { spy.mockRestore(); fs.rmSync(root, { recursive: true }); }
  });
  it('preserves all compiled identities, contexts and references without semantic mapping', () => {
    const i = input(), before = JSON.stringify(i), r = inspectBuildContext(i);
    expect(r.compiledTokens).toEqual(i.compiled.tokens); expect(r.references).toEqual(i.compiled.references);
    expect(r.contexts).toEqual(i.compiled.contexts); expect(JSON.stringify(i)).toBe(before);
    expect(r.coverage.provenSourceBuildRelations).toBe(0); expect(r.diagnostics.some(d => d.code === 'MAP_MISSING')).toBe(true);
  });
  it('uses exact source-map positions and source contents only as partial evidence', () => {
    const r = inspectBuildContext(mappedInput());
    expect(r.links).toHaveLength(3); expect(r.links.every(l => l.certainty === 'partial')).toBe(true);
    expect(r.placementSafety).toBe('not-proven'); expect(r.behavioralEquivalence).toBe('not-proven');
  });
  it.each(['bundle', 'map', 'source', 'position', 'binding', 'indexed', 'sourceRoot'])('refuses stale or unsupported %s evidence', kind => {
    const i = mappedInput(), m = i.maps![0];
    if (kind === 'bundle') m.artifactSha256 = '0'.repeat(64);
    if (kind === 'map') m.mapSha256 = '0'.repeat(64);
    if (kind === 'source') i.source = capture({ 'source.css': css.replace('220', '221') });
    if (kind === 'binding') m.sources = { 'source.css': 'unrelated.css' };
    if (kind === 'position') { const raw = JSON.parse(m.text); raw.mappings = 'AAAA'; m.text = JSON.stringify(raw); m.mapSha256 = hash(m.text); }
    if (kind === 'indexed' || kind === 'sourceRoot') { const raw = JSON.parse(m.text); raw[kind === 'indexed' ? 'sections' : 'sourceRoot'] = kind === 'indexed' ? [] : 'remote/'; m.text = JSON.stringify(raw); m.mapSha256 = hash(m.text); }
    expect(inspectBuildContext(i).links).toHaveLength(0);
  });
  it('retains distinct same-name declarations and refuses duplicate map candidates', () => {
    const i = mappedInput(); i.maps = [i.maps![0], i.maps![0]];
    const r = inspectBuildContext(i); expect(r.links).toHaveLength(0);
    expect(r.compiledTokens.filter(t => t.identity.sourceName === '--primary')).toHaveLength(2);
  });
  it('does not infer load order from filenames or manifest', () => {
    const i = input(); i.manifest = JSON.stringify({ 'index.html': { file: 'main.js', css: ['bundle.css'], isEntry: true } });
    const r = planBuildCSS(i); expect(r.plan).toBeNull(); expect(r.context.manifest?.loadOrder).toBe('unknown');
  });
  it('plans compiled CSS in supplied observed order, without claiming safe replacement', () => {
    const i = input(); i.observation = observe(); const r = planBuildCSS(i);
    expect(r.context.sourceOrder).toEqual(['bundle.css']); expect(r.plan?.coverage.eligible).toBe(3);
    expect(r.placementSafety).toBe('not-proven'); expect(r.context.observation?.trust).toBe('caller-supplied-not-authenticated');
  });
  it('retains reverse multi-bundle order rather than sorting by file name', () => {
    const files = { 'z.css': ':root { --x: 1px }', 'a.css': ':root { --x: 2px }' }, i = input(files);
    i.observation = observe(files); expect(planBuildCSS(i).context.sourceOrder).toEqual(['z.css', 'a.css']);
    i.observation.slots.reverse().forEach((s, order) => { s.order = order; });
    expect(planBuildCSS(i).context.sourceOrder).toEqual(['a.css', 'z.css']);
  });
  it.each(['media', 'disabled', 'alternate', 'style', 'adopted', 'shadow', 'dynamic', 'incomplete', 'missing-bytes', 'changed-bytes', 'duplicate', 'wrong-order', 'timestamp'])('blocks unsupported/incomplete %s load context', kind => {
    const i = input(), o = observe(); i.observation = o;
    if (kind === 'media') o.slots[0].media = '(width > 500px)';
    if (kind === 'disabled') o.slots[0].disabled = true;
    if (kind === 'alternate') o.slots[0].alternate = true;
    if (kind === 'style') o.slots[0].kind = 'style';
    if (kind === 'adopted') o.slots[0].kind = 'adopted';
    if (kind === 'shadow') { o.shadowRootsObserved = true; o.slots[0].root = 'shadow:one'; }
    if (kind === 'dynamic') o.dynamicChangesObserved = true;
    if (kind === 'incomplete') o.completeDocumentInventory = false;
    if (kind === 'missing-bytes') delete o.slots[0].cssText;
    if (kind === 'changed-bytes') o.slots[0].cssText += '/* changed */';
    if (kind === 'duplicate') o.slots.push({ ...o.slots[0], id: 'second', order: 1 });
    if (kind === 'wrong-order') o.slots[0].order = 10;
    if (kind === 'timestamp') o.observedAt = '';
    const r = planBuildCSS(i); expect(r.plan).toBeNull(); expect(r.context.slots).toHaveLength(o.slots.length);
  });
  it('does not turn supports/media/import restrictions into a successful exporter', () => {
    const files = { 'bundle.css': '@supports (display:grid) { :root { --x: 1px } }' }, i = input(files);
    i.observation = observe(files); const r = planBuildCSS(i); expect(r.plan?.status).toBe('blocked');
  });
  it('detects changed layer bytes and forged captured source', () => {
    const i = input(); i.observation = observe({ 'bundle.css': css.replace('@layer base', '@layer utilities') });
    expect(planBuildCSS(i).plan).toBeNull(); i.compiled.cssDocuments![0].sourceText += 'x';
    expect(() => inspectBuildContext(i)).toThrow();
  });
  it('keeps unknown compilers unsupported', () => { const i = input(); i.compiler.name = 'unknown'; expect(inspectBuildContext(i).compiler.certainty).toBe('unsupported'); });
  it('has deterministic read-only output', () => { const i = mappedInput(); expect(JSON.stringify(inspectBuildContext(i))).toBe(JSON.stringify(inspectBuildContext(i))); });
  it('derives reference summary only from verified token relationships', () => {
    const i = input(), expected = structuredClone(i.compiled.references);
    i.compiled.references = [{ tokenId: 'nonexistent', name: '--ghost', kind: 'direct' } as unknown as typeof i.compiled.references[number]];
    expect(inspectBuildContext(i).references).toEqual(expected);
  });
});
describe('Vite data-only manifest', () => {
  it('preserves imports/dynamic imports but never infers active browser order', () => {
    const r = inspectViteManifest(JSON.stringify({ 'index.html': { file: 'entry.js', css: ['z.css'], imports: ['shared'], dynamicImports: ['lazy'], isEntry: true }, shared: { file: 'shared.js', css: ['a.css'] }, lazy: { file: 'lazy.js', css: ['lazy.css'] } }));
    expect(r.certainty).toBe('partial'); expect(r.loadOrder).toBe('unknown'); expect(r.chunks).toHaveLength(3);
  });
  it.each(['not-json', '[]', '{"entry":{"file":"../outside.js"}}', '{"entry":{"file":"x.js","imports":["missing"]}}'])('rejects invalid manifest %s', text => { expect(inspectViteManifest(text).certainty).toBe('unsupported'); });
});
