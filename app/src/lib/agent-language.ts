import type { SupportedLanguage } from "./input-validation.ts";

export type { SupportedLanguage };

export function languageName(language: SupportedLanguage) {
  return language === "hi" ? "Hindi" : language === "mr" ? "Marathi" : "English";
}
