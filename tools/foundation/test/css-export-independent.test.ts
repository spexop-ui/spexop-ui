import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import postcss from 'postcss';
import { compile } from 'tailwindcss';
import { captureDesignFoundation } from '../capture/index.js';
import { planCanonicalCSS, renderCanonicalCSS, writeCanonicalCSS } from '../css-export/index.js';

const roots: string[] = [];
function root(css: string) {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'spx-css-independent-'));
  roots.push(p); fs.writeFileSync(path.join(p, 'source.css'), css); return p;
}
function capture(css: string) { return captureDesignFoundation({ projectRoot: root(css) }); }
afterEach(() => { vi.restoreAllMocks(); for (const p of roots.splice(0)) fs.rmSync(p, { recursive: true, force: true }); });

it('independent: preserves a root alias definition instead of flattening or rebinding it to dark', () => {
  const m = capture(':root{--brand:red;--link:var(--brand)}.dark{--brand:blue}');
  const p = planCanonicalCSS(m), css = renderCanonicalCSS(p).css;
  expect(p.status).toBe('ready');
  expect(css).toContain('--link: var(--brand);');
  const ast = postcss.parse(css), linkSelectors: string[] = [];
  ast.walkDecls('--link', d => { if (d.parent?.type === 'rule') linkSelectors.push(d.parent.selector); });
  expect(linkSelectors).toEqual([':root']);
});

it('independent: does not invent shared CSS semantics for inline or ordinary theme aliases', () => {
  for (const theme of ['@theme', '@theme inline', '@theme static']) {
    const p = planCanonicalCSS(capture(`:root{--brand:red}${theme}{--color-brand:var(--brand)}`), { themeLiterals: 'materialize' });
    expect(p.entries.find(e => e.name === '--color-brand')?.status).toBe('unsupported');
    expect(renderCanonicalCSS(p, { allowPartial: true }).css).not.toContain('--color-brand:');
  }
});

it('independent: requires complete shared-theme resolution evidence before transformation', () => {
  const m = capture('@theme{--color-brand:red}');
  m.resolutions = m.resolutions.filter(r => r.evaluationScope !== 'dark');
  const p = planCanonicalCSS(m, { themeLiterals: 'materialize' });
  expect(p.status).toBe('blocked');
});

it('independent: rejects forged resolved aliases whose only target belongs to a different mode', () => {
  const m = capture(':root{--link:var(--brand)}.dark{--brand:red}');
  const [link, brand] = m.tokens;
  m.resolutions = [
    { tokenId: link.id, evaluationScope: 'light', status: 'resolved', targetIds: [brand.id], canonicalId: brand.id, reason: 'forged' },
    { tokenId: brand.id, evaluationScope: 'light', status: 'resolved', targetIds: [], canonicalId: brand.id, reason: 'forged' },
    { tokenId: brand.id, evaluationScope: 'dark', status: 'resolved', targetIds: [], canonicalId: brand.id, reason: 'source' },
  ];
  const p = planCanonicalCSS(m);
  expect(p.entries.find(e => e.name === '--link')?.status).toBe('unsupported');
  expect(p.status).not.toBe('ready');
});

it('independent: missing resolution is excluded rather than assumed resolved', () => {
  const m = capture(':root{--card:red;--keep:1rem}');
  m.resolutions = m.resolutions.filter(r => r.tokenId !== m.tokens[0].id);
  const p = planCanonicalCSS(m);
  expect(p.entries[0].status).toBe('unsupported');
  expect(p.status).toBe('partial');
});

it('independent: rejects inconsistent source type, raw reference and incomplete location evidence', () => {
  const m = capture(':root{--card:red;--link:var(--card);--spacing:1rem}');
  if (m.tokens[0].value.kind === 'literal' && m.tokens[0].value.literal.type === 'color') m.tokens[0].value.literal.components = [0, 0, 0];
  m.tokens[1].references[0].raw = 'var(--other)';
  m.tokens[2].provenance.column = 0;
  expect(planCanonicalCSS(m).status).toBe('blocked');
});

it('independent: an excluded contextual override closes the whole alias chain', () => {
  const p = planCanonicalCSS(capture(':root{--base:red;--link:var(--base);--chain:var(--link);--keep:1px}.brand{--base:blue}'));
  expect(p.entries.filter(e => e.status !== 'unsupported').map(e => e.name)).toEqual(['--keep']);
  expect(renderCanonicalCSS(p, { allowPartial: true }).declarations).toBe(1);
});

it('independent: rejects selector poisoning and a declaration that injects another rule', () => {
  const m = capture(':root{--card:red;--keep:1rem}');
  const c = m.contexts.find(c => c.id === m.tokens[0].contextId)!;
  if (c.source.kind === 'css') c.source.selector = ':root, body';
  m.tokens[1].value.raw = '1rem; } body { --injected: red';
  m.tokens[1].provenance.rawDeclaration = '--keep: 1rem; } body { --injected: red';
  expect(planCanonicalCSS(m).status).toBe('blocked');
});

