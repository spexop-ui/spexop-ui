# Roadmap

The 27 October 2026 owner decision is in [product direction](product-direction.md) and [ADR-023](adr/0001-agent-native-verification.md). These are targets, not implementation claims.

| Stage | Narrow deliverable | Exit gate |
| --- | --- | --- |
| R1 — local companion slice | One local project and active milestone; minimal Gate/Task ledger; one connected API worker and main-agent interface; bounded background UI task; always-visible desktop status | One Button/Input/Select scenario completed in isolation, independently checked with deterministic tests and real-browser Playwright where needed, with revision-bound PASS/FAIL/UNKNOWN evidence and authorized gate acceptance. Negative and blocked paths demonstrated. |
| R1.1 — controlled expansion | More UI tasks/components only after R1 acceptance and measured worker reliability | New scope and risks explicitly accepted. |
| Later research | Project consistency and executable contracts | Separate evidence and owner decision; no release commitment. |

The main agent plans and decides; the worker implements bounded routine work. An unavailable model or API gap appears as blocked or needs user action, not a silent paid fallback. No general backend, cloud, extra dashboard or separate chat IDE is required.

Theme, Canonical Model, Foundation Capture, provenance, CSS Export, Build Evidence and tests remain available. CSS Export and Build Evidence do not block R1. Historical M3 UX and source-to-browser provenance NO-GO evidence remains open in its original scope. Technical PASS is neither product nor release acceptance. Public/npm/deploy gates remain separate.
