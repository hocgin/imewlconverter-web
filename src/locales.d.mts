export type Locale = "en" | "zh-hans" | "zh-hant";
export const locales: readonly Locale[];
export function localeFromPath(pathname: string): Locale | null;
export function matchLanguage(languages: readonly string[]): Locale;
