# 005J CSS equivalence contract — before implementation

Source preservation: canonical declaration IDs/names/raw values/references/type evidence and file hashes remain. Opt-in CSS context capture additionally records ordered layer blocks (including anonymous/nested/empty introductions), order statements and source rule/declaration slots. Unknown raw values remain unknown; no color inference for channel fragments.

Structural equivalence: opt-in native-context export preserves supported root/dark selectors, declaration ordering, layer identity/hierarchy/order and lexical references. It does not evaluate the cascade, flatten aliases, or make new resolved claims. Ordinary rules are NOT token output; source CSS remains required. Empty layer introductions and order statements must survive extraction. Missing/cyclic/unsafe names/registration remain unsupported. CSS-wide/derived/fallback expressions remain outside this slice.

Behavioral equivalence: observed only for explicitly listed elements/properties under identical DOM, browser, viewport, mode and stylesheet order/slots. Source versus canonical output controls must contain identical retained non-token/excluded CSS. No additive duplicate-only experiment. Wrong-layer or wrong-order negative controls must produce detected mismatches. Successful parsing alone is never equivalent.

Coverage: count source declarations, export-eligible/excluded, references and contexts separately. Layer support is native CSS only; @tailwind/@apply/@theme/@reference/compiler directives and import-dependent layer ordering cannot be guessed. Existing compiler output can be an explicitly separate input with build/source provenance; compiled counts do not replace raw-source baselines.

Ordering: single-file order is observed. Multi-file concatenation requires an exact explicit sourceOrder list, recorded as caller-asserted, not automatically proven from filenames. Browser acceptance compares this list to actual load order. Unknown multi-file order blocks native output. Imports are not followed; relative-resource values cannot be relocated blindly.

Safety: default legacy bounded exporter unchanged. Native-context mode requires explicit capture metadata and plan option; no new model, framework rule or Theme mapping. Preview read-only, partial consent explicit, writer exclusive new output directory. Source hashes and unchanged files independently checked. M3 UX remains separate.

References verified 2026-10-26: CSS Variables L1 (2022-06-16), Cascade5 (2022-01-13), Values4 WD (2024-03-12), Color4 CRD (2026-10-26), CSSOM WD (2021-08-26), TypedOM1 WD (2024-03-21), Tailwind current v4.3 theme documentation. Detailed URLs/status in standards-review.md. No full-standard conformance claimed.
