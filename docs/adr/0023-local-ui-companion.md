# ADR-023: local UI/UX companion

- Date: 2026-10-27
- Status: Owner-approved product direction; implementation, product acceptance and release acceptance open.
- Revision: Owner supersession of the earlier agent-native UI verification-only proposal in merged PR #12. This ADR-023 file was renamed from `0001-agent-native-verification.md`; its Git history preserves the previous proposal. Observe → Verify → Feedback → agent fixes → retest is retained as a verification subflow.

## Context

The private repository contains Theme and Foundation code, canonical capture, provenance, CSS Export, Build Evidence and tests. Prior M3 UX and source-to-browser provenance NO-GO evidence remains valid. The initial PR #12 described a browser verification toolkit; the owner then approved a broader but strictly UI/UX local companion coordinating inexpensive routine implementation and independent gate verification around an existing strong coding agent.

## Decision

Adopt [product direction](../product-direction.md) and the [R1 gates](../roadmap.md): one local project, one active milestone, minimal gates/tasks, a product-runtime API worker boundary and one main-agent interface. The main agent owns planning, architecture, design judgment, risk and oversight. The product-runtime LLM API worker is distinct from Codex/Astra development agents and workers; choosing its provider does not block Spexop implementation. Spexop schedules authorized bounded background tasks in isolated scopes, independently checks outputs with deterministic tests and real-browser Playwright as required, records revision-bound PASS/FAIL/UNKNOWN evidence, escalates ambiguity and risk, and displays desktop progress/blocked/needs-user-action status.

The first acceptance target is one Button/Input/Select end-to-end scenario. Task budget means allowed run/time/token limits, not billing, subscription or budget management. Report missing APIs without implementing a general backend or silently falling back to a paid model. Free models are not guaranteed. No paid API, cloud or SaaS is mandatory. Protect secrets and permissions. Keep the user's main conversation with the existing coding agent; do not build another chat IDE or general PM/multi-agent platform.

## Consequences and evidence boundary

Reuse and preserve Theme, Canonical Model, Foundation Capture, provenance, CSS Export, Build Evidence and tests. CSS Export and Build Evidence are not R1 prerequisites. G-VERIFY records internal technical verification in the development repository. External Product Acceptance is a separate owner gate: install a versioned private build in a separate consumer UI repository and run a fresh coding agent without Spexop-development instructions/history through the authentic main-agent planning → authorized live product API worker → gate tracking → independent verification → usable desktop status/blocked handling flow. Exercise negative paths and bind evidence to package version, consumer revision, environment and artifacts. Required skipped/unsupported or browser-unavailable checks are UNKNOWN; genuine NOT_APPLICABLE optional checks are excluded, neither PASS nor gate blockers. Merged PR #13's test-double, internal Chrome checks and loopback browser panel are technical prototype evidence, not a product API worker, packaged desktop or external product acceptance. Worker completion, deterministic/browser PASS, either gate's acceptance and release approval are different states. Historical 005I–005L/M3 NO-GO findings are preserved, not overturned by this decision. Public/npm/deploy/security/rights gates remain separate.
