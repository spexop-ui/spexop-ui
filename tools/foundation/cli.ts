import fs from "node:fs";
import { analyzeProject, writeFoundation, type Options } from "./index.js";
function main() {
  const args = process.argv.slice(2),
    project = args.shift();
  if (!project || project === "--help") {
    console.log(
      "Usage: pnpm foundation <React-project> [--css relative.css] [--decisions answers.json] [--light-only] [--write]\nDefault is read-only dry-run. JSON reports source values, manual decisions, diagnostics and planned outputs. Exit 1 means blocked. --write creates only a NEW .spexop/foundation directory.",
    );
    return;
  }
  const options: Options = {};
  let write = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--write") write = true;
    else if (arg === "--light-only") options.expectedModes = ["light"];
    else if (arg === "--css") {
      const file = args.shift();
      if (!file || file.startsWith("--"))
        throw new Error("--css needs a relative file");
      (options.cssFiles ??= []).push(file);
    } else if (arg === "--decisions") {
      const file = args.shift();
      if (!file) throw new Error("--decisions needs a JSON path");
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
  const result = write
    ? writeFoundation(project, options)
    : analyzeProject(project, options);
  console.log(
    JSON.stringify(
      {
        ...result,
        writePerformed: write,
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
