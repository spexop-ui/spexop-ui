# Roadmap

The 27 October 2026 owner decision is in [product direction](product-direction.md) and [ADR-023](adr/0023-local-ui-companion.md). These are targets, not implementation claims. Merged PR #13 contains an internal test-double coordination and loopback-panel prototype; the separate synthetic Groq benchmark in PR #17 has partial acceptance. A real product API worker, installable desktop build and external consumer acceptance remain open.

## Current tracking

The public [M5 milestone](https://github.com/spexop-ui/spexop-ui/milestone/1) remains open. [Issue #18](https://github.com/spexop-ui/spexop-ui/issues/18) tracks the next bounded product API worker integration. The existing [Project #5](https://github.com/orgs/spexop-ui/projects/5) is private maintainer execution tracking; the Engineering Master is the canonical management record. The [website roadmap](https://spexop.com/roadmap/) presents the same development stages for visitors. None of these records is a product release or acceptance claim.

| Stage | Narrow deliverable | Exit gate |
| --- | --- | --- |
| R1a — internal technical verification (G-VERIFY) | One local project and active milestone; minimal Gate/Task ledger; bounded task and worker boundary; independent deterministic and required real-browser checks; local status prototype | Scope and negative/blocked paths checked against a revision. Required skipped/unsupported/browser-unavailable checks are UNKNOWN; genuine NOT_APPLICABLE optional checks are excluded. Merged PR #13's test-double and loopback-panel evidence is internal only; product API integration and packaged desktop remain open. |
| R1b — External Product Acceptance | Versioned privately distributed test build installed in a separate consumer UI repository; fresh coding-agent context without Spexop-development instructions/history; authorized live product API worker and usable desktop companion | Authentic Button/Input/Select user flow: strong main agent plans, bounded worker runs, gate state is tracked, independent checks produce revision-bound PASS/FAIL/UNKNOWN, desktop progress/blocked/needs-user-action survives restart, and negative paths are observed. Record package version, consumer revision, environment and artifacts; owner accepts after reviewing evidence. Internal test PASS is insufficient. No public npm/release required. |
| R1.1 — controlled expansion | More UI tasks/components only after External Product Acceptance and measured worker reliability | New scope and risks explicitly accepted. |
| Later research | Project consistency and executable contracts | Separate evidence and owner decision; no release commitment. |

The main agent plans and decides; a separate product-runtime API worker implements authorized bounded routine work. Codex/Astra development agents can implement the product before a runtime provider is selected. Task budget means allowed run/time/token limits, not billing or subscription management. An unavailable model or API gap appears as blocked or needs user action, with no silent paid fallback. No general backend, cloud, extra dashboard or separate chat IDE is required.

Theme, Canonical Model, Foundation Capture, provenance, CSS Export, Build Evidence and tests remain available. CSS Export and Build Evidence do not block R1. Historical M3 UX and source-to-browser provenance NO-GO evidence remains open in its original scope. Technical PASS is neither product nor release acceptance. Public source is available; npm publication, desktop delivery, external acceptance and release approval remain separate.
