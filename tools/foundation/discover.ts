import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import postcss from "postcss";
import type { Diagnostic, FoundValue, Mode, Options } from "./types.js";
const excluded = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "artifacts",
  ".spexop",
]);
const dark =
  /^(?:\.dark|html\.dark|:root\.dark|\[data-theme=["']dark["']\]|html\[data-theme=["']dark["']\]|:root\[data-theme=["']dark["']\])$/;
export function discover(project: string, options: Options = {}) {
  const root = path.resolve(project);
  if (fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory())
    throw new Error("Project must be a real directory");
  const diagnostics: Diagnostic[] = [],
    found: FoundValue[] = [],
    files: string[] = [];
  const add = (file: string) => {
    if (path.isAbsolute(file))
      throw new Error("CSS inputs must be relative paths");
    const rel = path.relative(root, path.resolve(root, file));
    if (rel.startsWith("..") || path.isAbsolute(rel) || !rel.endsWith(".css"))
      throw new Error(
        "CSS inputs must be relative .css files inside the project",
      );
    let parent = root;
    for (const part of rel.split(path.sep)) {
      parent = path.join(parent, part);
      if (fs.lstatSync(parent).isSymbolicLink())
        throw new Error("Symlink CSS input refused");
    }
    files.push(rel.split(path.sep).join("/"));
  };
  const walk = (dir: string) => {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (excluded.has(entry.name) || entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        diagnostics.push({
          code: "SYMLINK_SKIPPED",
          severity: "unsupported",
          message: "Symlink not followed",
          source: { file: path.relative(root, abs), line: 1, column: 1 },
          fix: "Provide a real in-project CSS file.",
        });
        continue;
      }
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith(".css"))
        add(path.relative(root, abs));
    }
  };
  if (options.cssFiles) options.cssFiles.forEach(add);
  else walk(root);
  const scope = [...new Set(files)].sort();
  if (scope.length > 200)
    throw new Error(
      "Scope exceeds 200 CSS files; select a smaller cssFiles scope",
    );
  const hash = createHash("sha256").update(
    JSON.stringify({
      scope,
      modes: options.expectedModes ?? ["light", "dark"],
    }),
  );
  for (const file of scope) {
    const abs = path.join(root, file);
    if (fs.statSync(abs).size > 1024 * 1024)
      throw new Error("CSS input exceeds 1 MiB; narrow scope");
    const css = fs.readFileSync(abs, "utf8");
    hash.update(file).update("\0").update(css);
    try {
      const tree = postcss.parse(css, { from: abs });
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
  if (!found.length)
    diagnostics.push({
      code: "NO_TOKENS",
      severity: "error",
      message: "No CSS custom properties discovered.",
      fix: "Select a CSS source containing global tokens.",
    });
  return { root, scope, found, diagnostics, inputHash: hash.digest("hex") };
}
