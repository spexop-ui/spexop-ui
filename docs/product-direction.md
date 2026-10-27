# Product direction: local UI/UX companion

Decision: 27 October 2026. This owner-approved decision supersedes the earlier verification-only direction in [ADR-023](adr/0001-agent-native-verification.md). Spexop is a local-first, free OSS desktop companion coordinating **UI/UX development**. The user's main conversation stays with an existing strong coding agent. That agent owns planning, architecture, design judgment, risky decisions and oversight. Spexop is a small execution and evidence loop, not another chat IDE or general PM/multi-agent platform.

## R1: one narrow end-to-end slice

One local project, one active milestone, minimal gates and tasks, one user-connected available free/low-cost LLM API worker, and one main-agent interface. Begin with one Button/Input/Select scenario. Expansion requires acceptance of this slice.

1. The main agent gives a bounded routine UI task with allowed files, expected behavior, budget and stop conditions. Spexop schedules background execution only within that scope. Worker changes are isolated and reviewable; workers cannot widen permissions or accept their own work.
2. Spexop maintains minimal Milestone/Gate/Task status and an always-visible simple desktop view of progress, blocked reason and needs-user-action state.
3. Deterministic checks independently verify output; use real-browser Playwright where rendered UI or interactions require it. Bind evidence to revision, environment, check and artifact. Report PASS, FAIL or UNKNOWN. Skipped, unsupported, stale or failed checks are UNKNOWN, never PASS.
4. Gate-based acceptance compares evidence with explicit criteria. Escalate ambiguity, design judgment, risk and exceptions to the strong main agent or user. Worker completion, test PASS, browser observation, gate acceptance, product acceptance and release approval remain distinct.
5. Report API gaps without building a general backend. Free models and their prices/availability are external conditions, not promises or mandatory dependencies.

## Reuse and boundaries

Preserve and reuse Theme, Canonical Model, Foundation Capture, provenance, CSS Export, Build Evidence and tests where useful. CSS Export and Build Evidence are not R1 prerequisites. Historical verification NO-GO evidence keeps its original scope. Protect secrets and local files with least privilege, scoped permissions and redacted logs. No mandatory paid API, cloud, SaaS, extra dashboard, new renderer or DS generator.

Observe → Verify → Feedback → agent fixes → retest remains a verification step inside this companion workflow, not the whole product. Project consistency and executable contracts remain conditional later research. Public repo, npm, deployment and release require separate security, rights, provenance and owner decisions.
