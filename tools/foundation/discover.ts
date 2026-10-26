import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseCSSSources } from "./parse-css.js";
import type { Diagnostic, Options } from "./types.js";
const excluded = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "artifacts",
  ".spexop",
]);
export function discover(project: string, options: Options = {}) {
  const root = path.resolve(project);
  if (fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory())
    throw new Error("Project must be a real directory");
  const diagnostics: Diagnostic[] = [],
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
  const sources = scope.map(file => {
    const abs = path.join(root, file);
    if (fs.statSync(abs).size > 1024 * 1024)
      throw new Error("CSS input exceeds 1 MiB; narrow scope");
    const css = fs.readFileSync(abs, "utf8");
    hash.update(file).update("\0").update(css);
    return {file, css};
  });
  const parsed = parseCSSSources(sources);
  diagnostics.push(...parsed.diagnostics);
  return { root, scope, found: parsed.found, diagnostics, inputHash: hash.digest("hex") };
}
