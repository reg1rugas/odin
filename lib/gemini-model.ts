/** Shared model default for new settings, existing workspaces, and API requests. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function resolveGeminiModel(value: unknown): string {
  if (typeof value !== "string" || !/^gemini-[a-zA-Z0-9.-]+$/.test(value.trim())) {
    return DEFAULT_GEMINI_MODEL;
  }
  return value.trim();
}
