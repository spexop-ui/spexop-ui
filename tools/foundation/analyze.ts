import { createHash } from "node:crypto";
import {
  validateTheme,
  auditThemeAccessibility,
  generateCSS,
  generateTailwind,
  generateDTCG,
  type SpexopThemeConfig,
} from "@spexop/theme";
import { defaultRules } from "./defaults.js";
import { buildTokenGraph, redundantAliasIds } from "./graph.js";
import { discover } from "./discover.js";
import type {
  Analysis,
  Choice,
  Decision,
  FoundValue,
  Mapping,
  Mode,
  Options,
  Scalar,
} from "./types.js";
const colors: Record<string, string> = {
  primary: "primary",
  brand: "primary",
  surface: "surface",
  background: "surface",
  "surface-secondary": "surfaceSecondary",
  "surface-soft": "surfaceSecondary",
  "surface-hover": "surfaceHover",
  text: "text",
  foreground: "text",
  ink: "text",
  "text-secondary": "textSecondary",
  "ink-secondary": "textSecondary",
  "text-muted": "textMuted",
  "ink-muted": "textMuted",
  border: "border",
  line: "border",
  "border-strong": "borderStrong",
  "line-strong": "borderStrong",
  "border-subtle": "borderSubtle",
  "line-subtle": "borderSubtle",
  link: "link",
};
const defaults = Object.fromEntries(Object.entries(defaultRules).map(([key, rule]) => [key, rule.value]));
const requiredColors = [
  "primary",
  "surface",
  "surfaceSecondary",
  "surfaceHover",
  "text",
  "textSecondary",
  "textMuted",
  "border",
  "borderStrong",
  "borderSubtle",
];
const unsafe = new Set(["__proto__", "prototype", "constructor"]);
function validTarget(target: string) {
  return (
    !target.split(".").some((x) => unsafe.has(x)) &&
    (Object.hasOwn(defaults, target) ||
      /^spacing\.values\.[a-zA-Z0-9_-]+$/.test(target) ||
      (target.startsWith("colors.") &&
        Object.values(colors).includes(target.slice(7))))
  );
}
function targetFor(v: FoundValue): string | undefined {
  const raw = v.variable.slice(2),
    name = raw.startsWith("color-") ? raw.slice(6) : raw;
  if (Object.hasOwn(colors, name)) return `colors.${colors[name]}`;
  if (["font-body", "font-sans"].includes(raw)) return "typography.fontFamily";
  if (["font-size-base", "text-base"].includes(raw))
    return "typography.baseSize";
  if (["space-unit", "spacing"].includes(raw)) return "spacing.baseUnit";
  const spacing = /^(?:space|spacing)-(\d+)$/.exec(raw);
  if (spacing) return `spacing.values.${spacing[1]}`;
  return undefined;
}
function assign(root: Record<string, unknown>, target: string, value: unknown) {
  const parts = target.split(".");
  let node = root;
  for (const p of parts.slice(0, -1)) {
    if (!node[p]) node[p] = {};
    node = node[p] as Record<string, unknown>;
  }
  node[parts.at(-1)!] = value;
}
function get(root: Record<string, unknown>, target: string): unknown {
  let v: unknown = root;
  for (const p of target.split("."))
    v =
      v && typeof v === "object"
        ? (v as Record<string, unknown>)[p]
        : undefined;
  return v;
}
function numberOrText(value: string, target: string): Scalar | undefined {
  if (
    target.startsWith("colors.") ||
    target === "typography.fontFamily" ||
    target === "borders.defaultStyle"
  )
    return value;
  const unitless =
    target === "typography.scale" ||
    target.startsWith("typography.weights.") ||
    target.startsWith("typography.lineHeights.");
  if ((unitless ? /^\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?(?:px)?$/).test(value))
    return Number.parseFloat(value);
  return undefined;
}
export function analyzeProject(
  project: string,
  options: Options = {},
): Analysis {
  const discovery = discover(project, options),
    { found, diagnostics, inputHash, scope } = discovery;
  const graph = buildTokenGraph(found, targetFor);
  const redundant = redundantAliasIds(graph);
  const graphNodes = new Map(graph.nodes.map(n => [n.id, n]));
  const graphBlocked = new Set<string>();
  for (const resolution of graph.resolutions) if (resolution.status !== "resolved") {
    graphBlocked.add(resolution.nodeId);
    const node = graphNodes.get(resolution.nodeId)!;
    diagnostics.push({code: "GRAPH_RESOLUTION", severity: "unsupported", token: node.name, source: node.provenance,
      message: `${resolution.mode}: ${resolution.status}. ${resolution.reason ?? "No supported unique scalar resolution."}`,
      fix: "Review source context/reference or explicitly narrow CSS scope; a semantic answer cannot repair CSS resolution."});
  }
  const canonicalSources = new Map<string, Set<string>>();
  for (const r of graph.resolutions) if (r.canonicalSourceId) {
    const sources = canonicalSources.get(r.nodeId) ?? new Set<string>();
    sources.add(r.canonicalSourceId); canonicalSources.set(r.nodeId, sources);
  }
  const aliasDecisionReduction = [...redundant].map(id => ({id,
    sourceIds: [...(canonicalSources.get(id) ?? [])],
    reason: "Resolved alias relationship retained in graph; not a new independent scalar or duplicate mapping decision."}));
  diagnostics.push({
    code: "DISCOVERY_SCOPE",
    severity: "info",
    message: `Inventoried ${scope.length} CSS files and ${found.length} custom-property declarations; semantic mappings are name-rule inferences.`,
    fix: "Review scope and mapping provenance; this does not establish active imports or inspect TSX.",
  });
  const modes = options.expectedModes ?? ["light", "dark"];
  if (
    !modes.includes("light") ||
    modes.some((x) => x !== "light" && x !== "dark") ||
    new Set(modes).size !== modes.length
  )
    throw new Error("expectedModes must be [light] or [light,dark]");
  const choices = options.decisions ?? {},
    decisions: Decision[] = [],
    mappings: Mapping[] = [],
    proposed: Analysis["proposed"] = [],
    inheritance: Analysis["inheritance"] = [];
  if (Object.keys(choices).length && options.inputHash !== inputHash)
    diagnostics.push({
      code: "STALE_DECISIONS",
      severity: "error",
      message: "Decisions do not match this source snapshot and scope.",
      fix: "Run dry-run again and review decisions against its inputHash.",
    });
  const decision = (
    id: string,
    rest: Omit<Decision, "id" | "resolved" | "resolution">,
    accept: (c: Choice) => boolean,
  ) => {
    const c = choices[id];
    const resolved = !!c && accept(c);
    decisions.push({ id, ...rest, resolved, ...(c ? { resolution: c } : {}) });
    if (c && !resolved)
      diagnostics.push({
        code: "INVALID_DECISION",
        severity: "error",
        message: `Invalid answer for ${id}`,
        token: rest.token,
        source: rest.source,
        fix: "Use a listed source/target or an explicit scalar value.",
      });
    return resolved ? c : undefined;
  };
  const selected: Array<{
    found: FoundValue;
    target: string;
    method: "name-rule" | "user";
  }> = [];
  for (const v of found.filter((x) => x.supported && !graphBlocked.has(x.id) && (!redundant.has(x.id) || Object.hasOwn(choices, `map:${x.id}`)))) {
    let target = targetFor(v),
      method: "name-rule" | "user" = "name-rule";
    if (!target) {
      const opts =
        v.variable === "--muted"
          ? ["colors.textMuted", "colors.surfaceSecondary"]
          : v.variable === "--radius"
            ? ["borders.radiusSubtle", "borders.radiusRelaxed"]
            : undefined;
      const c = decision(
        `map:${v.id}`,
        {
          kind: "mapping",
          source: v.source,
          reason: `No unambiguous semantic rule for ${v.variable}. Ignore or choose a supported target.`,
          options: opts,
        },
        (c) =>
          c.ignore === true ||
          (typeof c.target === "string" && validTarget(c.target)),
      );
      if (c?.ignore) {
        diagnostics.push({
          code: "USER_IGNORED",
          severity: "warning",
          message: `User excluded ${v.variable}; original source remains untouched.`,
          source: v.source,
          fix: "Review whether this value is still used by the application.",
        });
        continue;
      }
      target = c?.target;
      method = "user";
    }
    if (target) selected.push({ found: v, target, method });
  }
  const groups = new Map<string, typeof selected>();
  for (const m of selected) {
    const key = `${m.found.mode}.${m.target}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const retained: typeof selected = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      retained.push(group[0]);
      continue;
    }
    // Even equal values can have different cascade semantics; never silently pick a winner.
    const c = decision(
      `conflict:${key}`,
      {
        kind: "conflict",
        token: key,
        source: group[0].found.source,
        reason:
          "Multiple declarations target the same semantic token; CSS cascade is not inferred.",
        options: group.map((g) => g.found.id),
      },
      (c) => group.some((g) => g.found.id === c.source),
    );
    if (c) retained.push(group.find((g) => g.found.id === c.source)!);
  }
  const variables = new Map<string, FoundValue[]>();
  for (const v of found.filter((x) => x.supported)) {
    const key = `${v.mode}:${v.variable}`;
    const group = variables.get(key) ?? [];
    group.push(v);
    variables.set(key, group);
  }
  const byVariable = (name: string, mode: Mode) =>
    variables.get(`${mode}:${name}`) ??
    (mode === "dark" ? variables.get(`light:${name}`) : undefined) ??
    [];
  const alias = (value: string) => /^var\(\s*(--[\w-]+)\s*\)$/.exec(value)?.[1];
  // Iterative, indexed and memoized: each effective-mode node is walked once.
  const checked = new Set<string>();
  function checkAlias(start: FoundValue, mode: Mode) {
    const trail: FoundValue[] = [],
      active = new Map<string, number>();
    let current: FoundValue | undefined = start;
    while (current) {
      const key = `${mode}:${current.id}`;
      if (checked.has(key)) break;
      if (active.has(key)) {
        const cycle = trail.slice(active.get(key)).map((v) => v.variable);
        diagnostics.push({
          code: "ALIAS_CYCLE",
          severity: "error",
          token: current.variable,
          source: current.source,
          message: `${mode}: ${cycle.slice(0, 20).join(" → ")}${cycle.length > 20 ? " → …" : ""} → ${current.variable}`,
          fix: "Break this CSS variable cycle with a literal value.",
        });
        break;
      }
      active.set(key, trail.length);
      trail.push(current);
      const name = alias(current.value);
      if (!name) break;
      const next = byVariable(name, mode);
      if (next.length !== 1) {
        diagnostics.push({
          code: next.length ? "ALIAS_AMBIGUOUS" : "ALIAS_MISSING",
          severity: "error",
          token: current.variable,
          source: current.source,
          message: `${mode}: ${current.variable} → ${name}`,
          fix: next.length
            ? "Reference one unambiguous CSS declaration."
            : `Define ${name} or correct this reference.`,
        });
        break;
      }
      current = next[0];
    }
    for (const node of trail) checked.add(`${mode}:${node.id}`);
  }
  for (const v of found.filter((x) => x.supported)) checkAlias(v, v.mode);
  const mappedVariables = new Map<string, typeof retained>();
  const mappedSlots = new Map<string, (typeof retained)[number]>();
  for (const item of retained) {
    const key = `${item.found.mode}:${item.found.variable}`;
    const group = mappedVariables.get(key) ?? [];
    group.push(item);
    mappedVariables.set(key, group);
    mappedSlots.set(`${item.found.mode}:${item.target}`, item);
  }
  const config: Record<string, unknown> = {
    meta: { name: "Discovered foundation", version: "0.0.0" },
    colors: {},
    typography: {},
    spacing: { values: {} },
    borders: {},
  };
  if (modes.includes("dark")) config.darkMode = { enabled: true, colors: {} };
  for (const { found: v, target, method } of retained) {
    if (v.mode === "dark" && !target.startsWith("colors.")) {
      diagnostics.push({
        code: "DARK_NON_COLOR",
        severity: "unsupported",
        source: v.source,
        token: target,
        message:
          "Theme dark overrides support colors in this onboarding slice.",
        fix: "Keep shared typography/spacing or use a separate explicit configuration.",
      });
      continue;
    }
    if (v.mode === "dark" && !modes.includes("dark")) {
      diagnostics.push({
        code: "DARK_EXCLUDED",
        severity: "warning",
        source: v.source,
        token: target,
        message: "Dark source exists but expectedModes selects light only.",
        fix: "Request light and dark to include it.",
      });
      continue;
    }
    let value = numberOrText(v.value, target);
    const ref = alias(v.value);
    if (ref) {
      const effective =
        mappedVariables.get(`${v.mode}:${ref}`) ??
        mappedVariables.get(`light:${ref}`) ??
        [];
      const referenced = effective[0];
      const slot =
        referenced &&
        (mappedSlots.get(`${v.mode}:${referenced.target}`) ??
          mappedSlots.get(`light:${referenced.target}`));
      const safe =
        effective.length === 1 &&
        slot?.found.id === referenced.found.id &&
        !(
          v.mode === "dark" &&
          referenced.found.mode === "light" &&
          alias(referenced.found.value)
        );
      if (safe && referenced.target.split(".")[0] === target.split(".")[0])
        value = `{${referenced.target}}`;
      else {
        value = undefined;
        diagnostics.push({
          code: "UNMAPPED_ALIAS",
          severity: "unsupported",
          source: v.source,
          token: target,
          message: `Alias target ${ref} has no single mode-safe Theme mapping (its semantic slot may represent another CSS variable).`,
          fix: "Use an unambiguous mapping or an explicit source value; cross-mode alias semantics are never guessed or flattened.",
        });
      }
    } else if (v.value.includes("var(")) {
      value = undefined;
      diagnostics.push({
        code: "UNSUPPORTED_ALIAS",
        severity: "unsupported",
        source: v.source,
        token: target,
        message: "Only an entire var(--name) scalar alias is supported.",
        fix: "Provide a literal or a standalone alias.",
      });
    }
    if (value === undefined) {
      diagnostics.push({
        code: "UNSUPPORTED_UNIT",
        severity: "unsupported",
        source: v.source,
        token: target,
        message: `Cannot safely convert ${v.value} to the Theme scalar model.`,
        fix: "Use px or a unitless numeric value for numeric tokens; no rem assumptions are made.",
      });
      continue;
    }
    mappings.push({
      sourceId: v.id,
      target,
      mode: v.mode,
      value,
      method,
      source: v.source,
    });
    assign(config, v.mode === "dark" ? `darkMode.${target}` : target, value);
  }
  const equalValues = new Map<string, Mapping[]>();
  for (const mapping of mappings) {
    const key = `${mapping.mode}:${JSON.stringify(mapping.value)}`;
    equalValues.set(key, [...(equalValues.get(key) ?? []), mapping]);
  }
  for (const group of equalValues.values())
    if (group.length > 1) {
      diagnostics.push({
        code: "SHARED_VALUE",
        severity: "info",
        token: group.map((m) => `${m.mode}.${m.target}`).join(", "),
        source: group[0].source,
        message:
          "Several semantic tokens share this literal value; their roles and provenance remain separate.",
        fix: "Review the listed mappings; equality does not justify merging semantic roles.",
      });
    }
  const propose = (target: string, suggested?: Scalar) => {
    const rule = defaultRules[target];
    const classification = rule?.classification ?? "C";
    const reason = rule?.reason ?? "Missing semantic color requires an explicit project-specific value.";
    const id = `value:${target}`;
    // Existing answer files remain valid. New A/B completion needs no mandatory answer.
    const c = classification === "C" || Object.hasOwn(choices, id)
      ? decision(id, { kind: "proposal", token: target, reason, suggested },
          (c) => typeof c.value === "string" || typeof c.value === "number")
      : undefined;
    const value = c?.value ?? suggested;
    if (value !== undefined) {
      assign(config, target, value);
      proposed.push({ token: target, value, accepted: !!c, classification,
        origin: "documented-default", reason, editableVia: id,
        applied: !!c || classification !== "C" });
      if (!c && classification !== "C") diagnostics.push({
        code: classification === "A" ? "SAFE_DEFAULT" : "EDITABLE_PROPOSAL",
        severity: "info", token: target,
        message: `${classification}: ${JSON.stringify(value)}. ${reason}`,
        fix: `Change ${id} in the answers file to override; this value was not found in source CSS.`,
      });
    }
  };
  for (const [key, value] of Object.entries(defaults))
    if (get(config, key) === undefined) propose(key, value);
  for (const key of requiredColors)
    if (get(config, `colors.${key}`) === undefined) propose(`colors.${key}`);
  // Explicit overrides are independent manual decisions; the discovered value is kept in mappings.
  for (const [id, c] of Object.entries(choices))
    if (id.startsWith("override:")) {
      const token = id.slice(9);
      const parts = token.split(".");
      const mode = parts.shift();
      const target = parts.join(".");
      const source = mappings.find(
        (m) => m.mode === mode && m.target === target,
      )?.source;
      const answer = decision(
        id,
        {
          kind: "override",
          token,
          source,
          reason:
            "User changes a discovered semantic value; no automatic repair.",
        },
        (x) =>
          (mode === "light" ||
            (mode === "dark" &&
              modes.includes("dark") &&
              target.startsWith("colors."))) &&
          validTarget(target) &&
          (typeof x.value === "string" || typeof x.value === "number"),
      );
      if (answer)
        assign(
          config,
          mode === "dark" ? `darkMode.${target}` : target,
          c.value,
        );
    }
  if (modes.includes("dark"))
    for (const key of Object.keys(config.colors as object))
      if (get(config, `darkMode.colors.${key}`) === undefined) {
        const token = `colors.${key}`,
          light = mappings.find(
            (m) => m.mode === "light" && m.target === token,
          );
        const c = decision(
          `inherit:${token}`,
          {
            kind: "inheritance",
            token: `dark.${token}`,
            source: light?.source,
            reason:
              "No dark declaration. Explicitly inherit light or supply a dark value.",
          },
          (c) => c.inherit === true || typeof c.value === "string",
        );
        if (
          c?.inherit === true &&
          typeof get(config, token) === "string" &&
          String(get(config, token)).startsWith("{")
        )
          diagnostics.push({
            code: "ALIAS_INHERIT_UNSUPPORTED",
            severity: "unsupported",
            token: `dark.${token}`,
            source: light?.source,
            message:
              "Inheriting an alias can rebind to dark tokens instead of inheriting the computed light value.",
            fix: "Supply an explicit dark value or intentionally define a dark alias instead of inheritance.",
          });
        inheritance.push({
          token,
          from: "light",
          accepted: c?.inherit === true,
        });
        if (c?.value !== undefined)
          assign(config, `darkMode.${token}`, c.value);
        diagnostics.push({
          code: "DARK_MISSING",
          severity: c ? "warning" : "error",
          token: `dark.${token}`,
          source: light?.source,
          message: c?.inherit
            ? "Explicitly inheriting light value."
            : c
              ? "User supplied missing dark value."
              : "Dark token is missing; inheritance needs approval.",
          fix: "Review light inheritance or provide the intended dark value.",
        });
      }
  for (const id of Object.keys(choices))
    if (!decisions.some((d) => d.id === id)) {
      const target = id.startsWith("value:") ? id.slice(6) : "";
      const source = mappings.find((m) => m.mode === "light" && m.target === target)?.source;
      if (Object.hasOwn(defaultRules, target) && source) {
        diagnostics.push({code: "SUPERSEDED_PROPOSAL", severity: "info", token: target, source,
          message: `Source mapping replaces the absent-value proposal ${id}; its old answer is not applied.`,
          fix: `Remove ${id}; to intentionally replace the discovered value use override:light.${target}.`});
        continue;
      }
      diagnostics.push({
        code: "UNKNOWN_DECISION",
        severity: "error",
        message: `Unused decision: ${id}`,
        fix: "Remove stale/unknown answers after reviewing the current dry-run.",
      });
    }
  const theme = config as unknown as SpexopThemeConfig;
  const locate = (field: string) => {
    const mode = field.startsWith("dark.") ? "dark" : "light";
    const target = field.replace(/^(light|dark)\./, "").split("/")[0];
    return (
      mappings.find((m) => m.mode === mode && m.target === target) ??
      mappings.find((m) => m.mode === "light" && m.target === target)
    )?.source;
  };
  const validation = validateTheme(theme);
  for (const e of validation.errors)
    diagnostics.push({
      code: "THEME_INVALID",
      severity: "error",
      token: e.field,
      source: locate(e.field),
      message: e.message,
      fix: "Correct the referenced token value; raw CSS alias locations are reported separately.",
    });
  if (validation.valid) {
    const audit = auditThemeAccessibility(theme);
    for (const e of audit.issues) {
      diagnostics.push({
        code: e.field === "runtime" ? "RUNTIME_NOT_CHECKED" : "CONTRAST",
        severity: e.field === "runtime" ? "unsupported" : e.severity,
        token: e.field,
        source: locate(e.field),
        message: e.message,
        fix:
          e.field === "runtime"
            ? "Verify actual UI states separately."
            : "Choose an explicit text/surface value meeting the required contrast; no automatic correction is applied.",
      });
      if (e.severity === "error") {
        const token = e.field.split("/")[0],
          id = `override:${token}`;
        if (!decisions.some((d) => d.id === id))
          decision(
            id,
            {
              kind: "override",
              token,
              source: locate(e.field),
              reason:
                "Contrast failure requires a user-chosen text or surface correction. No automatic color change.",
            },
            () => false,
          );
      }
    }
  }
  // Unsupported token structures block this slice. Runtime and imports are explicit coverage limits;
  // they do not claim an entire project has been verified.
  const blocked = () =>
    decisions.some((d) => !d.resolved) ||
    diagnostics.some(
      (d) =>
        d.severity === "error" ||
        (d.severity === "unsupported" &&
          ![
            "RUNTIME_NOT_CHECKED",
            "IMPORT_NOT_FOLLOWED",
            "SYMLINK_SKIPPED",
          ].includes(d.code)),
    );
  const outputs: Analysis["outputs"] = [];
  if (!blocked())
    try {
      for (const [file, content] of Object.entries({
        "theme.css": generateCSS(theme),
        "tailwind.css": '@import "tailwindcss";\n' + generateTailwind(theme),
        "theme.tokens.json": generateDTCG(theme),
      }))
        outputs.push({
          path: `.spexop/foundation/${file}`,
          sha256: createHash("sha256").update(content).digest("hex"),
          content,
        });
    } catch (e) {
      outputs.length = 0;
      diagnostics.push({
        code: "GENERATION",
        severity: "error",
        message: String(e),
        fix: "Correct the theme; no outputs were written.",
      });
    }
  return {
    ok: !blocked() && outputs.length === 3,
    inputHash,
    scope,
    graph,
    aliasDecisionReduction,
    found,
    mappings,
    manual_decisions: decisions,
    diagnostics,
    proposed,
    inheritance,
    theme,
    plannedOutputPaths: [
      ".spexop/foundation/theme.css",
      ".spexop/foundation/tailwind.css",
      ".spexop/foundation/theme.tokens.json",
    ],
    outputs,
    metrics: {
      found: found.length,
      automaticMappings: mappings.filter((x) => x.method === "name-rule")
        .length,
      ambiguousValues: decisions.filter(
        (x) => x.kind === "mapping" || x.kind === "conflict",
      ).length,
      manualDecisions: decisions.length,
      unresolvedDecisions: decisions.filter((x) => !x.resolved).length,
    },
  };
}
