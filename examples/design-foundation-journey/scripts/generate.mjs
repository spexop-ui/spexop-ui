// Fixture glue only. No project scanner, production CLI or source-file mapper.
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  createTheme,
  generateCSS,
  generateTailwind,
  generateDTCG,
  auditThemeAccessibility,
} from "@spexop/theme";
const started = performance.now();
const source = process.argv[2] ?? "theme/input.json";
try {
  const input = JSON.parse(fs.readFileSync(source, "utf8"));
  const theme = createTheme(input);
  const audit = auditThemeAccessibility(theme);
  if (!audit.passed || audit.summary.notEvaluated) {
    console.error(JSON.stringify(audit, null, 2));
    process.exitCode = 1;
  } else {
    fs.mkdirSync("artifacts", { recursive: true });
    const outputs = {
      "artifacts/theme.css": generateCSS(theme),
      "artifacts/theme.tokens.json": generateDTCG(theme),
      "src/generated.css": '@import "tailwindcss";\n' + generateTailwind(theme),
    };
    for (const [file, text] of Object.entries(outputs))
      fs.writeFileSync(file, text);
    const result = {
      node: process.version,
      input: source,
      audit,
      generationMs: +(performance.now() - started).toFixed(2),
      files: Object.entries(outputs).map(([path, text]) => ({
        path,
        bytes: Buffer.byteLength(text),
        sha256: createHash("sha256").update(text).digest("hex"),
      })),
    };
    fs.writeFileSync(
      "artifacts/generation.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
