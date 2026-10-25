# Spexop UI — OSS foundation consolidation

Private engineering candidate. **No npm release or public launch has occurred.** Spexop is becoming one free open-source toolkit; there is no PRO/open-core split.

Current implementation: `@spexop/theme` only, a pnpm + TypeScript workspace. Theme validation, token references, modern colors, light/dark CSS, Tailwind v4 output, DTCG 2025.10 subset and scoped contrast checks. See [package documentation](packages/theme/README.md), [migration](packages/theme/MIGRATION.md) and [file selection](provenance/theme-selection.json).

## Verify

Use Node >=22.13 and pnpm 11.1.2:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

Pack from `packages/theme` with `pnpm pack --pack-destination /absolute/output/path`. Install the resulting tarball into a fresh copy of `examples/react-consumer`, then run `npm run check`. No workspace linking is used for this consumer proof.

## Source boundaries

Only 15 explicitly selected MIT source files from packages commit `7741e1667d00416347eb538c0c3d01a75f2eb1ee` were recovered and adapted. No old Git history was imported. All 135 Theme targets / 96 content conflicts have recorded decisions. Unlicensed Nx/PRO candidates and assets are excluded, not deleted.

Historical credential rotation, Nx/PRO distribution rights and unrelated icon/asset rights remain open. Selected-file checks authorize this private slice, not public distribution of every legacy source. Runtime dependency Color.js MIT notice is included; installed development dependencies are inventoried separately. Dev-tool binaries are not bundled in the Theme tarball.

No other package skeletons, runtime verification, CLI/MCP, Figma integration, web deployment or publishing workflow are included. Basic package CI is not a Trusted Verification product gate. Next scope requires owner review after this slice.
