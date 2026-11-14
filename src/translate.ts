import english from "./locales/en.json";
import traditional from "./locales/zh-hant.json";
import type { Locale } from "./locales.mjs";
const en: Record<string, string> = english;
const hant: Record<string, string> = traditional;
export const languageTags = {
  en: "en",
  "zh-hans": "zh-Hans",
  "zh-hant": "zh-Hant",
};

export function createTranslator(locale: Locale) {
  const dictionary =
    locale === "en"
      ? en
      : locale === "zh-hant"
        ? hant
        : ({} as Record<string, string>);
  const interpolate = (text: string, values: readonly unknown[]) =>
    text.replace(/\{(\d+)\}/g, (match, i) =>
      String(values[Number(i)] ?? match),
    );
  return (key: string, values: readonly unknown[] = []): string => {
    const normalized = key.replace(/\s+/g, " ").trim();
    const translated = dictionary[key] ?? dictionary[normalized];
    if (translated != null) return interpolate(translated, values);
    // Engine messages can include filenames and numeric details. Translate only
    // known message fragments; dictionary previews and filenames never call t().
    if (/\p{Script=Han}/u.test(key) && locale !== "zh-hans") {
      let result = key;
      for (const source of Object.keys(dictionary).sort(
        (a, b) => b.length - a.length,
      )) {
        if (source.length < 6 || source.includes("{")) continue;
        result = result.replaceAll(source, dictionary[source]);
      }
      for (const source of Object.keys(dictionary).filter((value) =>
        value.includes("{0}"),
      )) {
        const escape = (value: string) =>
          value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = source.split(/\{\d+\}/g);
        const pattern = new RegExp(
          parts
            .map(
              (part, index) =>
                escape(part) +
                (index < parts.length - 1
                  ? index === parts.length - 2 && !parts[index + 1]
                    ? "(.+)"
                    : "(.+?)"
                  : ""),
            )
            .join(""),
          "g",
        );
        result = result.replace(pattern, (...matches) =>
          interpolate(dictionary[source], matches.slice(1, -2)),
        );
      }
      return interpolate(result, values);
    }
    return interpolate(key, values);
  };
}
