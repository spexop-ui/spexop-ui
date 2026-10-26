import { createHash } from "node:crypto";
import postcss from "postcss";
import type { Diagnostic, FoundValue, Mode } from "./source-types.js";
export interface CSSSnapshot { file: string; css: string; }
const dark =
  /^(?:\.dark|html\.dark|:root\.dark|\[data-theme=["']dark["']\]|html\[data-theme=["']dark["']\]|:root\[data-theme=["']dark["']\])$/;
/** Pure parser shared by legacy discovery and canonical capture. No IO or application evaluation. */
export function parseCSSSources(sources: readonly CSSSnapshot[]) {
  const registered = new Set<string>();
  const diagnostics: Diagnostic[] = [], found: FoundValue[] = [];
  const declarations = new Map<string, { raw: string; important: boolean; sha: string }>();
  for (const { file, css } of sources) {
    try {
      const sha = createHash("sha256").update(css).digest("hex");
      const tree = postcss.parse(css, { from: file });
      tree.walkAtRules("property", rule => { registered.add(rule.params.trim()); });
      tree.walkAtRules("import", (rule) => {
        diagnostics.push({
          code: "IMPORT_NOT_FOLLOWED",
          severity: "unsupported",
          message:
            "CSS imports are not resolved; only files in the reported scope are inspected.",
          source: {
            file,
            line: rule.source?.start?.line ?? 1,
            column: rule.source?.start?.column ?? 1,
          },
          fix: "Include local token CSS explicitly; package imports need separate review.",
        });
      });
      tree.walkDecls((decl) => {
        if (!decl.prop.startsWith("--")) return;
        const source = {
          file,
          line: decl.source?.start?.line ?? 1,
          column: decl.source?.start?.column ?? 1,
        };
        declarations.set(`${file}:${source.line}:${source.column}:${decl.prop}`, {
          // PostCSS offsets address input.css (which strips a UTF-8 BOM), not the original byte snapshot.
          raw: decl.source!.input.css.slice(decl.source!.start!.offset!, decl.source!.end!.offset!),
          important: !!decl.important, sha,
        });
        const parent = decl.parent;
        const top = parent?.parent?.type === "root";
        const selector =
          parent?.type === "rule"
            ? parent.selector
            : parent?.type === "atrule"
              ? `@${parent.name} ${parent.params}`
              : "";
        let mode: Mode = "light";
        const theme =
          top &&
          parent?.type === "atrule" &&
          parent.name === "theme" &&
          ["", "inline", "static"].includes(parent.params.trim());
        let supported =
          !!top &&
          ((parent?.type === "rule" &&
            (parent.selector.trim() === ":root" ||
              dark.test(parent.selector.trim()))) ||
            theme);
        if (parent?.type === "rule" && dark.test(parent.selector.trim()))
          mode = "dark";
        if (decl.important) supported = false;
        // No cascade/specificity approximation for nested, media, selector lists or !important.
        if (!supported)
          diagnostics.push({
            code: "UNSUPPORTED_SCOPE",
            severity: "unsupported",
            message: `Custom property in unsupported scope: ${selector}`,
            source,
            token: decl.prop,
            fix: "Move intended global tokens to a supported root selector or select a simpler source file.",
          });
        if (
          /(?:calc|env|color-mix|light-dark)\(|var\([^)]*,|\$|#\{/.test(
            decl.value,
          )
        ) {
          supported = false;
          diagnostics.push({
            code: "UNSUPPORTED_VALUE",
            severity: "unsupported",
            message: "Expression or fallback needs CSS runtime evaluation.",
            source,
            token: decl.prop,
            fix: "Supply a literal or a simple var(--name) alias in a supported token source.",
          });
        }
        const ancestors: string[] = [];
        let ancestor = parent?.parent;
        while (ancestor && ancestor.type !== "root") {
          ancestors.push(ancestor.type === "atrule" ? `@${ancestor.name} ${ancestor.params}` : ancestor.type === "rule" ? ancestor.selector : ancestor.type);
          ancestor = ancestor.parent;
        }
        found.push({
          id: `${file}:${source.line}:${source.column}:${decl.prop}`,
          variable: decl.prop,
          value: decl.value,
          mode,
          selector,
          source,
          supported,
          origin: theme ? "tailwind-theme" : "css",
          ancestors,
        });
      });
    } catch (error) {
      const e = error as { line?: number; column?: number; reason?: string };
      diagnostics.push({
        code: "CSS_PARSE",
        severity: "error",
        message: e.reason ?? "CSS parse failed",
        source: { file, line: e.line ?? 1, column: e.column ?? 1 },
        fix: "Fix the CSS syntax before generating outputs.",
      });
    }
  }
  for (const value of found) if (registered.has(value.variable) || [...value.value.matchAll(/var\(\s*(--[\w-]+)/g)].some(m => registered.has(m[1]))) {
    value.supported = false;
    diagnostics.push({code:"REGISTERED_PROPERTY",severity:"unsupported",token:value.variable,source:value.source,
      message:"@property registration can change syntax, inheritance and initial value; registration evaluation is unsupported.",
      fix:"Inspect registered CSS behavior separately; do not substitute the declaration as an unregistered variable."});
  }
  if (!found.length)
    diagnostics.push({
      code: "NO_TOKENS",
      severity: "error",
      message: "No CSS custom properties discovered.",
      fix: "Select a CSS source containing global tokens.",
    });
  return { found, diagnostics, declarations };
}
