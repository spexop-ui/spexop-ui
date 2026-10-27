# One local UI task acceptance harness

This is an explicit test-double journey, not an LLM worker execution. It reuses the
Fieldwork Settings form in a separate prepared copy. The original application is
not edited. First attempt is an intentional scope violation; main-agent authorized
retry returns a known single-file input-validation change. The independent verifier
owns build/typecheck/lint and waits for separate current-revision Chrome evidence.

After repository build:

`node examples/companion-journey/run.mjs <prepared Fieldwork copy> <new output directory> <reviewed fixture node_modules>`

The prepared copy must include the existing generated theme CSS and package files;
this harness does not regenerate a design system or install dependencies. The checked
commands are the fixture's TypeScript compiler, host ESLint with zero warnings and
Vite build. The candidate preview uses loopback port 5212; status uses port 5211.
A separate main-agent browser check writes `<output>/browser.json` with the candidate
revision, PASS/FAIL/UNKNOWN and actual observations. No browser evidence within ten
minutes gives UNKNOWN. Do not manufacture that artifact or derive it from worker claims.
The test fixture has no secrets; build environment excludes personal credentials.

Evidence: candidate/source manifests, quality exits, scope-negative state, feedback,
API NOT_CONFIGURED state, browser observations and final journal. `TESTED` means the
local simulation passed independent checks. Real API execution remains unverified.
