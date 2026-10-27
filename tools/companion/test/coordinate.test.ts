import { it, expect, describe } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { coordinate, snapshot } from '../coordinate.js';
import { createState, persist, restore, type Worker, type Check, type State } from '../core.js';
import { notConfiguredWorker, apiWorker } from '../provider.js';
import { panel } from '../panel.js';
function setup() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coord-')); const project = path.join(dir, 'project'); fs.mkdirSync(project); fs.writeFileSync(path.join(project, 'App.tsx'), 'original'); fs.writeFileSync(path.join(project, 'style.css'), 'retained'); const state = createState({ schemaVersion: 'r1.1', taskId: 'T', milestoneId: 'M5', projectRoot: project, baseRevision: 'a'.repeat(40), allowedFiles: ['App.tsx'], sourceHashes: { 'App.tsx': createHash('sha256').update('original').digest('hex') }, instruction: 'Update UI', criteria: ['scope', 'quality', 'browser'], maxAttempts: 2, timeoutMs: 100, maxOutputBytes: 1024 }); const worker: Worker = { kind: 'test-double', capability: { status: 'READY', provider: 'fixture', model: 'simulation', accessVerified: true, costApproved: true, observedAt: new Date().toISOString() }, execute: async () => ({ externalRunId: 'synthetic', changes: [{ path: 'App.tsx', content: 'updated' }] }) }; return { dir, project, state, worker, clean: () => fs.rmSync(dir, { recursive: true }) }; }
const checks = (s: State, revision: string): Check[] => s.contract.criteria.map(criterion => ({ criterion, result: 'PASS', revision, artifact: 'independent-artifact.json', reason: 'Test-double fixture, not external API evidence', actor: 'independent' }));
describe('small local coordination loop', () => {
    it('retains complete selected source inventory, persists result and labels simulation', async () => { const f = setup(); try {
        const file = path.join(f.dir, 'state.json');
        const r = await coordinate({ state: f.state, worker: f.worker, files: ['App.tsx', 'style.css'], candidateParent: f.dir, save: s => persist(file, s), verify: async (c) => { expect(fs.readFileSync(path.join(c.directory, 'style.css'), 'utf8')).toBe('retained'); return checks(f.state, c.revision); } });
        expect(r.state.phase).toBe('TESTED');
        expect(restore(file).phase).toBe('TESTED');
        expect(f.state.revision).toBe(snapshot(r.candidates[0].directory, ['App.tsx', 'style.css']).revision);
        expect(fs.readFileSync(path.join(f.project, 'App.tsx'), 'utf8')).toBe('original');
    }
    finally {
        f.clean();
    } });
    it('passes actionable verification feedback to exactly one bounded retry', async () => { const f = setup(); try {
        let call = 0;
        let feedback: string[] = [];
        f.worker.execute = async (i) => { call++; feedback = [...i.feedback]; return { externalRunId: 'sim-' + call, changes: [{ path: 'App.tsx', content: 'attempt-' + call }] }; };
        const r = await coordinate({ state: f.state, worker: f.worker, files: ['App.tsx', 'style.css'], candidateParent: f.dir, save: () => { }, verify: async (c) => checks(f.state, c.revision).map(e => ({ ...e, result: call === 1 ? 'FAIL' : 'PASS', reason: 'Required input must reject whitespace' })) });
        expect(call).toBe(2);
        expect(feedback.join(' ')).toContain('reject whitespace');
        expect(r.state.phase).toBe('TESTED');
    }
    finally {
        f.clean();
    } });
    it('stops with escalation after two reproducible failures', async () => { const f = setup(); try {
        await coordinate({ state: f.state, worker: f.worker, files: ['App.tsx'], candidateParent: f.dir, save: () => { }, verify: async (c) => checks(f.state, c.revision).map(e => ({ ...e, result: 'FAIL', reason: 'UI still fails' })) });
        expect(f.state.attempts).toHaveLength(2);
        expect(f.state.phase).toBe('FAILED');
        expect(f.state.needsUserAction).toBe(true);
        expect(f.state.message).toContain('UI still fails');
    }
    finally {
        f.clean();
    } });
    it('missing browser or verifier exception remains UNVERIFIED', async () => { const f = setup(); try {
        await coordinate({ state: f.state, worker: f.worker, files: ['App.tsx'], candidateParent: f.dir, save: () => { }, verify: async () => { throw Error('browser unavailable'); } });
        expect(f.state.phase).toBe('UNVERIFIED');
        expect(f.state.attempts).toHaveLength(1);
    }
    finally {
        f.clean();
    } });
    it('candidate modification during checks makes prior evidence stale', async () => { const f = setup(); try {
        await coordinate({ state: f.state, worker: f.worker, files: ['App.tsx'], candidateParent: f.dir, save: () => { }, verify: async (c) => { fs.writeFileSync(path.join(c.directory, 'App.tsx'), 'changed after check'); return checks(f.state, c.revision); } });
        expect(f.state.phase).toBe('UNVERIFIED');
        expect(f.state.evidence.every(e => e.result === 'UNKNOWN')).toBe(true);
    }
    finally {
        f.clean();
    } });
    it('unconfigured API never starts a worker or candidate', async () => { const f = setup(); try {
        const r = await coordinate({ state: f.state, worker: notConfiguredWorker(), files: ['App.tsx'], candidateParent: f.dir, save: () => { }, verify: async () => { throw Error('must not verify'); } });
        expect(r.candidates).toHaveLength(0);
        expect(f.state.attempts).toHaveLength(0);
        expect(f.state.phase).toBe('BLOCKED');
        expect(f.state.message).toContain('NOT_CONFIGURED');
    }
    finally {
        f.clean();
    } });
    it('API transport boundary rejects out-of-scope output and passes AbortSignal', async () => { const f = setup(); try {
        let signal: AbortSignal | undefined;
        const adapter = apiWorker(f.worker.capability, async (input) => { signal = input.signal; return { requestId: 'transport-stub', changes: [{ path: 'other.ts', content: 'bad' }] }; });
        await expect(adapter.execute({ contract: f.state.contract, files: {}, feedback: [], signal: new AbortController().signal })).rejects.toThrow();
        expect(signal).toBeInstanceOf(AbortSignal);
    }
    finally {
        f.clean();
    } });
    it.each(['symlink', 'hardlink', 'escape'] as const)('rejects %s source inventory', kind => { const f = setup(); try {
        const file = path.join(f.project, 'style.css');
        if (kind === 'symlink') {
            fs.unlinkSync(file);
            fs.symlinkSync(path.join(f.project, 'App.tsx'), file);
        }
        if (kind === 'hardlink') {
            fs.unlinkSync(file);
            fs.linkSync(path.join(f.project, 'App.tsx'), file);
        }
        expect(() => snapshot(f.project, kind === 'escape' ? ['../outside'] : ['style.css'])).toThrow();
    }
    finally {
        f.clean();
    } });
    it('status server reads actual journal, rejects writes/foreign Host, and reports missing state', async () => { const f = setup(); let server: ReturnType<typeof panel> | undefined; try {
        const file = path.join(f.dir, 'state.json');
        persist(file, f.state);
        server = panel(file);
        await new Promise<void>(resolve => server!.once('listening', resolve));
        const addr = server.address();
        if (!addr || typeof addr === 'string')
            throw Error();
        const url = `http://127.0.0.1:${addr.port}`;
        expect((await (await fetch(url + '/state')).json()).phase).toBe('PREPARING');
        f.state.phase = 'BLOCKED';
        f.state.message = 'API worker NOT_CONFIGURED';
        persist(file, f.state);
        expect((await (await fetch(url + '/state')).json()).message).toBe('API worker NOT_CONFIGURED');
        expect((await fetch(url + '/state', { method: 'POST' })).status).toBe(405);
        const foreign = await new Promise<number | undefined>(resolve => http.get(url + '/state', { headers: { Host: 'evil.test' } }, r => { r.resume(); resolve(r.statusCode); }));
        expect(foreign).toBe(403);
        fs.unlinkSync(file);
        expect((await fetch(url + '/state')).status).toBe(503);
    }
    finally {
        if (server)
            await new Promise<void>(resolve => server!.close(() => resolve()));
        f.clean();
    } });
});
