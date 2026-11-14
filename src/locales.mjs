export const locales = ["en", "zh-hans", "zh-hant"];
export function localeFromPath(pathname) {
  const part = pathname.split("/")[1]?.toLowerCase();
  return locales.includes(part) ? part : null;
}
export function matchLanguage(languages) {
  for (const raw of languages) {
    const language = raw.toLowerCase().replaceAll("_", "-");
    if (language === "en" || language.startsWith("en-")) return "en";
    if (language === "zh" || language.startsWith("zh-")) {
      // Explicit script takes precedence over region (e.g. zh-Hans-HK).
      if (language.includes("-hant")) return "zh-hant";
      if (language.includes("-hans")) return "zh-hans";
      return /-(tw|hk|mo)(-|$)/.test(language) ? "zh-hant" : "zh-hans";
    }
  }
  return "en";
}
