# SPX-OSS-005J verification boundary

PR #8 was merged by the owner into private main `d91ee05a2d89fe3166d36c51192da4dccfc20920`, identical content to accepted `fb8c54ba`. Main passed 332 local tests. The previous independent user experience NO-GO remains historical evidence.

The native context option adds source-bound CSS structure, not a new cascade evaluator or Theme schema. Local build/typecheck/lint and 369 tests pass, including 29 independent adversarial tests. Initial metadata injection and alternate `var` spelling failures were retained and fixed; follow-up omitted-record/registration/escape/BOM checks pass. A second local reviewer reviewed the bounded implementation. No GitHub Actions or Copilot review was requested.

| Pinned source | Capture | Existing default CSS | New native mode without import/order assumptions |
| --- | ---: | ---: | --- |
| Fieldwork | 30 | 29 | blocked: source order unknown |
| shadcn-admin | 92 | 47 | blocked: order/compiler/import |
| tailadminlte-react | 35 | 0 | blocked: order/compiler/import |
| Pomify | 155 | 79 | blocked: compiler/import |
| FocusForge | 62 | 0 | blocked: order/compiler/import |

All 374 source declarations survive. Default capture, plan and CSS hashes of the four historical projects are unchanged. Native eligible counts are not generated counts when a global blocker exists. This deliberately does not turn sorted filenames into cascade evidence.

Generic Chromium proof: same DOM, two stylesheet slots, 800×600 viewport, light/dark, 10 computed properties. Source and canonical match; deliberately flattened layers alter background and reversed file order alters border width. Named/nested/anonymous layers and raw HSL channels are exercised. Eligible generated declaration nodes are inserted at their original slots; ordinary/excluded nodes and anonymous layer identity remain. Full stylesheet replacement is not claimed.

FocusForge's existing Vite/Tailwind 3 build produces a separate one-stylesheet artifact: 192 captured declarations, 39 exported, 153 retained excluded. This is compiler-output evidence, not the raw 62/0 baseline. The generic acceptance script compares the complete compiled AST, then serves source/canonical variants. It does not edit application source or imports. UI acceptance is recorded separately in the task evidence; do not infer novice onboarding success from this experiment.

Local artifacts under `outputs/oss-005j/` in the engineering workspace include the contract, fixed source manifests, native/default matrices, initial failures, independent reviews, clean-install checks and browser observations. Engineering Master remains the roadmap/gate authority. Public/npm and M3 owner acceptance remain separate.
