import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nProvider as AriaI18nProvider } from "react-aria";
import { Languages } from "lucide-react";
import {
  localeFromPath,
  locales,
  matchLanguage,
  type Locale,
} from "./locales.mjs";
import { createTranslator, languageTags } from "./translate";
import { updateSeo } from "./seo";

const Context = createContext({
  locale: "en" as Locale,
  setLocale: (_locale: Locale) => {},
  t: createTranslator("en"),
});
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, changeLocale] = useState(initialLocale);
  const setLocale = (value: Locale) => {
    try {
      localStorage.setItem("dictshift-language", value);
    } catch {
      /* Storage may be unavailable. */
    }
    history.pushState(null, "", `/${value}/${location.hash}`);
    changeLocale(value);
  };
  useEffect(() => {
    if (location.pathname === "/") {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("dictshift-language");
      } catch {
        /* Use browser language. */
      }
      const next = locales.includes(saved as Locale)
        ? (saved as Locale)
        : matchLanguage(
            navigator.languages?.length
              ? navigator.languages
              : [navigator.language],
          );
      history.replaceState(null, "", `/${next}/${location.hash}`);
      changeLocale(next);
    }
    const onPopState = () =>
      changeLocale(localeFromPath(location.pathname) || "en");
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    document.documentElement.lang = languageTags[locale];
    updateSeo(locale);
  }, [locale]);
  const t = useMemo(() => createTranslator(locale), [locale]);
  return (
    <Context.Provider value={{ locale, setLocale, t }}>
      <AriaI18nProvider
        locale={{ en: "en-US", "zh-hans": "zh-CN", "zh-hant": "zh-TW" }[locale]}
      >
        {children}
      </AriaI18nProvider>
    </Context.Provider>
  );
}
export const useI18n = () => useContext(Context);
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-switcher">
      <Languages aria-hidden="true" size={17} />
      <nav aria-label={t("语言")}>
        {locales.map((value) => (
          <a
            key={value}
            href={`/${value}/`}
            lang={languageTags[value]}
            hrefLang={languageTags[value]}
            aria-current={locale === value ? "page" : undefined}
            onClick={(event) => {
              if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey &&
                !event.altKey &&
                event.button === 0
              ) {
                event.preventDefault();
                setLocale(value);
              }
            }}
          >
            {{ en: "EN", "zh-hans": "简", "zh-hant": "繁" }[value]}
            <span className="sr-only">
              {
                { en: "English", "zh-hans": "简体中文", "zh-hant": "繁體中文" }[
                  value
                ]
              }
            </span>
          </a>
        ))}
      </nav>
    </div>
  );
}
