import type { SpexopThemeConfig } from "@spexop/theme";
export type Mode = "light" | "dark";
export type Scalar = string | number;
export interface Location {
  file: string;
  line: number;
  column: number;
}
export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info" | "unsupported";
  message: string;
  token?: string;
  source?: Location;
  fix: string;
}
export interface FoundValue {
  id: string;
  variable: string;
  value: string;
  mode: Mode;
  selector: string;
  source: Location;
  supported: boolean;
  origin: "css" | "tailwind-theme";
  ancestors?: string[];
}
export interface Choice {
  value?: Scalar;
  source?: string;
  target?: string;
  ignore?: boolean;
  inherit?: boolean;
}
export interface Decision {
  id: string;
  kind: "mapping" | "conflict" | "proposal" | "inheritance" | "override";
  token?: string;
  source?: Location;
  reason: string;
  suggested?: Scalar;
  options?: string[];
  resolved: boolean;
  resolution?: Choice;
}
export interface Mapping {
  sourceId: string;
  target: string;
  mode: Mode;
  value: Scalar;
  method: "name-rule" | "user";
  source: Location;
}
export interface Options {
  cssFiles?: string[];
  expectedModes?: Mode[];
  inputHash?: string;
  decisions?: Record<string, Choice>;
}
export interface Analysis {
  review: import("./review.js").DiscoveryReview;
  ok: boolean;
  inputHash: string;
  scope: string[];
  graph: import("./graph.js").TokenGraph;
  aliasDecisionReduction: Array<{id: string; sourceIds: string[]; reason: string}>;
  found: FoundValue[];
  mappings: Mapping[];
  manual_decisions: Decision[];
  diagnostics: Diagnostic[];
  proposed: Array<{ token: string; value: Scalar; accepted: boolean;
    classification: "A" | "B" | "C"; origin: "documented-default";
    reason: string; editableVia: string; applied: boolean }> ;
  inheritance: Array<{ token: string; from: "light"; accepted: boolean }>;
  theme: SpexopThemeConfig;
  plannedOutputPaths: string[];
  outputs: Array<{ path: string; sha256: string; content: string }>;
  metrics: {
    found: number;
    automaticMappings: number;
    ambiguousValues: number;
    manualDecisions: number;
    unresolvedDecisions: number;
  };
}
