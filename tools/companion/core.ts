import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export type Result = 'PASS' | 'FAIL' | 'UNKNOWN';
export type Phase = 'PREPARING' | 'READY' | 'RUNNING' | 'BLOCKED' | 'FAILED' | 'RETRYING' | 'UNVERIFIED' | 'VERIFIED' | 'TESTED';
export interface Contract {
    schemaVersion: 'r1.1';
    taskId: string;
    milestoneId: string;
    projectRoot: string;
    baseRevision: string;
    allowedFiles: string[];
    sourceHashes: Record<string, string>;
    instruction: string;
    criteria: string[];
    maxAttempts: number;
    timeoutMs: number;
    maxOutputBytes: number;
    /** Required by a real API worker; legacy test-double contracts may omit it. */
    maxOutputTokens?: number;
}
export interface Check {
    criterion: string;
    result: Result;
    revision: string;
    artifact: string;
    reason: string;
    actor: 'independent' | 'worker';
}
export interface Capability {
    status: 'READY' | 'BLOCKED' | 'UNKNOWN' | 'NOT_CONFIGURED';
    provider: string;
    model: string;
    accessVerified: boolean;
    costApproved: boolean;
    observedAt: string;
}
export interface WorkerOutput {
    externalRunId: string;
    changes: {
        path: string;
        content: string;
    }[];
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}
export interface Worker {
    kind: 'api' | 'test-double';
    capability: Capability;
    /** Optional caller approval check; runs before an attempt is recorded or any transport starts. */
    preflight?: (contract: Readonly<Contract>) => boolean;
    execute: (input: {
        contract: Readonly<Contract>;
        files: Readonly<Record<string, string>>;
        feedback: string[];
        signal: AbortSignal;
    }) => Promise<WorkerOutput>;
}
export interface Attempt {
    runId: string;
    externalRunId?: string;
    provider: string;
    model: string;
    kind: Worker['kind'];
    startedAt: string;
    finishedAt?: string;
    revision?: string;
    result: Result;
    reason: string;
    usage?: WorkerOutput['usage'];
}
export interface State {
    schemaVersion: 'r1.1';
    contract: Contract;
    contractHash: string;
    phase: Phase;
    attempts: Attempt[];
    evidence: Check[];
    revision: string | null;
    needsUserAction: boolean;
    message: string;
    history: {
        at: string;
        phase: Phase;
        message: string;
    }[];
}
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const safe = (s: string) => !!s && !path.isAbsolute(s) && !s.includes('\\') && !s.includes('\0') && s.split('/').every(p => p !== '.' && p !== '..' && !!p) && !s.split('/').some(p => p === '.git' || p === 'node_modules' || p.startsWith('.env'));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();
function transition(s: State, phase: Phase, message: string, user = false) { s.phase = phase; s.message = message; s.needsUserAction = user; s.history.push({ at: now(), phase, message }); }
function validateContract(c: Contract) {
    if (c.schemaVersion !== 'r1.1' || !c.taskId || !c.milestoneId || !path.isAbsolute(c.projectRoot) || !c.baseRevision || !c.instruction || !c.allowedFiles.length || c.allowedFiles.length > 10 || new Set(c.allowedFiles).size !== c.allowedFiles.length || c.allowedFiles.some(f => !safe(f) || !/^[a-f0-9]{64}$/.test(c.sourceHashes[f] ?? '')) || !c.criteria.length || new Set(c.criteria).size !== c.criteria.length || c.maxAttempts < 1 || c.maxAttempts > 2 || !Number.isInteger(c.maxAttempts) || c.timeoutMs < 1 || c.timeoutMs > 60000 || c.maxOutputBytes < 1 || c.maxOutputBytes > 65536 || (c.maxOutputTokens !== undefined && (!Number.isInteger(c.maxOutputTokens) || c.maxOutputTokens < 1 || c.maxOutputTokens > 8192)))
        throw new Error('Invalid task contract');
}
function assertContract(s: State) { validateContract(s.contract); if (hash(JSON.stringify(s.contract)) !== s.contractHash)
    throw new Error('Contract changed'); }
