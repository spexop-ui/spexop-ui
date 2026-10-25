/** Tailwind v4 CSS-first output; legacy v3 JavaScript configuration is not emitted. */
import type { SpexopThemeConfig } from "../types/SpexopThemeConfig.js";
import { expandColors, tokenName } from "../utils/foundationTokens.js";
import { generateCSS } from "./css.js";
import { resolveTheme } from "../utils/tokenResolver.js";
export function generateTailwind(config: SpexopThemeConfig): string {
  const css = generateCSS(config);
  const theme = resolveTheme(config);
  const colors = [
    ...new Set([
      ...Object.keys(expandColors(theme.colors)),
      ...(config.darkMode?.enabled
        ? Object.keys(expandColors(resolveTheme(config, "dark").colors))
        : []),
    ]),
  ]
    .sort()
    .map((k) => `  --color-${tokenName(k)}: var(--theme-${tokenName(k)});`);
  const extra = [
    ...new Set(
      [
        ...css.matchAll(
          /--theme-(spacing|font-size|font-weight|line-height)-([\w-]+):/g,
        ),
      ].map((m) => `${m[1]}:${m[2]}`),
    ),
  ]
    .sort()
    .map((entry) => {
      const [kind, key] = entry.split(":");
      const namespace = (
        {
          spacing: "spacing",
          "font-size": "text",
          "font-weight": "font-weight",
          "line-height": "leading",
        } as Record<string, string>
      )[kind];
      return `  --${namespace}-${key}: var(--theme-${kind}-${key});`;
    });
  return `${css}\n\n@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));\n@theme inline {\n${colors.join("\n")}\n${extra.join("\n")}\n  --font-sans: var(--theme-font-family);\n  --spacing: ${theme.spacing.baseUnit}px;\n}\n`;
}
