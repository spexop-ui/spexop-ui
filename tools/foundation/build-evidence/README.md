# Controlled local build evidence

`collectBuildEvidence` runs one explicitly reviewed Node build command in a fresh
private directory. It copies selected source inputs and a reviewed dependency seed,
records their hashes, compiler/package/config identities, executes with a fixed
environment and macOS network/file sandbox, then seals outputs outside the child
process writable area. No project scripts or configurations are selected automatically.

The caller must review code, dependencies and the exact command before setting
`approved: true`. There is no generic trust decision, package installation, network
build access or orchestration. Unsupported platforms fail closed. This is local
traceability, not cryptographic attestation or a hostile-code isolation guarantee.

Keep the returned `receiptSha256` outside the bundle. `verifyBuildEvidence` requires
that anchor, checks run/file identities, snapshots and all recorded bytes. A forged
bundle plus a replaced trust anchor cannot be detected; no such claim is made.
Source revision metadata is caller asserted; source file bytes are observed.

`buildContextFromEvidence` accepts only verified successful unchanged-input runs,
captures their sealed source/compiled CSS, and passes exact map data into the existing
005K inspector. Flat source-map paths resolve relative to the CSS artifact; only paths
to this run's copied inputs are bound. No basename/value guessing. Positional links
remain `partial`; run membership is distinct from positional and behavioral proof.

The sandbox denies network, reads of selected personal-data locations, keychain access and writes
outside the private work/home/temp directories. No personal environment is inherited.
Dependency seed contents are hashed before/after copying and changes cause failure.
The seed must be a reviewed npm-style tree with links confined to that tree. The
collector does not claim dependency authorship or supply-chain attestation.

Logs may contain arbitrary compiler output: raw stdout/stderr are not persisted or
returned. Only byte counts/hashes and exit status are recorded. Build diagnostics
must be inspected separately without exposing credential values. Credential-like
input filenames and command arguments are rejected; absence of secrets in arbitrary
source code is not guaranteed by filename checks.

CSS maps are optional evidence, not successful-build assumptions. Vite 8's inspected
CSS build pipeline discards maps when extracting final CSS; `--sourcemap` can therefore
produce JS maps without a CSS map. Such runs are build-success / provenance-incomplete.
No generated map or post-build source matching repairs this missing evidence.

Runtime metadata labels the collector runtime; the selected child executable is independently byte-hashed. Dependency identity describes the initial copied seed, not an immutable execution attestation. OS isolation denies network and selected personal-data locations, and restricts writes to the copied workspace/private HOME/TMP. This is for reviewed commands, not a general hostile-code execution service.
