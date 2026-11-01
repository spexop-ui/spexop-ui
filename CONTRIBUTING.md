# Contributing to Spexop UI

Thank you for helping with this free, open-source work in progress. The desktop companion is in development. A public source repository does not mean that a usable desktop app or provider-backed worker has been released.

## Before you start

- Read the [README](README.md), [Code of Conduct](CODE_OF_CONDUCT.md), and [Security Policy](SECURITY.md).
- Check existing issues. For a substantial change, open an issue describing the user problem, a small proposed scope, and how it could be verified. Maintainers decide direction and acceptance.
- Pick a bounded issue with a clear owner, affected files, and expected behavior. `help wanted` and `good first issue` are used only where the work is independently solvable.
- Do not post API keys, credentials, private repository content, customer data, logs containing personal data, or unpublished assets.

## Development

Use Node >=22.13 and pnpm 11.1.2. From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

Keep changes focused. Include tests when they verify a meaningful behavior or regression. Explain what was checked and what remains unverified. Tests, a local build, browser observation, independent verification, external product acceptance, and release approval are separate claims.

## Pull requests

1. Link the issue or explain why the change is needed.
2. Describe the exact behavior and files changed. Keep unrelated work out of the PR.
3. State the evidence: commands, environment, browser/device if relevant, and any limitations.
4. Disclose new dependencies, assets, licenses, provider calls, data flows, or cost implications.
5. Confirm no secrets, personal data, or third-party proprietary material were added.
6. Expect review and revisions. Do not treat a passing check as maintainer or product acceptance.

Do not add GitHub Actions, publish packages, or introduce paid services in a contribution without a separate maintainer decision. Report suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Community

We aim for respectful, specific feedback. See the [Code of Conduct](CODE_OF_CONDUCT.md). Voluntary sponsorship does not confer feature priority, support terms, or product decision rights.
