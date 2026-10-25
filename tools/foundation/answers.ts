import fs from "node:fs";
import path from "node:path";
import type { Analysis, Choice } from "./types.js";

/** Empty required answers deliberately block replay until the user supplies a decision. */
export function createAnswersTemplate(result: Analysis) {
  return {
    schemaVersion: 1,
    inputHash: result.inputHash,
    decisions: Object.fromEntries(result.manual_decisions.map((d) => [d.id, d.resolved ? d.resolution! : {} as Choice])),
    guidance: result.manual_decisions.filter((d) => !d.resolved).map(({id, reason, source, token, suggested, options}) =>
      ({id, reason, source, token, suggested, options})),
    optionalProposals: result.proposed.filter((p) => p.classification !== "C" && !p.accepted),
  };
}

/** An explicit action: writes a NEW in-project JSON file, never modifies sources or existing answers. */
export function writeAnswersTemplate(project: string, relativeFile: string, result: Analysis) {
  const root = path.resolve(project);
  const rel = path.relative(root, path.resolve(root, relativeFile));
  if (!rel || path.isAbsolute(relativeFile) || rel.startsWith("..") || !rel.endsWith(".json"))
    throw new Error("Answer template must be a new relative .json file inside the project");
  let current = root;
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error("Symlink project refused");
  for (const part of rel.split(path.sep).slice(0, -1)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink() || !fs.statSync(current).isDirectory())
      throw new Error("Answer parent must be an existing real directory");
  }
  const file = path.join(root, rel);
  fs.writeFileSync(file, JSON.stringify(createAnswersTemplate(result), null, 2) + "\n", {flag:"wx"});
  return rel.split(path.sep).join("/");
}
