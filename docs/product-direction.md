# Product direction: Agent-native UI Verification

Decision: 27 October 2026. Spexop UI is a free, open-source toolkit for checking an agent's UI work in a real browser and returning evidence the agent can use to fix it. The agent owns application code and fixes. Spexop observes the running UI, verifies supported deterministic checks, returns findings, and reruns the checks after changes. A successful check is evidence for its stated scope, not product acceptance or a guarantee of visual quality.

## R1: a small, honest verification loop

1. Connect to an already running application URL and inspect a specified route and viewport in a real browser.
2. Run a bounded set of trustworthy deterministic UI diagnostics. Each check must define its inputs, applicability, evidence, and limitations; unsupported or failed observation must not become a pass.
3. Return agent-readable findings with enough evidence to locate and understand the issue, including route, viewport, check, observed result and relevant element or measurement where available. Record run context and distinguish findings, errors and unknowns.
4. The agent makes changes and explicitly reruns verification. Report whether previously observed findings recur or are resolved within the same comparable scope; do not infer a fix from a missing or failed check.

A CLI or other direct local invocation can provide the loop; an MCP adapter is optional and must call the same verification core. Screenshots may support evidence but are not an aesthetic verdict. Observation is requested at checkpoints; there is no claim of continuous agent perception or automatic invocation.

R1 excludes a new renderer, design-system generator, component library, visual aesthetic judge, AI API or SaaS dependency, mandatory CI blocker and premature file watcher. Starting or managing the application's server is not required. Authentication, route readiness, dynamic content, browser failures and environmental variation must be surfaced honestly. The exact first checks and evidence schema require implementation and evaluation; this decision does not claim they exist today.

## Existing investment

Theme, Canonical Design Model, Foundation Capture, CSS Export, Build Context, Build Evidence, provenance and their tests remain intact. Capture and model data may inform later checks where useful, but are not prerequisites for the first browser loop. CSS Export and Build Evidence are off the R1 critical path; their existing limits and historical results remain valid within their original scopes. No source is removed by this decision.

## Later, conditional directions

R1.1 may explore project consistency after the R1 loop is useful and trustworthy, with explicit rules and false-positive evaluation. R2 may explore executable contracts after value, semantics and enforcement boundaries are demonstrated. Neither is an accepted implementation or release commitment. Protected CI and independent assurance remain separate potential work, not an R1 requirement. Public/npm release still requires the existing security, rights, provenance and owner gates.
