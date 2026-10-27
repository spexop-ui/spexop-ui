# Spexop UI

**A free, local-first, open-source UI/UX desktop companion in development.**

Your existing coding agent leads planning, design decisions, complex analysis, and risky work. Spexop is being built to coordinate bounded routine UI tasks through user-configured free or low-cost LLM API workers, check the results independently, and show simple local progress, blockers, and requests for user action. The software is free; provider API charges and data policies are separate and require user choice. There is no silent paid fallback.

## Development status

**Source availability is not a product release. There is no ready-to-install desktop app, verified live API worker, or public R1 release.** The current internal coordination prototype in [Draft PR #13](https://github.com/spexop-ui/spexop-ui/pull/13) uses test doubles and a loopback browser status panel. Its tests and real-browser checks support that limited technical claim. The Groq access [blocker #14](https://github.com/spexop-ui/spexop-ui/issues/14) remains open. External product acceptance, the M5 milestone, and release approval remain open. [Draft PR #12](https://github.com/spexop-ui/spexop-ui/pull/12) describes the product direction; neither draft is merged into `main`.

The current `main` branch contains `@spexop/theme` and Foundation engineering tools: Theme validation and output, Canonical Design Model work, Foundation Capture, provenance, CSS Export, Build Context, and Build Evidence. These are technical assets. They do not establish a finished companion, general CSS equivalence, or a published npm package. Design Contract remains experimental.

See [product direction](https://github.com/spexop-ui/spexop-ui/blob/docs/agent-native-ui-verification/docs/product-direction.md), [architecture](https://github.com/spexop-ui/spexop-ui/blob/docs/agent-native-ui-verification/docs/architecture.md), and [roadmap](https://spexop.com/roadmap) for planned work. Plans and prototypes are identified as such.

## Working with the source

Use Node >=22.13 and pnpm 11.1.2:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

For the Theme package, see [its documentation](packages/theme/README.md), [migration notes](packages/theme/MIGRATION.md), and [source selection record](provenance/theme-selection.json). The package can be packed locally and checked in [the separate example consumer](examples/react-consumer/README.md). This is a development check, not an npm release or companion installation path.

## Source and rights boundary

This repository imports an explicitly selected MIT-licensed Theme subset and separately developed Foundation work. It does not import old repository history or unresolved Nx/PRO and unrelated icon/asset candidates. The root [MIT license](LICENSE), package license, and [third-party notices](packages/theme/THIRD_PARTY_NOTICES.md) cover the included source and its documented runtime notice. Historical credential rotation and rights for excluded legacy sources remain open; this repository does not grant rights to publish those separate materials. See [provenance](provenance/README.md) for the current selection record.

## Contribute and report issues

We welcome bounded documentation, accessibility, and source contributions that can be reviewed independently. Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and an issue before larger changes. Please use [SECURITY.md](SECURITY.md) for vulnerabilities and never post keys, personal data, or private project files in public issues or pull requests. An issue label does not mean the desktop companion has shipped.

[Website](https://spexop.com) · [Organization](https://github.com/spexop-ui) · [Sponsor Spexop](https://github.com/sponsors/spexop-ui)
