import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { analyzeProject, writeFoundation } from "../index.js";
it("compares Fieldwork automatic mappings against the unchanged 005A golden provenance, not the new mapping rules", () => {
  const source = "examples/design-foundation-journey";
  const golden = JSON.parse(
    fs.readFileSync(`${source}/theme/manual-mapping.json`, "utf8"),
  );
  expect(golden.decisions).toHaveLength(31);
  expect(
    golden.decisions.filter((d: { decision: string }) =>
      d.decision.startsWith("preserved"),
    ),
  ).toHaveLength(29);
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "spx-fieldwork-"));
  try {
    fs.mkdirSync(path.join(project, "src"));
    for (const file of ["app.css", "legacy.css"])
      fs.copyFileSync(`${source}/src/${file}`, path.join(project, "src", file));
    const initial = analyzeProject(project);
    expect(initial.metrics).toEqual({
      found: 30,
      automaticMappings: 28,
      ambiguousValues: 2,
      manualDecisions: 19,
      unresolvedDecisions: 19,
    });
    const answers = JSON.parse(
      fs.readFileSync(`${source}/foundation-decisions.json`, "utf8"),
    );
    const result = analyzeProject(project, answers);
    expect(result.ok).toBe(true);
    expect(result.theme.colors.link).toBe("{colors.primary}");
    expect(result.theme.darkMode?.colors?.link).toBe("{colors.primary}");
    expect(
      result.outputs.find((o) => o.path.endsWith("/theme.css"))?.content,
    ).toContain("--theme-link:");
    expect(result.metrics.manualDecisions).toBe(20);
    expect(result.metrics.unresolvedDecisions).toBe(0);
    let correct = 0;
    for (const m of result.mappings.filter((m) => m.method === "name-rule")) {
      const found = result.found.find((v) => v.id === m.sourceId)!;
      const expected = golden.decisions.find(
        (d: { variable: string; target: string; selector: string }) =>
          d.variable === found.variable &&
          d.target.replace(/^darkMode\./, "") === m.target &&
          (d.selector.includes("dark") ? "dark" : "light") === m.mode,
      );
      expect(expected, m.sourceId).toBeDefined();
      expect(m.value).toBe(
        typeof expected.after === "number"
          ? Number.parseFloat(expected.before)
          : expected.before,
      );
      correct++;
    }
    expect(correct).toBe(28);
    const before = fs.readFileSync(path.join(project, "src/legacy.css"));
    const output = writeFoundation(project, answers);
    expect(output.outputs).toHaveLength(3);
    expect(fs.readFileSync(path.join(project, "src/legacy.css"))).toEqual(
      before,
    );
    expect(analyzeProject(project, answers).outputs).toEqual(output.outputs);
    expect(() => writeFoundation(project, answers)).toThrow();
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
