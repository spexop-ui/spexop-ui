import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { captureDesignFoundation } from '../capture/index.js';
import { planCanonicalCSS, renderCanonicalCSS, writeCanonicalCSS } from '../css-export/index.js';
import { reviewFoundation } from '../integration/index.js';
import { runIntegrationCLI } from '../integration/cli.js';
const dirs: string[] = [];
function input(css: string) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spx-native-')); dirs.push(root); fs.writeFileSync(path.join(root, 'tokens.css'), css); return { projectRoot: root, cssContext: true, cssFiles: ['tokens.css'] }; }
afterEach(() => { for (const d of dirs.splice(0))
    fs.rmSync(d, { recursive: true, force: true }); });
const native = { preserveNativeContext: true };
it('keeps literal channel sequences unknown, root/dark and multi-step aliases unflattened', () => {
    const opts = input('@layer base{:root{--c:220 70% 50%;--b:var(--c);--a:var(--b)}.dark{--c:220 70% 30%}}');
    const m = captureDesignFoundation(opts), p = planCanonicalCSS(m, native), r = renderCanonicalCSS(p);
    expect(r.declarations).toBe(4);
    expect(p.coverage.aliases).toBe(2);
    expect(r.css).toContain('--a: var(--b)');
    expect(r.css).toContain('.dark');
    expect(m.tokens[0].type.status).not.toBe('known');
    const copy = JSON.parse(JSON.stringify(m));
    expect(renderCanonicalCSS(planCanonicalCSS(copy, native)).sha256).toBe(r.sha256);
});
it('explicit write preserves source and refuses existing output, traversal and symlink parent', () => {
    const opts = input('@layer base{:root{--x:220 70% 50%}}'), before = fs.readFileSync(path.join(opts.projectRoot, 'tokens.css'));
    const result = writeCanonicalCSS(opts, { ...native, outputDirectory: 'new' });
    expect(result.declarations).toBe(1);
    expect(() => writeCanonicalCSS(opts, { ...native, outputDirectory: 'new' })).toThrow();
    expect(() => writeCanonicalCSS(opts, { ...native, outputDirectory: '../outside' })).toThrow();
    fs.symlinkSync(os.tmpdir(), path.join(opts.projectRoot, 'link'));
    expect(() => writeCanonicalCSS(opts, { ...native, outputDirectory: 'link/new' })).toThrow();
    expect(fs.readFileSync(path.join(opts.projectRoot, 'tokens.css'))).toEqual(before);
});
it('native integration review offers no additive import as equivalence and CLI preview stays read only', () => {
    const opts = input('@layer base{:root{--c:220 70% 50%}}');
    const { review } = reviewFoundation(opts, native);
    expect(review.steps.join(' ')).toContain('same original slots');
    expect(review.steps.join(' ')).not.toContain('manually add one import');
    const out: string[] = [], err: string[] = [];
    expect(runIntegrationCLI([opts.projectRoot, '--native-context', '--preview'], { out: s => out.push(s), err: s => err.push(s) })).toBe(0);
    expect(out.join('')).toContain('@layer base');
    expect(err).toEqual([]);
    expect(fs.readdirSync(opts.projectRoot)).toEqual(['tokens.css']);
});
it('native context must be explicitly captured and cannot combine Tailwind materialization', () => {
    const opts = input(':root{--x:1px}');
    const m = captureDesignFoundation({ ...opts, cssContext: false });
    expect(planCanonicalCSS(m, native).status).toBe('blocked');
    expect(() => planCanonicalCSS(m, { ...native, themeLiterals: 'materialize' })).toThrow();
});
it.each(['@theme', '@theme inline', '@theme static'])('Tailwind %s is not a native layer', rule => {
    const m = captureDesignFoundation(input(`${rule}{--color-x:red}:root{--keep:1px}`));
    expect(planCanonicalCSS(m, native).status).toBe('blocked');
});
it('source type, context, raw declaration and hash tampering cannot manufacture exact preservation', () => {
    const m = captureDesignFoundation(input('@layer base{:root{--channel:220 70% 50%}}'));
    for (const mutate of [(c: typeof m) => { c.tokens[0].type = { status: 'known', type: 'color', evidence: 'explicit-source-type' }; }, (c: typeof m) => { c.contexts[0].axes.mode = 'dark'; }, (c: typeof m) => { c.cssDocuments![0].sha256 = '0'.repeat(64); }]) {
        const c = structuredClone(m);
        mutate(c);
        expect(() => renderCanonicalCSS(planCanonicalCSS(c, native), { allowPartial: true })).toThrow();
    }
});
