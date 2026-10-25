import { parseColor } from "./color.js";
export function validateColor(value: string): {
  valid: boolean;
  error?: string;
} {
  try {
    parseColor(value);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid color",
    };
  }
}
