/** Data-only Vite manifest adapter. Does not execute config or infer browser order. */
export function inspectViteManifest(text: string) {
  const unavailable = (reason: string) => ({ certainty: 'unsupported' as const, reason, chunks: [], loadOrder: 'unknown' as const });
  try {
    if (text.length > 2 * 1024 * 1024) return unavailable('Manifest too large');
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 10000) return unavailable('Invalid manifest');
    const chunks: Array<{ id: string; file: string; entry: boolean; css: string[]; imports: string[]; dynamicImports: string[] }> = [];
    const path = (s: unknown): s is string => typeof s === 'string' && !!s && !s.startsWith('/') && !s.includes('\\') && !s.includes(':') && !s.split('/').includes('..');
    for (const [id, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object') return unavailable('Invalid chunk');
      const c = value as Record<string, unknown>;
      if (!path(c.file) || ![c.css, c.imports, c.dynamicImports].every(a => a === undefined || Array.isArray(a) && a.length <= 10000 && a.every(path))) return unavailable('Invalid chunk paths');
      chunks.push({ id, file: c.file, entry: c.isEntry === true, css: (c.css ?? []) as string[], imports: (c.imports ?? []) as string[], dynamicImports: (c.dynamicImports ?? []) as string[] });
    }
    if (chunks.some(c => [...c.imports, ...c.dynamicImports].some(i => !Object.hasOwn(raw, i)))) return unavailable('Missing imported chunk');
    return { certainty: 'partial' as const, reason: 'Compiler-declared relationships; build execution and active browser order are unproven.',
      chunks: chunks.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), loadOrder: 'unknown' as const };
  } catch { return unavailable('Invalid manifest JSON'); }
}
