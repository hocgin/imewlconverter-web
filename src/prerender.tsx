import { renderToString } from "react-dom/server";
import App from "./App";
import { I18nProvider } from "./i18n";
import { renderSeo } from "./seo";
import { languageTags } from "./translate";
import { locales, type Locale } from "./locales.mjs";
export { locales, languageTags };
export { createTranslator } from "./translate";
export function render(locale: Locale) {
  return {
    html: renderToString(
      <I18nProvider initialLocale={locale}>
        <App />
      </I18nProvider>,
    ),
    head: renderSeo(locale),
  };
}