export function createState(contract: Contract): State {
    validateContract(contract);
    const c = clone(contract);
    return { schemaVersion: 'r1.1', contract: c, contractHash: hash(JSON.stringify(c)), phase: 'PREPARING', attempts: [], evidence: [], revision: null, needsUserAction: false, message: 'Task recorded; no worker started', history: [] };
}
export function prepare(s: State) { assertContract(s); transition(s, 'READY', 'Task contract ready'); return s; }
/** Read only explicit regular files; no user code or commands are evaluated. */
export function sourceFiles(c: Contract): Record<string, string> {
    validateContract(c);
    const root = fs.realpathSync(c.projectRoot);
    if (fs.lstatSync(c.projectRoot).isSymbolicLink())
        throw new Error('Project root symlink');
    const out: Record<string, string> = {};
    for (const rel of c.allowedFiles) {
        let p = root;
        for (const part of rel.split('/')) {
            p = path.join(p, part);
            if (fs.lstatSync(p).isSymbolicLink())
                throw new Error('Source symlink');
        }
        const st = fs.statSync(p);
        if (!st.isFile() || st.nlink !== 1 || st.size > c.maxOutputBytes)
            throw new Error('Unsafe source');
        const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
            const before = fs.fstatSync(fd);
            const b = fs.readFileSync(fd);
            const after = fs.fstatSync(fd);
            if (before.ino !== st.ino || before.dev !== st.dev || after.mtimeMs !== before.mtimeMs || b.length > c.maxOutputBytes || hash(b) !== c.sourceHashes[rel])
                throw new Error('Source revision mismatch');
            out[rel] = b.toString('utf8');
        }
        finally {
            fs.closeSync(fd);
        }
    }
    return out;
}
export function validateOutput(c: Contract, value: unknown): WorkerOutput {
    if (!value || typeof value !== 'object')
        throw new Error('Invalid worker output');
    const v = value as WorkerOutput;
    const usage = v.usage;
    if (typeof v.externalRunId !== 'string' || !v.externalRunId.trim() || v.externalRunId.length > 200 || !Array.isArray(v.changes) || !v.changes.length || v.changes.length > c.allowedFiles.length || new Set(v.changes.map(x => x.path)).size !== v.changes.length || v.changes.some(x => !x || typeof x.path !== 'string' || !safe(x.path) || !c.allowedFiles.includes(x.path) || typeof x.content !== 'string') || (usage !== undefined && (!usage || !Number.isSafeInteger(usage.inputTokens) || !Number.isSafeInteger(usage.outputTokens) || !Number.isSafeInteger(usage.totalTokens) || usage.inputTokens < 0 || usage.outputTokens < 0 || usage.totalTokens < usage.inputTokens + usage.outputTokens)) || Buffer.byteLength(JSON.stringify(v)) > c.maxOutputBytes)
        throw new Error('Invalid or out-of-scope worker output');
    return clone(v);
}
export function patchRevision(c: Contract, o: WorkerOutput) { return hash(JSON.stringify({ base: c.baseRevision, contract: hash(JSON.stringify(c)), changes: o.changes.slice().sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) })); }
/** Candidate is a new directory; original source is never modified. Scope validation precedes every write. */
export function materialize(c: Contract, output: WorkerOutput, parent: string) {
    const o = validateOutput(c, output);
    const root = fs.realpathSync(parent);
    if (fs.lstatSync(parent).isSymbolicLink() || root === fs.realpathSync(c.projectRoot) || root.startsWith(fs.realpathSync(c.projectRoot) + path.sep))
        throw new Error('Candidate overlaps project');
    const dir = fs.mkdtempSync(path.join(root, 'candidate-'));
    fs.chmodSync(dir, 0o700);
    for (const file of o.changes) {
        const p = path.join(dir, file.path);
        fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
        fs.writeFileSync(p, file.content, { flag: 'wx', mode: 0o600 });
    }
    return { directory: dir, revision: patchRevision(c, o) };
}
export function taskExit(s: State): {
    status: 'VERIFIED' | 'TESTED' | 'FAILED' | 'UNVERIFIED';
    criteria: Record<string, Result>;
} {
    assertContract(s);
    const a = s.attempts.at(-1), criteria: Record<string, Result> = {};
    for (const id of s.contract.criteria) {
        const checks = s.evidence.filter(e => e.criterion === id && e.revision === s.revision && e.actor === 'independent' && !!e.artifact);
        criteria[id] = checks.some(e => e.result === 'FAIL') ? 'FAIL' : checks.some(e => e.result === 'PASS') ? 'PASS' : 'UNKNOWN';
    }
    const completed = !!a?.externalRunId && a.revision === s.revision && a.result === 'PASS';
    return { status: Object.values(criteria).includes('FAIL') ? 'FAILED' : completed && Object.values(criteria).every(v => v === 'PASS') ? (a!.kind === 'api' ? 'VERIFIED' : 'TESTED') : 'UNVERIFIED', criteria };
}
export function applyEvidence(s: State, checks: Check[]) {
    assertContract(s);
    if (!s.revision)
        throw new Error('No candidate revision');
    if (new Set(checks.map(e => e.criterion)).size !== checks.length || checks.some(e => !s.contract.criteria.includes(e.criterion) || !['PASS', 'FAIL', 'UNKNOWN'].includes(e.result) || e.revision !== s.revision))
        throw new Error('Invalid or stale evidence');
    s.evidence = clone(checks);
    const exit = taskExit(s);
    transition(s, exit.status, (exit.status === 'VERIFIED' || exit.status === 'TESTED') ? 'Independent task criteria passed; ' + (exit.status === 'TESTED' ? 'test double execution' : 'API adapter execution') : exit.status === 'FAILED' ? 'Required verification failed: ' + checks.filter(e => e.result === 'FAIL').map(e => e.criterion + ': ' + e.reason).join('; ') : 'Required evidence or real API run missing', !['VERIFIED', 'TESTED'].includes(exit.status));
    return exit;
}
export function invalidate(s: State, currentRevision: string) { if (s.revision !== currentRevision) {
    s.evidence = [];
    s.revision = currentRevision;
    transition(s, 'UNVERIFIED', 'Revision changed; previous verification is stale', true);
} return s; }
/** A caller-owned adapter is required. No implicit provider, credentials, command execution or paid fallback. */
export async function run(s: State, worker: Worker, save: (state: State) => void = () => { }) {
    assertContract(s);
    if (s.phase === 'RUNNING' || s.phase === 'VERIFIED' || s.phase === 'TESTED')
        throw new Error('Task already running or verified');
    const cap = worker.capability;
    if (cap.status !== 'READY' || cap.accessVerified !== true || cap.costApproved !== true || !cap.provider || !cap.model || !cap.observedAt) {
        transition(s, 'BLOCKED', cap.status === 'NOT_CONFIGURED' ? 'API worker NOT_CONFIGURED' : 'Provider access/model/cost not verified; no execution', true);
        save(s);
        return { state: s };
    }
    if (worker.kind === 'api' && !s.contract.maxOutputTokens) {
        transition(s, 'BLOCKED', 'API token limit missing from task contract; no execution', true);
        save(s);
        return { state: s };
    }
    if (worker.preflight && !worker.preflight(s.contract)) {
        transition(s, 'BLOCKED', 'Task approval does not cover source or budget; no execution', true);
        save(s);
        return { state: s };
    }
    if (s.attempts.length && s.phase !== 'RETRYING') {
        throw new Error('Explicit retry permission required');
    }
    if (s.attempts.length >= s.contract.maxAttempts) {
        transition(s, 'FAILED', 'Retry limit reached; escalate', true);
        save(s);
        return { state: s };
    }
    let files: Record<string, string>;
    try {
        files = sourceFiles(s.contract);
    }
    catch {
        transition(s, 'BLOCKED', 'Source revision or permissions unsafe', true);
        save(s);
        return { state: s };
    }
    const feedback = [...s.evidence.filter(e => e.result !== 'PASS').map(e => `${e.criterion}: ${e.result}: ${e.reason}`), ...s.attempts.filter(a => a.result === 'FAIL').map(a => a.reason)];
    const a: Attempt = { runId: randomUUID(), provider: cap.provider, model: cap.model, kind: worker.kind, startedAt: now(), result: 'UNKNOWN', reason: 'Started bounded execution' };
    s.attempts.push(a);
    s.evidence = [];
    s.revision = null;
    transition(s, 'RUNNING', 'Bounded worker execution started');
    save(s);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let accepted: WorkerOutput | undefined;
    let responseReceived = false;
    try {
        const response = await Promise.race([worker.execute({ contract: clone(s.contract), files: Object.freeze(files), feedback, signal: controller.signal }), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, s.contract.timeoutMs); })]);
        responseReceived = true;
        assertContract(s);
        const output = validateOutput(s.contract, response);
        accepted = output;
        a.externalRunId = output.externalRunId;
        if (output.usage)
            a.usage = output.usage;
        a.revision = patchRevision(s.contract, output);
        a.result = 'PASS';
        a.reason = 'Output scope checked; independent acceptance pending';
        s.revision = a.revision;
        transition(s, 'UNVERIFIED', 'Worker output needs independent checks', true);
    }
    catch {
        a.result = 'FAIL';
        a.reason = controller.signal.aborted ? 'Worker timeout; isolated output ignored' : responseReceived ? 'Output paths/content outside contract; isolated output ignored' : 'Worker call failed; isolated output ignored';
        transition(s, 'FAILED', a.reason + '; review before retry', true);
    }
    finally {
        if (timer)
            clearTimeout(timer);
        a.finishedAt = now();
        save(s);
    }
    return { state: s, output: accepted };
}
export function allowRetry(s: State) { assertContract(s); if (s.phase !== 'FAILED' || s.attempts.length >= s.contract.maxAttempts)
    throw new Error('Retry not permitted'); transition(s, 'RETRYING', 'Bounded retry permitted after feedback'); }
