import fs from "node:fs";
import path from "node:path";
import { analyzeProject } from "./analyze.js";
import type { Options } from "./types.js";
export { analyzeProject } from "./analyze.js";
export { discover } from "./discover.js";
export type * from "./types.js";
/** Explicit write action: re-analyze current inputs, reserve a NEW directory, never overwrite. */
export function writeFoundation(project: string, options: Options = {}) {
  const result = analyzeProject(project, options);
  if (!result.ok)
    throw new Error(
      "Foundation is blocked; inspect dry-run diagnostics and manual_decisions.",
    );
  const root = path.resolve(project),
    parent = path.join(root, ".spexop"),
    output = path.join(parent, "foundation");
  if (fs.existsSync(parent)) {
    if (
      fs.lstatSync(parent).isSymbolicLink() ||
      !fs.statSync(parent).isDirectory()
    )
      throw new Error("Output parent must be a real directory");
  } else fs.mkdirSync(parent);
  // mkdir is exclusive even for an existing empty directory; no force/overwrite mode exists.
  fs.mkdirSync(output);
  const written: string[] = [];
  try {
    for (const entry of result.outputs) {
      const file = path.join(output, path.basename(entry.path));
      fs.writeFileSync(file, entry.content, { flag: "wx" });
      written.push(file);
    }
    return result;
  } catch (error) {
    for (const file of written) fs.unlinkSync(file);
    fs.rmdirSync(output);
    throw error;
  }
}

export { createAnswersTemplate, writeAnswersTemplate } from "./answers.js";

export { buildTokenGraph, redundantAliasIds } from "./graph.js";
export type * from "./graph.js";

export { createDiscoveryReview } from "./review.js";
export type * from "./review.js";
