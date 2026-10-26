// Local acceptance harness. Source projects are read-only; artifacts go to a NEW explicit directory.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postcss from "postcss";
import { captureDesignFoundation } from "../tools/foundation/dist/capture/index.js";
const [manifest, baseline, output] = process.argv.slice(2);
if (!manifest || !baseline || !output) throw new Error("Usage: node scripts/verify-capture.mjs fixtures.json 005f-model-run NEW-output");
fs.mkdirSync(output); // exclusive; never overwrite evidence or a source directory
const hash = value => createHash("sha256").update(value).digest("hex");
const projects = JSON.parse(fs.readFileSync(manifest, "utf8")), rows = [];
for (const project of projects) {
  const old = JSON.parse(fs.readFileSync(path.join(baseline, project.name, "model.json"), "utf8"));
  const before = Object.fromEntries([...new Set(old.tokens.map(t => t.provenance.file))].sort().map(file => [file, hash(fs.readFileSync(path.join(project.path, file)))]));
  const options = { projectRoot: project.path, namespace: project.name, sourceCommit: project.commit };
  const a = captureDesignFoundation(options), b = captureDesignFoundation(options);
  assert.deepEqual(a, b, "Capture nondeterministic");
  const corrected = structuredClone(old.tokens);
  const exact = new Map();
  for (const file of Object.keys(before)) postcss.parse(fs.readFileSync(path.join(project.path, file), "utf8")).walkDecls(d => {
    exact.set(`${file}:${d.source.start.line}:${d.source.start.column}:${d.prop}`, d.source.input.css.slice(d.source.start.offset, d.source.end.offset));
  });
  let rawDeclarationCorrections = 0;
  for (const t of corrected) {
    const raw = exact.get(`${t.provenance.file}:${t.provenance.line}:${t.provenance.column}:${t.identity.sourceName}`);
    assert.equal(typeof raw, "string");
    if (raw !== t.provenance.rawDeclaration) rawDeclarationCorrections++;
    t.provenance.rawDeclaration = raw;
  }
  assert.deepEqual(a.tokens, corrected, "005F token fields changed beyond exact source-slice correction");
  assert.deepEqual(a.contexts, old.contexts, "005F context regression");
  assert.deepEqual(a.resolutions, old.resolutions, "005F resolution regression");
  assert.deepEqual(a.evaluationScopes, old.evaluationScopes);
  for (const [file, sha] of Object.entries(before)) assert.equal(hash(fs.readFileSync(path.join(project.path, file))), sha, "Source changed");
  for (const token of a.tokens) assert.equal(a.sources.find(s => s.file === token.provenance.file)?.sha256, token.provenance.fileSha256);
  fs.writeFileSync(path.join(output, `${project.name}.json`), JSON.stringify(a, null, 2) + "\n", { flag: "wx" });
  rows.push({ project: project.name, sourceCommit: project.commit, sourceDeclarations: a.coverage.sourceDeclarations,
    represented: a.tokens.length, sourceFieldsEqual005FExceptDeclaredCorrections: true, rawDeclarationCorrections,
    exactSourceSlicesVerified: true, referenceRecordsEqual005F: true,
    resolutionCounts: a.coverage.resolutions, types: a.coverage.types, sourceHashesUnchanged: true,
    mandatoryThemeMappings: 0, outputGeneration: a.coverage.outputGeneration, coverageStatus: a.coverage.status,
    deterministic: true, captureSha256: hash(JSON.stringify(a)), sourceHashes: before });
}
fs.writeFileSync(path.join(output, "comparison.json"), JSON.stringify(rows, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(rows, null, 2));
