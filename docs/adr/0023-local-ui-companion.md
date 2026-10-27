# ADR-023: local UI/UX companion

- Date: 2026-10-27
- Status: Owner-approved product direction; implementation, product acceptance and release acceptance open.
- Revision: Owner supersession of the earlier agent-native UI verification-only proposal in Draft PR #12. Observe → Verify → Feedback → agent fixes → retest is retained as a verification subflow.

## Context

The private repository contains Theme and Foundation code, canonical capture, provenance, CSS Export, Build Evidence and tests. Prior M3 UX and source-to-browser provenance NO-GO evidence remains valid. The initial PR #12 described a browser verification toolkit; the owner then approved a broader but strictly UI/UX local companion coordinating inexpensive routine implementation and independent gate verification around an existing strong coding agent.

## Decision

Adopt [product direction](../product-direction.md) and the [R1 slice](../roadmap.md): one local project, one active milestone, minimal gates/tasks, one connected available free/low-cost API worker and one main-agent interface. The main agent owns planning, architecture, design judgment, risk and oversight. Spexop schedules bounded background worker tasks in isolated scopes, independently checks outputs with deterministic tests and real-browser Playwright as required, records revision-bound PASS/FAIL/UNKNOWN evidence, enforces gate-based acceptance, escalates ambiguity and risk, and displays simple continuous desktop progress/blocked/needs-user-action status.

The first acceptance target is one Button/Input/Select end-to-end scenario. Report missing APIs without implementing a general backend. Free models are not guaranteed. No paid API, cloud or SaaS is mandatory. Protect secrets and permissions. Keep the user's main conversation with the existing coding agent; do not build another chat IDE or general PM/multi-agent platform.

## Consequences and evidence boundary

Reuse and preserve Theme, Canonical Model, Foundation Capture, provenance, CSS Export, Build Evidence and tests. CSS Export and Build Evidence are not R1 prerequisites. Worker completion, deterministic/browser PASS, gate acceptance, independent assurance, product acceptance and release approval are different states. Unknown or missing checks cannot be promoted to PASS. Historical 005I–005L/M3 NO-GO findings are preserved, not overturned by this decision. Public/npm/deploy/security/rights gates remain separate.
