import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createState, prepare, run, allowRetry, applyEvidence, taskExit, invalidate, persist, restore, materialize, validateOutput, milestoneExit, statusView, type Contract, type Worker, type Check } from '../core.js';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function fixture() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spexop-r1-')); const project = path.join(dir, 'project'); fs.mkdirSync(project); fs.writeFileSync(path.join(project, 'App.tsx'), 'original'); const contract: Contract = { schemaVersion: 'r1.1', taskId: 'T1', milestoneId: 'M5-R1', projectRoot: project, baseRevision: 'a'.repeat(40), allowedFiles: ['App.tsx'], sourceHashes: { 'App.tsx': hash('original') }, instruction: 'Fix one UI input', criteria: ['scope', 'unit', 'browser', 'permissions'], maxAttempts: 2, timeoutMs: 100, maxOutputBytes: 1000 }; const state = createState(contract); const worker: Worker = { kind: 'test-double', capability: { status: 'READY', provider: 'synthetic', model: 'fixture-only', accessVerified: true, costApproved: true, observedAt: new Date().toISOString() }, execute: async () => ({ externalRunId: 'synthetic-run', changes: [{ path: 'App.tsx', content: 'updated' }] }) }; return { dir, project, state, worker, clean: () => fs.rmSync(dir, { recursive: true }) }; }
function checks(s: ReturnType<typeof createState>, result: 'PASS' | 'FAIL' | 'UNKNOWN' = 'PASS'): Check[] { return s.contract.criteria.map(criterion => ({ criterion, result, revision: s.revision!, artifact: 'fixture-evidence.json', actor: 'independent', reason: 'Synthetic state test only' })); }
describe('R1 entry and bounded execution', () => {
    it.each(['provider', 'permission', 'cost'])('blocks unavailable %s before RUNNING', async (kind) => { const f = fixture(); try {
        if (kind === 'provider')
            f.worker.capability.status = 'BLOCKED';
        if (kind === 'permission')
            f.worker.capability.accessVerified = false;
        if (kind === 'cost')
            f.worker.capability.costApproved = false;
        await run(f.state, f.worker);
        expect(f.state.phase).toBe('BLOCKED');
        expect(f.state.attempts).toHaveLength(0);
    }
    finally {
        f.clean();
    } });
    it('test double can pass independent technical checks with explicit TESTED label', async () => { const f = fixture(); try {
        prepare(f.state);
        const result = await run(f.state, f.worker);
        expect(result.output?.changes[0].content).toBe('updated');
        expect(f.state.phase).toBe('UNVERIFIED');
        expect(applyEvidence(f.state, checks(f.state)).status).toBe('TESTED');
        expect(fs.readFileSync(path.join(f.project, 'App.tsx'), 'utf8')).toBe('original');
    }
    finally {
        f.clean();
    } });
    it('source change invalidates successful test-double evidence', async () => { const f = fixture(); try {
        await run(f.state, f.worker);
        expect(applyEvidence(f.state, checks(f.state)).status).toBe('TESTED');
        invalidate(f.state, 'new-snapshot');
        expect(taskExit(f.state).status).toBe('UNVERIFIED');
        expect(f.state.message).toContain('stale');
    }
    finally {
        f.clean();
    } });
    it.each(['FAIL', 'UNKNOWN'] as const)('required %s cannot pass task gate', async (result) => { const f = fixture(); try {
        await run(f.state, f.worker);
        expect(applyEvidence(f.state, checks(f.state, result)).status).toBe(result === 'FAIL' ? 'FAILED' : 'UNVERIFIED');
    }
    finally {
        f.clean();
    } });
    it('worker-produced tests or wrong revision do not establish independent acceptance', async () => { const f = fixture(); try {
        await run(f.state, f.worker);
        expect(applyEvidence(f.state, checks(f.state).map(e => ({ ...e, actor: 'worker' }))).status).toBe('UNVERIFIED');
        expect(() => applyEvidence(f.state, checks(f.state).map(e => ({ ...e, revision: 'stale' })))).toThrow();
        expect(() => applyEvidence(f.state, [...checks(f.state), checks(f.state)[0]])).toThrow();
    }
    finally {
        f.clean();
    } });
    it.each(['outside', 'invalid', 'empty', 'oversized'] as const)('rejects %s worker output without source write', async (kind) => { const f = fixture(); try {
        f.worker.execute = async () => ({ externalRunId: 'synthetic', changes: kind === 'empty' ? [] : [{ path: kind === 'outside' ? '../escape' : 'App.tsx', content: kind === 'oversized' ? 'x'.repeat(2000) : kind === 'invalid' ? null as unknown as string : 'bad' }] });
        await run(f.state, f.worker);
        expect(f.state.phase).toBe('FAILED');
        expect(fs.readFileSync(path.join(f.project, 'App.tsx'), 'utf8')).toBe('original');
        expect(fs.existsSync(path.join(f.dir, 'escape'))).toBe(false);
    }
    finally {
        f.clean();
    } });
    it('times out, aborts, refuses late output and stops after retry budget', async () => { const f = fixture(); try {
        f.state.contract.timeoutMs = 10;
        const s = createState(f.state.contract);
        f.worker.execute = ({ signal }) => new Promise((_res, reject) => signal.addEventListener('abort', () => reject(Error('aborted'))));
        await run(s, f.worker);
        expect(s.phase).toBe('FAILED');
        allowRetry(s);
        await run(s, f.worker);
        expect(s.attempts).toHaveLength(2);
        expect(() => allowRetry(s)).toThrow();
        await expect(run(s, f.worker)).rejects.toThrow('retry');
        expect(s.attempts).toHaveLength(2);
    }
    finally {
        f.clean();
    } });
    it('rejects contract tampering before API execution', async () => { const f = fixture(); try {
        f.state.contract.criteria = [];
        await expect(run(f.state, f.worker)).rejects.toThrow();
        expect(f.state.attempts).toHaveLength(0);
    }
    finally {
        f.clean();
    } });
    it.each(['changed', 'symlink', 'hardlink'] as const)('blocks unsafe %s source', async (kind) => { const f = fixture(); try {
        const file = path.join(f.project, 'App.tsx');
        if (kind === 'changed')
            fs.writeFileSync(file, 'different');
        else {
            fs.unlinkSync(file);
            const other = path.join(f.dir, 'other');
            fs.writeFileSync(other, 'original');
            if (kind === 'symlink')
                fs.symlinkSync(other, file);
            else
                fs.linkSync(other, file);
        }
        await run(f.state, f.worker);
        expect(f.state.phase).toBe('BLOCKED');
        expect(f.state.attempts).toHaveLength(0);
    }
    finally {
        f.clean();
    } });
    it('materializes only a fresh validated patch overlay; never original source', () => { const f = fixture(); try {
        const output = { externalRunId: 'fixture', changes: [{ path: 'App.tsx', content: 'updated' }] };
        const r = materialize(f.state.contract, output, f.dir);
        expect(fs.readFileSync(path.join(r.directory, 'App.tsx'), 'utf8')).toBe('updated');
        expect(fs.readFileSync(path.join(f.project, 'App.tsx'), 'utf8')).toBe('original');
        expect(() => materialize(f.state.contract, output, f.project)).toThrow();
        expect(() => validateOutput(f.state.contract, { ...output, changes: [...output.changes, ...output.changes] })).toThrow();
    }
    finally {
        f.clean();
    } });
});
describe('R1 recovery and milestone boundaries', () => {
    it('interrupted RUNNING restores UNVERIFIED and no auto-completion', () => { const f = fixture(); try {
        f.state.phase = 'RUNNING';
        const file = path.join(f.dir, 'state.json');
        persist(file, f.state);
        const r = restore(file);
        expect(r.phase).toBe('UNVERIFIED');
        expect(r.needsUserAction).toBe(true);
        expect(statusView(r).releaseApproval).toBe('NOT_GRANTED');
    }
    finally {
        f.clean();
    } });
    it('rejects corrupted journal and symlink/hardlink writes', () => { const f = fixture(); try {
        const file = path.join(f.dir, 'state.json');
        persist(file, f.state);
        const r = JSON.parse(fs.readFileSync(file, 'utf8'));
        r.state.phase = 'VERIFIED';
        fs.writeFileSync(file, JSON.stringify(r));
        expect(() => restore(file)).toThrow();
        fs.unlinkSync(file);
        fs.symlinkSync(path.join(f.project, 'App.tsx'), file);
        expect(() => persist(file, f.state)).toThrow();
    }
    finally {
        f.clean();
    } });
    it('missing or UNKNOWN mandatory milestone check cannot pass', () => { expect(milestoneExit({})).toBe('UNKNOWN'); const checks = { scope: 'PASS', quality: 'PASS', behavior: 'PASS' } as const; expect(milestoneExit(checks)).toBe('PASS'); expect(milestoneExit({ ...checks, behavior: 'UNKNOWN' })).toBe('UNKNOWN'); expect(milestoneExit(checks, true)).toBe('BLOCKED'); expect(milestoneExit({ ...checks, scope: 'FAIL' })).toBe('FAIL'); });
});