/** Atomic local journal, not authenticated evidence. Parent directory must be private and caller-owned. */
export function persist(file: string, s: State) {
    assertContract(s);
    const namedParent = path.dirname(file);
    if (fs.lstatSync(namedParent).isSymbolicLink())
        throw new Error('Unsafe state parent');
    const parent = fs.realpathSync(namedParent);
    file = path.join(parent, path.basename(file));
    if (fs.existsSync(file)) {
        const st = fs.lstatSync(file);
        if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1)
            throw new Error('Unsafe state target');
    }
    const text = JSON.stringify(s), tmp = path.join(parent, `.state-${randomUUID()}`);
    fs.writeFileSync(tmp, JSON.stringify({ sha256: hash(text), state: s }), { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
}
export function restore(file: string): State {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 1024 * 1024)
        throw new Error('Unsafe state journal');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (hash(JSON.stringify(raw.state)) !== raw.sha256)
        throw new Error('Journal integrity mismatch');
    const s = raw.state as State;
    assertContract(s);
    if (s.phase === 'RUNNING') {
        const a = s.attempts.at(-1);
        if (a) {
            a.result = 'UNKNOWN';
            a.reason = 'Interrupted; no safe automatic resume';
        }
        transition(s, 'UNVERIFIED', 'Interrupted worker requires inspection; no automatic completion', true);
    }
    return s;
}
export function milestoneExit(criteria: Record<string, Result>, blocked = false): Result | 'BLOCKED' { const values = Object.values(criteria); if (!values.length)
    return blocked ? 'BLOCKED' : 'UNKNOWN'; return values.includes('FAIL') ? 'FAIL' : blocked ? 'BLOCKED' : values.every(v => v === 'PASS') ? 'PASS' : 'UNKNOWN'; }
export function statusView(s: State) { const exit = taskExit(s); return { task: s.contract.taskId, milestone: s.contract.milestoneId, phase: s.phase, revision: s.revision, executionKind: s.attempts.at(-1)?.kind ?? 'not-started', attemptCount: s.attempts.length, attemptLimit: s.contract.maxAttempts, usage: s.attempts.at(-1)?.usage ?? null, taskExit: exit, needsUserAction: s.needsUserAction, message: s.message, history: s.history.slice(-10), productAcceptance: 'NOT_GRANTED', releaseApproval: 'NOT_GRANTED' }; }
