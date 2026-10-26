import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { reviewFoundation, formatIntegrationReview } from '../integration/index.js';
import { runIntegrationCLI } from '../integration/cli.js';
import { renderCanonicalCSS } from '../css-export/index.js';

const roots: string[] = [];
function project(css: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spx-integration-independent-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'source.css'), css);
  return root;
}
function cli(args: string[]) {
  const out: string[] = [], err: string[] = [];
  const code = runIntegrationCLI(args, { out: s => { out.push(s); }, err: s => { err.push(s); } });
  return { code, out: out.join(''), err: err.join('') };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

it.each([String.raw`--\62 rand`, String.raw`\2d \2d brand`])('independent: escaped property identity %s blocks all output even with partial consent', name => {
  const root = project(`:root{--brand:red;${name}:blue;--link:var(--brand);--keep:1px}`);
  const { review, plan } = reviewFoundation({ projectRoot: root, cssFiles: ['source.css'] });
  expect(plan.status).toBe('blocked');
  expect(review.status).toBe('blocked');
  expect(plan.blockers.length).toBeGreaterThan(0);
  expect(() => renderCanonicalCSS(plan, { allowPartial: true })).toThrow();
  for (const mode of [['--preview'], ['--write', 'out']]) {
    expect(cli([root, '--css', 'source.css', ...mode, '--allow-partial']).code).toBe(2);
  }
  expect(fs.readdirSync(root)).toEqual(['source.css']);
});

it('independent: escaped registration identity cannot certify an unregistered plain alias family', () => {
  const root = project(String.raw`@property --\62 rand {syntax:"<color>";inherits:false;initial-value:blue}:root{--brand:red;--link:var(--brand)}`);
  const { plan } = reviewFoundation({ projectRoot: root });
  expect(plan.status).toBe('blocked');
  expect(() => renderCanonicalCSS(plan, { allowPartial: true })).toThrow();
  expect(cli([root, '--write', 'out', '--allow-partial']).code).toBe(2);
  expect(fs.readdirSync(root)).toEqual(['source.css']);
});

it('independent: mixed-case CSS registration blocks its family and dependent aliases', () => {
  const root = project('@PROPERTY --brand {syntax:"<color>";inherits:false;initial-value:blue}:root{--brand:red;--link:var(--brand);--keep:1px}');
  const { review, plan } = reviewFoundation({ projectRoot: root });
  expect(plan.status).toBe('partial');
  expect(review.exportable.map(e => e.name)).toEqual(['--keep']);
  expect(review.dependencies.every(e => e.disposition === 'excluded')).toBe(true);
});

it('independent: review counts preserve each declaration and chain exclusion without claiming application acceptance', () => {
  const root = project(':root{--base:red;--alias:var(--base);--chain:var(--alias);--keep:1px}.brand{--base:blue}');
  const { review, plan } = reviewFoundation({ projectRoot: root });
  expect(review.applicationSafety).toBe('not-evaluated');
  expect(review.status).toBe('partial');
  expect(review.discovered.declarations).toBe(5);
  expect(review.exportable.map(e => e.name)).toEqual(['--keep']);
  expect(review.excluded).toHaveLength(4);
  expect(new Set([...review.exportable, ...review.excluded].map(e => e.tokenId)).size).toBe(5);
  expect(review.dependencies).toHaveLength(2);
  expect(review.dependencies.every(d => d.disposition === 'excluded')).toBe(true);
  expect(review.contexts.reduce((n, c) => n + c.declarations, 0)).toBe(plan.coverage.eligible);
  expect(review.preserveSources).toEqual(['source.css']);
  expect(formatIntegrationReview(review)).toContain('application safety: NOT EVALUATED');
  expect(review.risks.join(' ')).toContain('Keep ALL original stylesheets');
});

it('independent: read-only review, JSON and preview never create files or alter source bytes', () => {
  const root = project(':root{--brand:red;--link:var(--brand)}');
  const before = fs.readFileSync(path.join(root, 'source.css'));
  const write = vi.spyOn(fs, 'writeFileSync'), mkdir = vi.spyOn(fs, 'mkdirSync');
  expect(cli([root]).code).toBe(0);
  const json = cli([root, '--json']);
  expect(JSON.parse(json.out).review.applicationSafety).toBe('not-evaluated');
  expect(cli([root, '--preview']).out).toContain('--link: var(--brand)');
  expect(write).not.toHaveBeenCalled();
  expect(mkdir).not.toHaveBeenCalled();
  expect(fs.readFileSync(path.join(root, 'source.css'))).toEqual(before);
});

it.each([
  ['--write', 'out', '--preview'], ['--json', '--write', 'out'],
  ['--write', 'out', '--write', 'other'], ['--preview', '--preview'],
  ['--write', 'out', '--allow-partial', '--allow-partial'],
  ['--write', 'out', '--unknown'], ['--write'], ['--css', '--write', 'out'],
])('independent: invalid/conflicting CLI options %j fail before any output mutation', (...args) => {
  const root = project(':root{--brand:red}');
  const write = vi.spyOn(fs, 'writeFileSync'), mkdir = vi.spyOn(fs, 'mkdirSync');
  const result = cli([root, ...args]);
  expect(result.code).toBe(1);
  expect(result.out).toBe('');
  expect(write).not.toHaveBeenCalled();
  expect(mkdir).not.toHaveBeenCalled();
});

it('independent: partial review success does not enable preview or writing without explicit consent', () => {
  const root = project(':root{--keep:1px;--unknown:calc(1px + 1px)}');
  const review = cli([root, '--json']);
  expect(review.code).toBe(0);
  expect(JSON.parse(review.out).review.status).toBe('partial');
  for (const mode of [['--preview'], ['--write', 'out']]) {
    const result = cli([root, ...mode]);
    expect(result.code).toBe(2);
    expect(result.out).toBe('');
  }
  expect(fs.existsSync(path.join(root, 'out'))).toBe(false);
  const allowed = cli([root, '--preview', '--allow-partial']);
  expect(allowed.code).toBe(0);
  expect(allowed.out).toContain('canonical CSS: partial');
  expect(allowed.out).not.toContain('--unknown:');
});

it('independent: source parse errors stay blocking with partial consent and visible in report', () => {
  const root = project(':root{--keep:red}');
  fs.writeFileSync(path.join(root, 'broken.css'), ':root{');
  const result = cli([root, '--json', '--allow-partial']);
  const report = JSON.parse(result.out).review;
  expect(result.code).toBe(2);
  expect(report.blockers.some((b: { code: string }) => b.code === 'CSS_PARSE')).toBe(true);
  expect(report.preserveSources).toContain('broken.css');
  expect(cli([root, '--write', 'out', '--allow-partial']).code).toBe(2);
  expect(fs.existsSync(path.join(root, 'out'))).toBe(false);
});

it('independent: rejected explicit source and missing source prevent output despite another eligible source', () => {
  const root = project(':root{--keep:red}'), outside = project(':root{--outside:blue}');
  fs.symlinkSync(path.join(outside, 'source.css'), path.join(root, 'linked.css'));
  for (const file of ['linked.css', 'missing.css', '../outside.css']) {
    const result = cli([root, '--css', 'source.css', '--css', file, '--write', 'out', '--allow-partial']);
    expect(result.code).toBe(2);
    expect(fs.existsSync(path.join(root, 'out'))).toBe(false);
  }
});

it('independent: CLI write preserves source and refuses reused output, traversal and linked parent', () => {
  const root = project(':root{--keep:red}'), outside = project(':root{--outside:blue}');
  const source = fs.readFileSync(path.join(root, 'source.css'));
  fs.symlinkSync(outside, path.join(root, 'link'));
  const success = cli([root, '--css', 'source.css', '--write', 'out']);
  expect(success.code).toBe(0);
  expect(JSON.parse(success.out).applicationSafety).toBe('not-evaluated');
  const artifact = fs.readFileSync(path.join(root, 'out/tokens.css'));
  for (const output of ['out', 'source.css', '../escape', 'link/new']) {
    expect(cli([root, '--css', 'source.css', '--write', output]).code).toBe(1);
  }
  expect(fs.readFileSync(path.join(root, 'source.css'))).toEqual(source);
  expect(fs.readFileSync(path.join(root, 'out/tokens.css'))).toEqual(artifact);
  expect(fs.readdirSync(outside)).toEqual(['source.css']);
});

it('independent: Tailwind opt-in cannot enable inline alias or literal output', () => {
  const root = project('@theme inline{--color-brand:red;--color-link:var(--color-brand)}');
  const result = cli([root, '--theme-literals', '--allow-partial', '--write', 'out']);
  expect(result.code).toBe(2);
  expect(fs.existsSync(path.join(root, 'out'))).toBe(false);
});

it('independent: write re-captures current sources and refuses newly unsupported values after review', () => {
  const root = project(':root{--keep:red}');
  const originalStat = fs.lstatSync.bind(fs);
  let rootChecks = 0;
  vi.spyOn(fs, 'lstatSync').mockImplementation((...args: Parameters<typeof fs.lstatSync>) => {
    // Root check one belongs to initial review; check two starts the explicit writer.
    if (String(args[0]) === root && ++rootChecks === 2) fs.writeFileSync(path.join(root, 'source.css'), ':root{--keep:var(--missing)}');
    return originalStat(...args);
  });
  const result = cli([root, '--css', 'source.css', '--write', 'out']);
  expect(result.code).not.toBe(0);
  expect(result.out).toBe('');
  expect(result.err).toContain('CSS export blocked');
  expect(rootChecks).toBeGreaterThanOrEqual(2);
  expect(fs.existsSync(path.join(root, 'out'))).toBe(false);
});

it('independent: a failed second artifact write is never reported as successful or cleaned up unsafely', () => {
  const root = project(':root{--keep:red}');
  const originalWrite = fs.writeFileSync.bind(fs);
  vi.spyOn(fs, 'writeFileSync').mockImplementation((...args: Parameters<typeof fs.writeFileSync>) => {
    if (String(args[0]).endsWith('/plan.json')) throw new Error('simulated manifest IO failure');
    return originalWrite(...args);
  });
  const result = cli([root, '--css', 'source.css', '--write', 'out']);
  expect(result.code).toBe(1);
  expect(result.out).toBe('');
  expect(result.err).toContain('simulated manifest IO failure');
  expect(fs.readFileSync(path.join(root, 'source.css'), 'utf8')).toBe(':root{--keep:red}');
  expect(fs.readdirSync(path.join(root, 'out'))).toEqual(['tokens.css']);
});
