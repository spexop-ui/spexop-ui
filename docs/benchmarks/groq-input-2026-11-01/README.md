# Groq synthetic Input benchmark — 2026-11-01

Related: [issue #16](https://github.com/spexop-ui/spexop-ui/issues/16). This synthetic benchmark was run privately; its sanitized fixture and evidence are now public. It is not product worker integration or release acceptance.

## Boundaries and setup

- Only newly written, shareable React/TypeScript fixture files were sent. No Spexop source, customer data, credential, or repository history was in the prompt.
- Official `groq-sdk@1.6.0`, `openai/gpt-oss-120b`; account UI showed this model under the $0 Free plan before the run. The per-request monetary charge was not independently verified.
- One initial inference and one correction inference, no retries or paid fallback. Each request had a 120-second timeout and 3,500 maximum output tokens.
- Only `src/Input.tsx` was allowed to change. Baseline SHA-256: `9106baad186ae9b71ef4710c11133b264e432184ed7cf4087d883ebff1bd0310`.
- The task contract, sanitized request metadata, baseline Input, and final candidate are in `evidence/` and `fixture/`. Request IDs and hashes permit cross-checking against private provider records. Credentials and raw prompts are omitted.

## Result

| Attempt | SDK response | Wall time | Prompt / completion / total tokens | Scope | Independent result |
| --- | --- | ---: | ---: | --- | --- |
| Initial | received, finish `stop` | 4,018 ms | 755 / 1,402 / 2,157 | Only `Input.tsx` | Typecheck and build passed; targeted lint failed on unused `e` |
| Correction | received, finish `stop` | 2,509 ms | 1,284 / 886 / 2,170 | Only `Input.tsx` | Typecheck, targeted lint, and build passed; seven Chrome behavior checks passed |

Total reported tokens: 4,327. Total measured request wall time: 6,527 ms. The final candidate SHA-256 is `618cbe117de32f7b77dd3e88387313fe22fb13cab2a51398539c1accc17f2bb2`.

The Chrome checks used a fresh, isolated real Google Chrome session against the local Vite fixture: initial no error; invalid text hidden before blur; invalid text shown after blur; valid text clears error; invalid edit after blur shows immediately; whitespace remains optional; initially disabled field shows no error. They did not use a mocked DOM.

**Acceptance: partial.** Source review found an uncovered transition: if a field already shows an error and its parent changes `disabled` to `true`, `showError` remains derived from stale `error` state. Thus the requirement that a disabled field *never* display validation errors is not fully met. The candidate is retained exactly as generated for honest measurement; it is not merged into a product package.

## Reproduction and limits

`fixture/` is a standalone synthetic Vite app with exact dependency versions in `package.json`. From that directory, install dependencies with `npm install --ignore-scripts`, then run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run dev`. The supplied `src/Input.tsx` is the corrected candidate; replace it with `evidence/baseline-Input.tsx` to recover the initial fixture. Use the contract in `evidence/task-contract.json` for a new bounded model run. Such a run will be a new sample, not a replay of the original response.

The local verification used Node 22.23.4, TypeScript 5.9.3, React 18.3.1, Vite 8.3.5, ESLint 10.13.0 and typescript-eslint 8.72.0. The standalone manifest was prepared after the run, and a fresh install of it was not completed in this session because package registry access stalled; the original checks used an existing local dependency tree. The repository does not include `node_modules`, credentials or raw provider responses. A separate bounded transport is being developed in [issue #18](https://github.com/spexop-ui/spexop-ui/issues/18); it was not part of this benchmark.

This benchmark establishes that one real inference path responded and a corrected synthetic candidate passed the listed checks. It does not establish repeatability, provider availability, billing, product integration, G-VERIFY, G-EXTERNAL-ACCEPT, M5 or release acceptance. Any adapter decision requires a separate issue and additional evidence.
