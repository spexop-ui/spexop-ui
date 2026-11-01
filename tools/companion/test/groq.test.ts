import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { coordinate, snapshot } from '../coordinate.js';
import { createState, run, statusView, type Check, type Contract } from '../core.js';
import { groqWorker, type GroqTaskApproval } from '../groq.js';

function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spexop-groq-offline-'));
    const projectRoot = path.join(dir, 'source');
    fs.mkdirSync(projectRoot);
    fs.writeFileSync(path.join(projectRoot, 'Input.tsx'), 'export const Input = () => <input />;');
    const source = snapshot(projectRoot, ['Input.tsx']);
    const contract: Contract = {
        schemaVersion: 'r1.1', taskId: 'R1-INPUT', milestoneId: 'M5', projectRoot,
        baseRevision: source.revision, allowedFiles: ['Input.tsx'], sourceHashes: { 'Input.tsx': source.hashes['Input.tsx'] },
        instruction: 'Keep the input accessible', criteria: ['scope', 'quality'], maxAttempts: 1,
        timeoutMs: 1000, maxOutputBytes: 4096, maxOutputTokens: 2048,
    };
    const approval: GroqTaskApproval = {
        taskId: contract.taskId, baseRevision: contract.baseRevision,
        contractHash: createHash('sha256').update(JSON.stringify(contract)).digest('hex'),
        model: 'openai/gpt-oss-120b', allowedFiles: ['Input.tsx'],
        sourceHashes: { ...contract.sourceHashes }, maxAttempts: 1, maxOutputTokens: 2048,
        maxPromptBytes: 4096, sourceSharingApproved: true, feedbackSharingApproved: false,
    };
    return { dir, projectRoot, contract, approval, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function completion(changes: unknown, usage = { prompt_tokens: 120, completion_tokens: 90, total_tokens: 210 }) {
    return new Response(JSON.stringify({
        id: 'groq-test-run', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ changes }) } }], usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('bounded Groq product transport (offline)', () => {
    it('feeds a validated API result into the local coordinator without writing the source or key', async () => {
        const f = fixture();
        try {
            let sent: { url: string; body: Record<string, unknown>; authorization: string } | undefined;
            const worker = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z', approval: f.approval,
                fetchImpl: async (url, init) => {
                    const headers = new Headers(init?.headers);
                    sent = { url: String(url), body: JSON.parse(String(init?.body)), authorization: headers.get('Authorization') ?? '' };
                    expect(init?.redirect).toBe('error');
                    expect(init?.signal).toBeInstanceOf(AbortSignal);
                    return completion([{ path: 'Input.tsx', content: 'export const Input = () => <input aria-label="Name" />;' }]);
                },
            });
            const state = createState(f.contract);
            const result = await coordinate({
                state, worker, files: ['Input.tsx'], candidateParent: f.dir, save: () => { },
                verify: async candidate => f.contract.criteria.map((criterion): Check => ({
                    criterion, result: 'PASS', revision: candidate.revision, artifact: 'offline-independent-fixture',
                    reason: 'Offline independent fixture only', actor: 'independent',
                })),
            });
            expect(state.phase).toBe('VERIFIED');
            expect(state.attempts[0].usage).toEqual({ inputTokens: 120, outputTokens: 90, totalTokens: 210 });
            expect(statusView(state).usage?.totalTokens).toBe(210);
            expect(fs.readFileSync(path.join(f.projectRoot, 'Input.tsx'), 'utf8')).not.toContain('aria-label');
            expect(fs.readFileSync(path.join(result.candidates[0].directory, 'Input.tsx'), 'utf8')).toContain('aria-label');
            expect(sent?.url).toBe('https://api.groq.com/openai/v1/chat/completions');
            expect(sent?.body.max_completion_tokens).toBe(2048);
            expect(sent?.authorization).toBe('Bearer test-only-key');
            expect(JSON.stringify(state)).not.toContain('test-only-key');
            expect(JSON.stringify(sent?.body)).not.toContain(f.projectRoot);
        }
        finally {
            f.cleanup();
        }
    });

    it.each(['source', 'tokens', 'consent', 'cost', 'model', 'instruction'] as const)('blocks %s before a provider call', async kind => {
        const f = fixture();
        try {
            const contract = { ...f.contract, sourceHashes: { ...f.contract.sourceHashes } };
            const approval = { ...f.approval, sourceHashes: { ...f.approval.sourceHashes } };
            if (kind === 'source') approval.sourceHashes['Input.tsx'] = '0'.repeat(64);
            if (kind === 'tokens') approval.maxOutputTokens = 100;
            if (kind === 'consent') approval.sourceSharingApproved = false;
            if (kind === 'model') approval.model = 'different-model';
            if (kind === 'instruction') contract.instruction = 'Different task';
            let calls = 0;
            const worker = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true,
                costApproved: kind !== 'cost', observedAt: '2026-11-01T00:00:00Z', approval,
                fetchImpl: async () => { calls++; return completion([]); },
            });
            const state = createState(contract);
            await run(state, worker);
            expect(state.phase).toBe('BLOCKED');
            expect(state.attempts).toHaveLength(0);
            expect(calls).toBe(0);
        }
        finally {
            f.cleanup();
        }
    });

    it('rejects direct calls with unapproved content or feedback before transmission', async () => {
        const f = fixture();
        try {
            let calls = 0;
            const worker = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z', approval: f.approval,
                fetchImpl: async () => { calls++; return completion([]); },
            });
            await expect(worker.execute({ contract: f.contract, files: { 'Input.tsx': 'unapproved source' }, feedback: [], signal: new AbortController().signal })).rejects.toThrow();
            await expect(worker.execute({ contract: f.contract, files: { 'Input.tsx': fs.readFileSync(path.join(f.projectRoot, 'Input.tsx'), 'utf8') }, feedback: ['private verifier detail'], signal: new AbortController().signal })).rejects.toThrow();
            expect(calls).toBe(0);
        }
        finally {
            f.cleanup();
        }
    });

    it('rejects an out-of-scope completion and keeps the original file untouched', async () => {
        const f = fixture();
        try {
            const state = createState(f.contract);
            const worker = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z', approval: f.approval,
                fetchImpl: async () => completion([{ path: '../outside.ts', content: 'bad' }]),
            });
            await run(state, worker);
            expect(state.phase).toBe('FAILED');
            expect(fs.readFileSync(path.join(f.projectRoot, 'Input.tsx'), 'utf8')).toContain('<input />');
            expect(fs.existsSync(path.join(f.dir, 'outside.ts'))).toBe(false);
        }
        finally {
            f.cleanup();
        }
    });

    it('does not transmit an oversized prompt and does not expose an HTTP error body', async () => {
        const f = fixture();
        try {
            let calls = 0;
            const small = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z', approval: { ...f.approval, maxPromptBytes: 1 },
                fetchImpl: async () => { calls++; return completion([]); },
            });
            const state = createState(f.contract);
            await run(state, small);
            expect(state.phase).toBe('FAILED');
            expect(calls).toBe(0);
            const denied = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z', approval: f.approval,
                fetchImpl: async () => new Response('sensitive provider detail', { status: 403 }),
            });
            const second = createState(f.contract);
            await run(second, denied);
            expect(second.phase).toBe('FAILED');
            expect(JSON.stringify(second)).not.toContain('sensitive provider detail');
            expect(JSON.stringify(second)).not.toContain('test-only-key');
        }
        finally {
            f.cleanup();
        }
    });

    it('requires a task token limit and aborts an in-flight request at the time limit', async () => {
        const f = fixture();
        try {
            let calls = 0;
            const worker = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z', approval: f.approval,
                fetchImpl: async (_url, init) => {
                    calls++;
                    return new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                    });
                },
            });
            const missing = createState({ ...f.contract, maxOutputTokens: undefined });
            await run(missing, worker);
            expect(missing.phase).toBe('BLOCKED');
            expect(calls).toBe(0);
            const timedContract = { ...f.contract, timeoutMs: 10 };
            const timed = createState(timedContract);
            const timedWorker = groqWorker({
                apiKey: 'test-only-key', model: 'openai/gpt-oss-120b', accessVerified: true, costApproved: true,
                observedAt: '2026-11-01T00:00:00Z',
                approval: { ...f.approval, contractHash: timed.contractHash },
                fetchImpl: async (_url, init) => {
                    calls++;
                    return new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                    });
                },
            });
            await run(timed, timedWorker);
            expect(timed.phase).toBe('FAILED');
            expect(timed.attempts).toHaveLength(1);
            expect(calls).toBe(1);
        }
        finally {
            f.cleanup();
        }
    });
});
