# ADR: Agent-native UI Verification

- Date: 2026-10-27
- Status: Accepted product direction; implementation and release acceptance remain open.

## Context

The existing private repository contains Theme and Foundation work, including capture, CSS export and bounded build evidence. That work has useful tests and provenance but does not establish a working general UI verification product. The prior Foundation-first sequence made CSS transformation and source-to-browser evidence appear to block progress toward runtime verification.

## Decision

Spexop UI focuses on the Observe → Verify → Feedback → agent fixes → retest loop described in [product direction](../product-direction.md). R1 targets a running URL, route and viewport, real-browser observation, reliable deterministic diagnostics, evidence-bearing agent-readable findings and explicit rerun confirmation. MCP is optional. The agent remains responsible for fixing code.

Preserve existing Theme, canonical model, Foundation Capture, provenance and tests. CSS Export and Build Evidence leave the R1 critical path; their work and evidence are retained, with no change to their historical acceptance boundaries. No code is deleted by this decision. R1.1 project consistency and R2 executable contracts are conditional later directions.

## Consequences

Do not require a new renderer, DS generator, component library, aesthetic judge, AI API/SaaS, CI blocker or file watcher in R1. Do not equate a local run with independent acceptance, or a screenshot with an aesthetic assessment. The precise diagnostic set, error semantics, comparisons and validation plan remain to be designed and tested. Existing release/security/rights gates and owner authority remain in force. This decision supersedes the previous sequencing where Foundation/CSS source provenance blocked the initial runtime loop; it does not erase earlier ADRs or evidence.
