# Small local companion loop

Owner-approved direction: ADR-023 / merged PR #12. This module coordinates one local
UI task. It is not a general scheduler, chat IDE or product acceptance authority.

- KEEP: worker boundary, allowed-file validation, independent evidence, revision IDs,
  bounded retry, atomic state/recovery and read-only status view.
- SIMPLIFY: the former fixed ten-entry/thirteen-exit schema is superseded. A task's
  small `criteria` list drives its gate; named milestone gates reduce PASS/FAIL/UNKNOWN.
- DEFER: a native desktop framework and external product acceptance.

`core.ts`: create/prepare task → bounded worker call → validate output → independent
checks → TESTED (test double) or VERIFIED (API adapter) / FAILED / UNVERIFIED. Missing
API access stays BLOCKED/NOT_CONFIGURED without blocking local test development.
Worker output alone never passes its own checks. Retries require an explicit transition
or bounded coordinator policy, with failed-criterion feedback to the next attempt.

`coordinate.ts`: snapshot explicit source inventory → fresh private candidate copy →
apply only allowed edits → main-agent-owned verifier → rehash source and candidate →
current-revision gate result. Candidate revision covers the entire selected inventory;
the patch identity and baseline identity remain separate. Source files are preserved.
The worker returns data, not commands. The caller owns trusted build/browser procedures.
This is not a sandbox for hostile in-process callback code. API adapters have no local
filesystem tool. A verifier may create dependency links/build outputs outside the
selected source inventory; this does not authorize worker edits to them.

`provider.ts`: explicit NOT_CONFIGURED adapter plus a small JSON boundary for a
user-authorized transport. No provider/model search, credential discovery, network
request, paid fallback or default API is built in. Transport tests use doubles.

`groq.ts`: fixed-endpoint Groq chat-completion transport behind that boundary.
The caller supplies a credential, model, verified-access and cost decision, and an
exact-task approval covering the contract hash, model, file hashes, attempt count,
output-token limit, prompt-byte limit and retry-feedback sharing. The API key stays
in memory and is never written to the task journal or status panel. The request
sends only the approved task text, criteria,
allowed source files and bounded retry feedback; it does not send the absolute
project path. A changed source, missing approval, missing token limit or oversized
prompt blocks before any request. HTTP redirects, tool calls, automatic retries and
provider fallback are disabled. Only a bounded JSON file replacement is accepted;
usage counts are kept with the local attempt. A prompt-byte limit is not an exact
input-token count, so the provider's returned token usage must be reviewed.
The approval's `contractHash` is the `contractHash` returned by `createState` for
the exact task contract; changing its instruction, source or limits requires a new
approval. Do not enable a real call merely because the offline transport tests pass.

Offline transport tests exercise the coordinator without a real provider call.
No authorized live product run or external consumer acceptance is recorded here.
An API task reaching `VERIFIED` means only its independent local criteria passed;
it does not grant M5, desktop, product or release acceptance.

`persist`/`restore`: atomic checksummed local journal. Interrupted RUNNING restores
UNVERIFIED and requests review. A local checksum is not cryptographic attestation;
private caller-owned directories and a single writer are required.

`panel.ts`: read-only loopback status surface showing the actual journal, execution
kind, attempts, gate criteria, blocked/escalation message and optional history.
No launch/write endpoint. Unreadable state displays UNKNOWN and clears stale details.
Run after build: `pnpm companion:status /absolute/path/state.json`. This browser-window
prototype is the first local desktop status surface; native window/always-on-top and
automatic startup are deferred. Do not claim a packaged desktop app or product acceptance.

See `examples/companion-journey` for the trusted Fieldwork test-double acceptance
harness. Authorized live product API execution, M5 product acceptance, desktop and
npm/release remain open.
Theme/Foundation/CSS Export/Build Evidence and prior NO-GO records are unchanged.
