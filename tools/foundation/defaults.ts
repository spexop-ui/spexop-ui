import type { Scalar } from "./types.js";
export interface DefaultRule {
  value: Scalar;
  classification: "A" | "B" | "C";
  reason: string;
}
// Only absent model fields are completed. Source declarations always take precedence.
// B values are editable proposals, NOT discoveries or verified project preferences.
export const defaultRules: Record<string, DefaultRule> = {
  "typography.fontFamily": { value: "system-ui, sans-serif", classification: "C", reason: "Font choice changes the existing visual identity; source or user choice required." },
  "typography.baseSize": { value: 16, classification: "C", reason: "Base size affects every generated type size; do not assume browser pixels match project intent." },
  "typography.scale": { value: 1.25, classification: "C", reason: "Type hierarchy is a design choice; the suggested scale must be explicitly chosen." },
  "typography.weights.regular": { value: 400, classification: "A", reason: "CSS numeric equivalent of normal/regular weight; no font availability claim." },
  "typography.weights.medium": { value: 500, classification: "B", reason: "Editable conventional medium weight; actual font support is not discovered." },
  "typography.weights.semibold": { value: 600, classification: "B", reason: "Editable conventional semibold weight; actual font support is not discovered." },
  "typography.weights.bold": { value: 700, classification: "A", reason: "CSS numeric equivalent of bold weight; no font availability claim." },
  "typography.lineHeights.tight": { value: 1.2, classification: "B", reason: "Starter type rhythm only; inspect real text wrapping and override if needed." },
  "typography.lineHeights.snug": { value: 1.375, classification: "B", reason: "Starter type rhythm only; inspect real text wrapping and override if needed." },
  "typography.lineHeights.normal": { value: 1.5, classification: "B", reason: "Starter type rhythm only; not a measured project line-height." },
  "typography.lineHeights.relaxed": { value: 1.75, classification: "B", reason: "Starter type rhythm only; not a measured project line-height." },
  "spacing.baseUnit": { value: 4, classification: "C", reason: "Spacing grid changes generated spacing; source or explicit decision required." },
  "borders.thin": { value: 1, classification: "B", reason: "Editable 1px starter border, only for an absent model field." },
  "borders.default": { value: 1, classification: "B", reason: "Editable 1px starter border, not an inference about existing component borders." },
  "borders.thick": { value: 2, classification: "B", reason: "Editable 2px starter border, only for an absent model field." },
  "borders.radiusSubtle": { value: 8, classification: "C", reason: "Corner shape affects component identity; source mapping or user choice required." },
  "borders.radiusRelaxed": { value: 8, classification: "C", reason: "Corner shape affects component identity; do not infer one radius role from another." },
  "borders.radiusPill": { value: 9999, classification: "B", reason: "Editable pill-radius convention; actual shape depends on component dimensions." },
  "borders.defaultStyle": { value: "solid", classification: "B", reason: "Editable starter border style, not a discovery from existing components." },
};
