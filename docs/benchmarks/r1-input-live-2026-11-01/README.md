# R1 bounded worker live probe — 2026-11-01

Related: [issue #18](https://github.com/spexop-ui/spexop-ui/issues/18), [draft PR #19](https://github.com/spexop-ui/spexop-ui/pull/19). This is one owner-authorized, synthetic local probe of the proposed Groq adapter. It is not product acceptance.

## Reviewed boundary

- The submitted source was only the public synthetic `src/Input.tsx` baseline from [the earlier benchmark](../groq-input-2026-11-01/README.md), 479 bytes, SHA-256 `9106baad186ae9b71ef4710c11133b264e432184ed7cf4087d883ebff1bd0310`. The task text and correction feedback described only that synthetic field. No Spexop application source, customer data or credential was included in the task payload.
- Model: `openai/gpt-oss-120b`. Maximum: two requests, 3,500 completion tokens and 60 seconds each. No automatic paid-model fallback. The local key remained in memory and was not saved in the task state or candidate.
- Exact task contract hash: `cdc265c565ae69344610c2aa7b09c64725e42000b6bdb4264d8def4265050673`. Only `src/Input.tsx` could be replaced. Source and contract hashes were checked before each attempt. The output remained in a private isolated candidate, outside the repository.

## Observed result

| Attempt | Adapter result | Provider-reported usage | Independent check |
| --- | --- | --- | --- |
| 1 | Bounded JSON replacement accepted for `src/Input.tsx`; request ID `chatcmpl-4b59ad63-8f17-4a40-a8b5-d18616c108ea` | 499 input, 1,276 output, 1,775 total tokens | Scope, typecheck and build passed. Lint failed: generated suppression named a React Hooks rule absent from the fixture. Chrome showed the error after invalid input and blur. A later focused transition check is recorded below. |
| 2 | Adapter recorded `Worker call failed; isolated output ignored`; no accepted response or request ID | Unavailable | No candidate to check. The current safe error record does not distinguish HTTP failure, malformed/incomplete completion or transport failure. |

The second attempt was prepared with only the independent failure feedback for the same reviewed task. Its safe record cannot prove whether the provider received it. Both reserved attempts are exhausted; there was no further attempt. The first candidate failed a required check, so this probe is **FAILED**, not verified. The existing [earlier benchmark](../groq-input-2026-11-01/README.md) also has a distinct disabled-state acceptance gap.

### Focused Chrome transition check

A separate local copy of the first candidate used [this toggleable parent harness](toggle-fixture-main.tsx) in place of the fixture's `src/main.tsx`; the generated `Input.tsx` was unchanged. In real Google Chrome, entering `invalid` and leaving the field showed the error. Checking **Disabled** removed the alert and disabled the field; unchecking it enabled the field without resurfacing the stale alert. The check observed the settled UI after each interaction; it cannot prove that no transient pre-effect frame appeared. It does not cure the independent lint failure or grant task acceptance.

## Next decision

This probe revealed that the prior failure journal hid the failure class. PR #19 now adds fixed, redacted adapter failure codes for **future** attempts and offline tests for HTTP, transport, incomplete completion and invalid response; it cannot retroactively diagnose attempt 2. Review the disabled-state browser scenario with a fixture that can toggle the parent prop, then decide whether a separately approved new bounded sample is useful. Keep #18 and G-VERIFY open; a synthetic probe cannot grant external product or release acceptance.

## Separate approved probe: R1-INPUT-LIVE-002

The owner separately approved a new two-request limit for the same public synthetic 479-byte `Input.tsx` baseline. This is a distinct task contract (`43070f0fefbe4666fe97c1cc9775bbec491c16a4ea0ffdb10d8823eb2cde7177`) and does not extend the earlier probe's authorization. The task required optional empty or whitespace input, error updates after blur, a disabled-state transition, a boolean `aria-invalid`, and consistent alert association. The model and per-request limits remained `openai/gpt-oss-120b`, 3,500 completion tokens and 60 seconds. No paid fallback or application source was used.

| Attempt | Observed adapter result | Independent result |
| --- | --- | --- |
| 1 | `HTTP_400`; no accepted candidate, usage or request ID. The safe journal does not identify the cause. | No candidate to verify. |
| 2 | After switching this model to Groq's documented strict JSON Schema response format, one in-scope `src/Input.tsx` replacement was accepted. Request ID `chatcmpl-9315ac3b-6867-4b29-98a4-20c27a7b53f3`; provider usage 625 input, 1,684 output, 2,309 total tokens. | Scope, typecheck, lint and build passed in the isolated candidate. The required behavior failed independent source review: whitespace-only input is treated as invalid (`val === ''` is the only optional case), and `aria-invalid` is omitted rather than boolean when there is no error. Chrome displayed the invalid email alert after blur, but the complete browser acceptance scenario was not established. |

The candidate inventory revision was `3b43e493b98755d9f7e5f634137ee593e49d707c24865f610da0dd26be34667c`; only `src/Input.tsx` differed from the approved baseline. The candidate stayed outside the repository. The local task journal records **FAILED** for the required browser/behavior gate, with two of two attempts consumed. The strict schema change is a transport improvement observed to return one valid response on attempt 2; it does not establish why attempt 1 returned HTTP 400 or prove general provider reliability. No third request was sent.

Issue #18, G-VERIFY, external product acceptance and release acceptance remain open. A future worker task needs a separately approved budget and an independently passing candidate; this failed generated file must not be treated as accepted product code.
