export type Mode = "light" | "dark";
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
