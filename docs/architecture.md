# Verification architecture

The target flow is **Observe → Verify → Feedback → agent fixes → retest**. This is a direction, not a claim that the implementation exists.

- **Observe:** connect to the user-specified running app, route and viewport; use a real browser to collect bounded runtime evidence. Record context and observation failures.
- **Verify:** deterministic, explicitly scoped checks consume observations. Check definitions must distinguish an actionable finding from unsupported, indeterminate and execution error.
- **Feedback:** structured, agent-readable output carries check identity, route, viewport, evidence and location where available, plus a human-readable explanation. Evidence should be sufficient to reproduce a finding without asserting an unverified source mapping.
- **Retest:** compare compatible runs after the agent changes code; preserve run identity and explain changed scope, missing checks and uncertain results.

The agent edits the application; Spexop does not silently apply fixes. A local entry point invokes the core. MCP is an optional adapter, not a separate source of verification truth. Browser screenshots and DOM/measurement data are evidence, not a visual taste model. Browser infrastructure and exact diagnostic rules are implementation choices to validate, not completed features.

Existing Theme and Foundation tools remain separate assets. Canonical capture may supply contextual evidence when appropriate; CSS export, build context and build evidence retain their own documented boundaries. A build receipt, browser observation, source mapping, behavioral equivalence, independent verification and owner acceptance are distinct claims. No new renderer or app server lifecycle is required for R1.
