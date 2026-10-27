# Local companion architecture boundary

This is the owner-approved target, not an implemented system. The existing strong coding agent is the primary user interface and owns planning, architecture, UI/UX judgment, risk and oversight. Spexop exposes a small local handoff/evidence interface. Its desktop surface shows one active milestone, current task, gate state, progress, blocked reason and needs-user-action state.

The first slice has one local project, one active milestone, a minimal Gate/Task ledger, one connected user-supplied API worker and one main-agent interface. A task contract specifies allowed paths, requested UI behavior, run/budget limits, stop conditions and acceptance checks. Background scheduling starts only bounded work. Worker changes stay isolated and reviewable. Secrets remain local and redacted; permissions are explicit and scoped.

Verification is Observe → Verify → Feedback → main-agent fix or bounded worker retry → retest. Deterministic checks and real-browser Playwright, when required, bind outcomes to source revision, route, viewport, fixture, check version and artifact. Every check reports PASS, FAIL or UNKNOWN with reasons. Missing browser access, stale evidence, unsupported checks and incomplete runs cannot pass a gate. The ledger records evidence and acceptance authority separately.

API availability, model cost/limits and handoff capabilities must be probed and reported as gaps. Do not create a general backend, chat IDE, cloud coordinator or broad multi-agent system to work around a gap. Existing Theme/Foundation assets may be reused under their provenance and license boundaries; CSS Export and Build Evidence are optional for R1. Their historical NO-GO findings remain intact.