it('independent: unparsed values and CSS-wide registrations remain visible exclusions', () => {
  const m = capture('@property --registered { syntax:"<color>";inherits:false;initial-value:red }:root{--registered:blue;--unknown:banana;--inherit:inherit;--keep:2rem}');
  const p = planCanonicalCSS(m);
  expect(p.entries).toHaveLength(4);
  expect(p.entries.filter(e => e.status !== 'unsupported').map(e => e.name)).toEqual(['--keep']);
  expect(p.coverage.excluded).toBe(3);
});

it('independent: materialized namespace collisions do not silently choose a winner', () => {
  const p = planCanonicalCSS(capture('@theme{--card:red}:root{--card:blue;--keep:1rem}'), { themeLiterals: 'materialize' });
  expect(p.entries.filter(e => e.name === '--card').every(e => e.status === 'unsupported')).toBe(true);
});

it('independent: preview is pure and its result is deterministic and immutable', () => {
  const m = capture(':root{--card:red;--link:var(--card)}'), before = JSON.stringify(m);
  const write = vi.spyOn(fs, 'writeFileSync'), mkdir = vi.spyOn(fs, 'mkdirSync');
  const p = planCanonicalCSS(m), a = renderCanonicalCSS(p), b = renderCanonicalCSS(planCanonicalCSS(m));
  expect(a).toEqual(b); expect(JSON.stringify(m)).toBe(before);
  expect(p.entries.map(e => e.identity)).toEqual(m.tokens.map(t => t.identity));
  expect(p.entries.map(e => e.type)).toEqual(m.tokens.map(t => t.type));
  expect(p.entries[0].identity).not.toBe(m.tokens[0].identity);
  expect(p.entries[0].type).not.toBe(m.tokens[0].type);
  expect(write).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled();
  expect(() => { p.entries[0].value = 'blue'; }).toThrow();
});

it('independent: write refuses existing output and source paths without modifying bytes', () => {
  const p = root(':root{--card:red}'), original = fs.readFileSync(path.join(p, 'source.css'));
  writeCanonicalCSS({ projectRoot: p, cssFiles: ['source.css'] }, { outputDirectory: 'out' });
  const artifact = fs.readFileSync(path.join(p, 'out/tokens.css'));
  for (const out of ['out', 'source.css']) expect(() => writeCanonicalCSS({ projectRoot: p, cssFiles: ['source.css'] }, { outputDirectory: out })).toThrow();
  expect(fs.readFileSync(path.join(p, 'source.css'))).toEqual(original);
  expect(fs.readFileSync(path.join(p, 'out/tokens.css'))).toEqual(artifact);
});

it('independent: writer rejects escapes, root links, linked parents and existing hardlink destination', () => {
  const p = root(':root{--card:red}'), outside = root(':root{--outside:blue}');
  const original = fs.readFileSync(path.join(outside, 'source.css'));
  fs.symlinkSync(outside, path.join(p, 'link'));
  fs.symlinkSync(path.join(outside, 'absent'), path.join(p, 'dangling'));
  fs.linkSync(path.join(outside, 'source.css'), path.join(p, 'hard'));
  for (const outputDirectory of ['../escape', outside, 'link/new', 'dangling', 'hard']) expect(() => writeCanonicalCSS({ projectRoot: p, cssFiles: ['source.css'] }, { outputDirectory })).toThrow();
  expect(() => writeCanonicalCSS({ projectRoot: path.join(p, 'link') }, { outputDirectory: 'out' })).toThrow();
  expect(fs.readdirSync(outside)).toEqual(['source.css']);
  expect(fs.readFileSync(path.join(outside, 'source.css'))).toEqual(original);
});

it('independent: errors and default partial preview cannot create output directories', () => {
  for (const css of [':root{--x:var(--missing)}', ':root{--x:red;--y:calc(1px * 2)}']) {
    const p = root(css);
    expect(() => writeCanonicalCSS({ projectRoot: p }, { outputDirectory: 'out' })).toThrow();
    expect(fs.existsSync(path.join(p, 'out'))).toBe(false);
  }
});

it('independent: theme literal output matches installed compiler declaration context without inventing a layer', async () => {
  const declarations = (css: string) => {
    const rows: Array<{ name: string; value: string; selector: string; parent: string }> = [];
    postcss.parse(css).walkDecls(d => {
      if (d.prop.startsWith('--') && d.parent?.type === 'rule') rows.push({ name: d.prop, value: d.value, selector: d.parent.selector, parent: d.parent.parent?.type ?? 'none' });
    });
    return rows;
  };
  for (const at of ['@theme', '@theme static']) {
    const input = `${at}{--color-brand:#123456}@tailwind utilities;`;
    const compiler = await compile(input), original = compiler.build(['bg-brand']);
    const generated = renderCanonicalCSS(planCanonicalCSS(capture(input), { themeLiterals: 'materialize' })).css;
    expect(declarations(generated)).toEqual(declarations(original));
  }
});

it('independent: inline literals do not certify a variable the compiler does not emit', async () => {
  const input = '@theme inline{--color-brand:#123456}@tailwind utilities;';
  const compiler = await compile(input), original = compiler.build(['bg-brand']);
  expect(original).not.toContain('--color-brand:');
  const p = planCanonicalCSS(capture(input), { themeLiterals: 'materialize' });
  expect(p.entries[0].status).toBe('unsupported');
  expect(p.status).toBe('blocked');
});
