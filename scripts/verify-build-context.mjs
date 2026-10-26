// Read-only acceptance runner. Paths/fixtures are explicit data, never engine rules.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { captureDesignFoundation } from '../tools/foundation/dist/capture/index.js';
import { planBuildCSS, cssArtifactHash } from '../tools/foundation/dist/build-context/index.js';
import { renderCanonicalCSS } from '../tools/foundation/dist/css-export/index.js';
const [configuration, output] = process.argv.slice(2);
fs.mkdirSync(output);
const results = [];
for (const fixture of JSON.parse(fs.readFileSync(configuration, 'utf8'))) {
  const source = captureDesignFoundation({ ...fixture.source, cssContext: true });
  const compiled = captureDesignFoundation({ ...fixture.compiled, cssContext: true });
  const observations = fixture.observations.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  for (const [index, observation] of observations.entries()) {
    const input = { source, compiled, compiler: fixture.compiler, observation };
    const review = planBuildCSS(input);
    assert.deepEqual(review, planBuildCSS(input));
    const rendered = review.plan && review.plan.status !== 'blocked' ? renderCanonicalCSS(review.plan, { allowPartial: true }) : null;
    const id = `${fixture.name}-${index}`;
    fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(review, null, 2));
    if (rendered) fs.writeFileSync(path.join(output, id + '.css'), rendered.css);
    results.push({ fixture: fixture.name, state: observation.state, url: observation.documentURL,
      sourceTokens: source.tokens.length, compiledTokens: compiled.tokens.length,
      positionalLinks: review.context.coverage.positionalLinks,
      provenSourceBuildRelations: review.context.coverage.provenSourceBuildRelations,
      slots: review.context.slots.map(s => ({ order: s.order, url: s.url, root: s.root, kind: s.kind, hash: s.byteSha256, artifacts: s.artifactFiles })),
      sourceOrder: review.context.sourceOrder, exportStatus: review.plan?.status ?? 'no-load-plan',
      generated: rendered?.declarations ?? 0, excluded: rendered?.excluded ?? compiled.tokens.length,
      outputSha256: rendered?.sha256 ?? null, reviewSha256: cssArtifactHash(JSON.stringify(review)),
      placementSafety: review.placementSafety, behavioralEquivalence: review.behavioralEquivalence,
      diagnostics: review.context.diagnostics, deterministic: true });
  }
  for (const [capture, options] of [[source, fixture.source], [compiled, fixture.compiled]]) {
    for (const doc of capture.cssDocuments) assert.equal(cssArtifactHash(fs.readFileSync(path.join(options.projectRoot, doc.file), 'utf8')), doc.sha256);
  }
}
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
