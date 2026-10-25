import fs from "node:fs";
import { analyzeProject, writeFoundation, writeAnswersTemplate, createAnswersTemplate, type Options } from "./index.js";
function main() {
  const args = process.argv.slice(2),
    project = args.shift();
  if (!project || project === "--help") {
    console.log(
      "Usage: pnpm foundation <React-project> [--css relative.css] [--answers answers.json] [--prepare-answers new.json] [--light-only] [--write]\nDefault is read-only dry-run. --decisions remains an alias for --answers. --prepare-answers explicitly creates a NEW in-project JSON template; empty mandatory answers block generation. A/B defaults are visible, editable proposals, never discoveries. JSON reports source values, manual decisions, diagnostics and planned outputs. Exit 1 means blocked. --write creates only a NEW .spexop/foundation directory.",
    );
    return;
  }
  const options: Options = {};
  let write = false;
  let prepare: string | undefined;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--write") write = true;
    else if (arg === "--light-only") options.expectedModes = ["light"];
    else if (arg === "--css") {
      const file = args.shift();
      if (!file || file.startsWith("--"))
        throw new Error("--css needs a relative file");
      (options.cssFiles ??= []).push(file);
    } else if (arg === "--prepare-answers") {
      prepare = args.shift();
      if (!prepare || prepare.startsWith("--")) throw new Error("--prepare-answers needs a new relative JSON path");
    } else if (arg === "--decisions" || arg === "--answers") {
      const file = args.shift();
      if (!file || file.startsWith("--")) throw new Error("--answers needs a JSON path");
      const answer = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        answer.schemaVersion !== 1 ||
        typeof answer.inputHash !== "string" ||
        !answer.decisions ||
        typeof answer.decisions !== "object" ||
        Array.isArray(answer.decisions)
      )
        throw new Error("Expected {schemaVersion:1,inputHash,decisions}");
      options.inputHash = answer.inputHash;
      options.decisions = answer.decisions;
    } else throw new Error(`Unknown argument ${arg}`);
  }
  if (prepare && write) throw new Error("Prepare answers and write outputs are separate actions");
  const result = write
    ? writeFoundation(project, options)
    : analyzeProject(project, options);
  const answersWritten = prepare ? writeAnswersTemplate(project, prepare, result) : undefined;
  console.log(
    JSON.stringify(
      {
        ...result,
        writePerformed: write,
        answersWritten,
        answerTemplate: createAnswersTemplate(result),
        outputs: result.outputs.map(({ path, sha256, content }) => ({
          path,
          sha256,
          bytes: Buffer.byteLength(content),
        })),
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exitCode = 1;
}
try {
  main();
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      code: "FOUNDATION_FAILED",
      message: String(error),
      writePerformed: false,
    }),
  );
  process.exitCode = 1;
}
