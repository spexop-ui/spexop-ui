# R1 bounded worker live probe — 2026-11-01

Related: [issue #18](https://github.com/spexop-ui/spexop-ui/issues/18), [draft PR #19](https://github.com/spexop-ui/spexop-ui/pull/19). This is one owner-authorized, synthetic local probe of the proposed Groq adapter. It is not product acceptance.

## Reviewed boundary

- The submitted source was only the public synthetic `src/Input.tsx` baseline from [the earlier benchmark](../groq-input-2026-11-01/README.md), 479 bytes, SHA-256 `9106baad186ae9b71ef4710c11133b264e432184ed7cf4087d883ebff1bd0310`. The task text and correction feedback described only that synthetic field. No Spexop application source, customer data or credential was included in the task payload.
- Model: `openai/gpt-oss-120b`. Maximum: two requests, 3,500 completion tokens and 60 seconds each. No automatic paid-model fallback. The local key remained in memory and was not saved in the task state or candidate.
- Exact task contract hash: `cdc265c565ae69344610c2aa7b09c64725e42000b6bdb4264d8def4265050673`. Only `src/Input.tsx` could be replaced. Source and contract hashes were checked before each attempt. The output remained in a private isolated candidate, outside the repository.

## Observed result

| Attempt | Adapter result | Provider-reported usage | Independent check |
| --- | --- | --- | --- |
| 1 | Bounded JSON replacement accepted for `src/Input.tsx`; request ID `chatcmpl-4b59ad63-8f17-4a40-a8b5-d18616c108ea` | 499 input, 1,276 output, 1,775 total tokens | Scope, typecheck and build passed. Lint failed: generated suppression named a React Hooks rule absent from the fixture. Chrome showed the error after invalid input and blur; the full disabled transition was not accepted. |
| 2 | Adapter recorded `Worker call failed; isolated output ignored`; no accepted response or request ID | Unavailable | No candidate to check. The current safe error record does not distinguish HTTP failure, malformed/incomplete completion or transport failure. |

The second attempt was prepared with only the independent failure feedback for the same reviewed task. Its safe record cannot prove whether the provider received it. Both reserved attempts are exhausted; there was no further attempt. The first candidate failed a required check, so this probe is **FAILED**, not verified. The existing [earlier benchmark](../groq-input-2026-11-01/README.md) also has a distinct disabled-state acceptance gap.

## Next decision

This probe revealed that the prior failure journal hid the failure class. PR #19 now adds fixed, redacted adapter failure codes for **future** attempts and offline tests for HTTP, transport, incomplete completion and invalid response; it cannot retroactively diagnose attempt 2. Review the disabled-state browser scenario with a fixture that can toggle the parent prop, then decide whether a separately approved new bounded sample is useful. Keep #18 and G-VERIFY open; a synthetic probe cannot grant external product or release acceptance.
