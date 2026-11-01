import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { run, allowRetry, applyEvidence, patchRevision, validateOutput, type State, type Worker, type Check } from './core.js';
const digest = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const valid = (p: string) => !!p && !path.isAbsolute(p) && !p.includes('\\') && p.split('/').every(x => !!x && x !== '.' && x !== '..' && x !== '.git' && x !== 'node_modules' && !x.startsWith('.env'));
/** Explicit project file inventory, no directory guessing or user code execution. */
export function snapshot(root: string, files: readonly string[]) {
    if (fs.lstatSync(root).isSymbolicLink())
        throw new Error('Project root link');
    const canonical = fs.realpathSync(root);
    const contents: Record<string, Buffer> = {}, hashes: Record<string, string> = {};
    let size = 0;
    if (!files.length || files.length > 500 || new Set(files).size !== files.length)
        throw new Error('Invalid inventory');
    for (const file of [...files].sort()) {
        if (!valid(file))
            throw new Error('Unsafe inventory path');
        let p = canonical;
        for (const bit of file.split('/')) {
            p = path.join(p, bit);
            if (fs.lstatSync(p).isSymbolicLink())
                throw new Error('Inventory link');
        }
        const st = fs.lstatSync(p);
        if (!st.isFile() || st.nlink !== 1 || st.size > 8 * 1024 * 1024)
            throw new Error('Unsafe inventory file');
        const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
            const opened = fs.fstatSync(fd);
            if (opened.ino !== st.ino || opened.dev !== st.dev)
                throw new Error('Inventory changed');
            const b = fs.readFileSync(fd);
            const after = fs.fstatSync(fd);
            size += b.length;
            if (size > 32 * 1024 * 1024 || b.length !== st.size || after.mtimeMs !== opened.mtimeMs)
                throw new Error('Inventory changed/oversized');
            contents[file] = b;
            hashes[file] = digest(b);
        }
        finally {
            fs.closeSync(fd);
        }
    }
    return { contents, hashes, revision: digest(JSON.stringify(hashes)) };
}
export interface Candidate {
    directory: string;
    revision: string;
    patchRevision: string;
    hashes: Record<string, string>;
}
/** One local task loop. Verifier is main-agent owned; worker only returns source edits. */
export async function coordinate(options: {
    state: State;
    worker: Worker;
    files: string[];
    candidateParent: string;
    save: (s: State) => void;
    verify: (candidate: Candidate) => Promise<Check[]>;
}) {
    const { state, worker, files, save } = options;
    const initial = snapshot(state.contract.projectRoot, files);
    if (state.contract.allowedFiles.some(f => !files.includes(f)))
        throw new Error('Allowed file outside inventory');
    const parent = fs.realpathSync(options.candidateParent), source = fs.realpathSync(state.contract.projectRoot);
    if (fs.lstatSync(options.candidateParent).isSymbolicLink() || parent === source || parent.startsWith(source + path.sep))
        throw new Error('Unsafe candidate parent');
    const candidates: Candidate[] = [];
    for (;;) {
        const result = await run(state, worker, save);
        if (!result.output)
            return { state, candidates };
        const output = validateOutput(state.contract, result.output), directory = fs.mkdtempSync(path.join(parent, 'app-'));
        fs.chmodSync(directory, 0o700);
        const content = { ...initial.contents };
        for (const edit of output.changes)
            content[edit.path] = Buffer.from(edit.content);
        for (const [file, bytes] of Object.entries(content)) {
            const p = path.join(directory, file);
            fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
            fs.writeFileSync(p, bytes, { flag: 'wx', mode: 0o600 });
        }
        const manifest = snapshot(directory, files), candidate: Candidate = { directory, revision: manifest.revision, patchRevision: patchRevision(state.contract, output), hashes: manifest.hashes };
        candidates.push(candidate);
        // Evidence revision covers every explicitly selected project source file, not just the changed file.
        state.revision = candidate.revision;
        state.attempts.at(-1)!.revision = candidate.revision;
        save(state);
        let checks: Check[];
        try {
            checks = await options.verify(candidate);
        }
        catch {
            checks = state.contract.criteria.map(criterion => ({ criterion, result: 'UNKNOWN', revision: candidate.revision, artifact: 'verification-exception', reason: 'Independent verification unavailable', actor: 'independent' }));
        }
        const unchanged = snapshot(directory, files).revision === candidate.revision && snapshot(source, files).revision === initial.revision;
        if (!unchanged)
            checks = state.contract.criteria.map(criterion => ({ criterion, result: 'UNKNOWN', revision: candidate.revision, artifact: 'snapshot-mismatch', reason: 'Source or candidate changed during verification; stale evidence', actor: 'independent' }));
        const exit = applyEvidence(state, checks);
        save(state);
        if (exit.status !== 'FAILED' || state.attempts.length >= state.contract.maxAttempts)
            return { state, candidates };
        allowRetry(state);
        save(state);
    }
}
