// Trusted, synthetic Input-only local caller. No provider call in preflight/review modes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createState, prepare, persist, restore, applyEvidence, statusView } from '../../tools/companion/dist/core.js';
import { coordinate, snapshot } from '../../tools/companion/dist/coordinate.js';
import { groqWorker } from '../../tools/companion/dist/groq.js';

const files = ['eslint.config.mjs', 'index.html', 'package.json', 'src/Input.tsx', 'src/main.tsx', 'src/tokens.css', 'tsconfig.json', 'vite.config.ts'];
const criteria = ['scope', 'typecheck', 'lint', 'build', 'browser'];
const baselineInputHash = '9106baad186ae9b71ef4710c11133b264e432184ed7cf4087d883ebff1bd0310';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const assertPrivateFile = file => {
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || (st.mode & 0o777) !== 0o600 || st.uid !== process.getuid()) throw Error('Private input file required');
};
const assertPrivateDir = dir => {
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || st.uid !== process.getuid()) throw Error('Private output directory required');
};
function checkedTask(contractFile, approvalFile) {
  assertPrivateFile(approvalFile);
  const contract = readJson(contractFile), approval = readJson(approvalFile);
  if (JSON.stringify(contract.allowedFiles) !== JSON.stringify(['src/Input.tsx']) || JSON.stringify(contract.criteria) !== JSON.stringify(criteria)) throw Error('Only the synthetic Input contract is supported');
  const state = createState(contract), source = snapshot(contract.projectRoot, files);
  if (state.contractHash !== approval.contractHash || source.revision !== contract.baseRevision || source.hashes['src/Input.tsx'] !== baselineInputHash || source.hashes['src/Input.tsx'] !== contract.sourceHashes['src/Input.tsx'] || approval.model !== 'openai/gpt-oss-120b') throw Error('Task, source or model changed');
  const worker = groqWorker({ apiKey: 'PREFLIGHT_ONLY', model: approval.model, accessVerified: false, costApproved: false, observedAt: '', approval });
  return { contract, approval, source, approved: worker.preflight?.(contract) === true };
}
function keyFromPrivateEnv(file) {
  assertPrivateFile(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let raw;
  try { raw = fs.readFileSync(fd, 'utf8'); } finally { fs.closeSync(fd); }
  const line = raw.split(/\r?\n/).find(value => /^GROQ_API_KEY\s*=/.test(value));
  raw = undefined;
  const key = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  if (!key || /\s/.test(key)) throw Error('Credential unavailable');
  return key;
}
const [mode, ...args] = process.argv.slice(2);
if (mode === 'preflight') {
  const [contractFile, approvalFile] = args;
  if (!contractFile || !approvalFile) throw Error('Usage: preflight <contract.json> <private-approval.json>');
  const { contract, approval, source, approved } = checkedTask(contractFile, approvalFile);
  console.log(JSON.stringify({ taskId: contract.taskId, sourceRevision: source.revision, model: approval.model, attempts: contract.maxAttempts, maxOutputTokens: contract.maxOutputTokens, sourceSharingApproved: approved, accessVerified: approval.accessVerified === true, costApproved: approval.costApproved === true, providerCalled: false }));
} else if (mode === 'execute') {
  const [contractFile, approvalFile, keyFile, depsArg, outputArg] = args;
  if (!outputArg) throw Error('Usage: execute <contract.json> <private-approval.json> <private-key.env> <reviewed-node_modules> <new-output-dir>');
  const { contract, approval, approved } = checkedTask(contractFile, approvalFile);
  if (!approved || approval.accessVerified !== true || approval.costApproved !== true || !approval.observedAt) throw Error('Exact task, access and cost decision required');
  const reservation = `${approvalFile}.used`;
  if (fs.existsSync(reservation)) throw Error('Task approval already reserved; no replay');
  const deps = fs.realpathSync(depsArg), out = path.resolve(outputArg);
  if (!fs.statSync(deps).isDirectory() || fs.existsSync(out)) throw Error('Reviewed dependencies and new output directory required');
  fs.mkdirSync(out, { mode: 0o700 });
  assertPrivateDir(out);
  const apiKey = keyFromPrivateEnv(keyFile);
  const worker = groqWorker({ apiKey, model: approval.model, accessVerified: true, costApproved: true, observedAt: approval.observedAt, approval });
  // Reserve before any transport. An interruption conservatively spends this approval.
  fs.writeFileSync(reservation, JSON.stringify({ contractHash: approval.contractHash, output: out, at: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
  const state = prepare(createState(contract)), stateFile = path.join(out, 'state.json'), save = next => persist(stateFile, next);
  save(state);
  const verify = async candidate => {
    fs.symlinkSync(deps, path.join(candidate.directory, 'node_modules'), 'dir');
    fs.writeFileSync(path.join(out, `scope-${candidate.revision}.json`), JSON.stringify({ changedFile: 'src/Input.tsx', sourceRevision: contract.baseRevision, candidateRevision: candidate.revision }), { mode: 0o600 });
    const checks = [{ criterion: 'scope', result: 'PASS', reason: 'Only the approved Input source may be replaced' }];
    const commands = [
      ['typecheck', 'typescript/bin/tsc', ['--noEmit']],
      ['lint', 'eslint/bin/eslint.js', ['src/Input.tsx']],
      ['build', 'vite/bin/vite.js', ['build']],
    ];
    for (const [criterion, program, argv] of commands) {
      const result = spawnSync(process.execPath, [path.join(deps, program), ...argv], { cwd: candidate.directory, encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024, env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: out, TMPDIR: out, LANG: 'C', CI: '1' } });
      const ok = result.status === 0 && !result.error;
      fs.writeFileSync(path.join(out, `${criterion}-${candidate.revision}.json`), JSON.stringify({ exitCode: result.status, failed: !ok, stdout: result.stdout?.slice(0, 8000), stderr: result.stderr?.slice(0, 8000) }), { mode: 0o600 });
      checks.push({ criterion, result: ok ? 'PASS' : 'FAIL', reason: ok ? `${criterion} passed` : `${criterion} failed` });
    }
    fs.writeFileSync(path.join(out, `browser-pending-${candidate.revision}.json`), JSON.stringify({ revision: candidate.revision, result: 'UNKNOWN', reason: 'Real Chrome review pending' }), { mode: 0o600 });
    checks.push({ criterion: 'browser', result: 'UNKNOWN', reason: 'Real Chrome review pending' });
    return checks.map(check => ({ ...check, revision: candidate.revision, artifact: path.join(out, `${check.criterion === 'browser' ? 'browser-pending' : check.criterion}-${candidate.revision}.json`), actor: 'independent' }));
  };
  const result = await coordinate({ state, worker, files, candidateParent: out, save, verify });
  fs.writeFileSync(path.join(out, 'candidates.json'), JSON.stringify(result.candidates), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ ...statusView(state), candidates: result.candidates.map(candidate => ({ directory: candidate.directory, revision: candidate.revision })) }));
} else if (mode === 'record-browser') {
  const [outputArg, receiptFile] = args;
  if (!receiptFile) throw Error('Usage: record-browser <existing-output-dir> <private-browser-receipt.json>');
  const out = fs.realpathSync(outputArg);
  assertPrivateDir(out);
  assertPrivateFile(receiptFile);
  const stateFile = path.join(out, 'state.json'), state = restore(stateFile), candidates = readJson(path.join(out, 'candidates.json'));
  const candidate = candidates.at(-1), receipt = readJson(receiptFile);
  const receiptPath = fs.realpathSync(receiptFile);
  if (!receiptPath.startsWith(out + path.sep) || !candidate || !fs.realpathSync(candidate.directory).startsWith(out + path.sep) || candidate.revision !== state.revision || receipt.revision !== state.revision || !['PASS', 'FAIL', 'UNKNOWN'].includes(receipt.result) || typeof receipt.reason !== 'string' || !receipt.reason.trim()) throw Error('Stale or incomplete browser receipt');
  if (snapshot(candidate.directory, files).revision !== state.revision || snapshot(state.contract.projectRoot, files).revision !== state.contract.baseRevision) throw Error('Source or candidate changed');
  const checks = state.evidence.map(check => check.criterion === 'browser' ? { ...check, result: receipt.result, reason: receipt.reason, artifact: receiptPath } : check);
  applyEvidence(state, checks);
  persist(stateFile, state);
  console.log(JSON.stringify(statusView(state)));
} else {
  throw Error('Use preflight, execute or record-browser');
}
