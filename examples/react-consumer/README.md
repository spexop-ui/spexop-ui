# Isolated consumer proof

This example is outside the pnpm workspace package list. Copy these files to a fresh temporary directory, then install the tarball produced from the exact tested source. It must not resolve `@spexop/theme` through a workspace link or the public registry.

```sh
npm install --ignore-scripts /absolute/path/to/spexop-theme-0.7.0-alpha.0.tgz
npm run check
```

The check compiles a React/TypeScript ESM consumer, renders with React DOM Server, exercises light/dark, CSS, Tailwind text output, DTCG and contrast, and checks negative inputs. This is package consumption evidence, not a browser or visual acceptance test. Root tests independently compile Tailwind v4 and parse DTCG with Terrazzo.
