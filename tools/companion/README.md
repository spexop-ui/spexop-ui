# Small local companion loop

Owner-approved direction: ADR-023 / merged PR #12. This module coordinates one local
UI task. It is not a general scheduler, chat IDE or product acceptance authority.

- KEEP: worker boundary, allowed-file validation, independent evidence, revision IDs,
  bounded retry, atomic state/recovery and read-only status view.
- SIMPLIFY: the former fixed ten-entry/thirteen-exit schema is superseded. A task's
  small `criteria` list drives its gate; named milestone gates reduce PASS/FAIL/UNKNOWN.
- DEFER: a real provider connection and a native desktop framework.

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
harness. Real API execution, M5 product acceptance and public/npm/release remain open.
Theme/Foundation/CSS Export/Build Evidence and prior NO-GO records are unchanged.
