import { locales, type Locale } from "./locales.mjs";
import { createTranslator, languageTags } from "./translate";
import metadata from "../public/app-store/6819322032/metadata.json";
export const siteUrl = "https://dict.aipan.app";
export const seoContent = {
  en: {
    title: "IME Dictionary Converter: Sogou, Rime & Gboard | DictShift",
    description:
      "Convert Sogou SCEL, Rime, Gboard and TXT dictionaries online for free. Merge dictionaries, organize entries and move your words between input methods. No signup or file uploads required.",
  },
  "zh-hans": {
    title: "输入法词库在线转换：搜狗 SCEL、Rime、Gboard、TXT | 词库转转",
    description:
      "免费在线转换搜狗 SCEL、Rime、中州韵、Gboard、QQ 拼音与 TXT 词库。支持批量转换、词库合并、简繁转换与词条整理，轻松在不同输入法之间迁移常用词、人名和专业术语。无需注册，无需上传词库文件。",
  },
  "zh-hant": {
    title: "輸入法詞庫線上轉換：搜狗 SCEL、Rime、Gboard、TXT | 詞庫轉轉",
    description:
      "免費線上轉換搜狗 SCEL、Rime、中州韻、Gboard、QQ 拼音與 TXT 詞庫。支援批次轉換、詞庫合併、簡繁轉換與詞條整理，輕鬆在不同輸入法之間遷移常用詞、人名和專業術語。無需註冊，無需上傳詞庫檔案。",
  },
};
const ogLocales = { en: "en_US", "zh-hans": "zh_CN", "zh-hant": "zh_TW" };
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export function renderSeo(locale: Locale) {
  const { title, description } = seoContent[locale];
  const canonical = `${siteUrl}/${locale}/`;
  const t = createTranslator(locale);
  const app = metadata.locales[locale];
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: t("词库转转"),
        url: siteUrl,
        inLanguage: Object.values(languageTags),
      },
      {
        "@type": "WebApplication",
        "@id": `${canonical}#converter`,
        name: t("词库转换工具"),
        url: canonical,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        description,
        inLanguage: languageTags[locale],
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          t("批量转换与合并"),
          t("简繁转换"),
          t("生成编码"),
          t("词条过滤"),
        ],
        isPartOf: { "@id": `${siteUrl}/#website` },
        license: "https://www.gnu.org/licenses/gpl-3.0.html",
      },
      {
        "@type": "MobileApplication",
        "@id": `${siteUrl}/#ddup`,
        name: app.name,
        url: app.url,
        operatingSystem: `iOS ${app.minimumOsVersion}+`,
        applicationCategory: "UtilitiesApplication",
        softwareVersion: app.version,
        image: `${siteUrl}${app.icon}`,
        installUrl: app.url,
      },
    ],
  };
  const meta = (
    attribute: "name" | "property",
    name: string,
    content: string,
  ) => `<meta data-seo ${attribute}="${name}" content="${escape(content)}" />`;
  return [
    `<title data-seo>${escape(title)}</title>`,
    meta("name", "description", description),
    `<link data-seo rel="canonical" href="${canonical}" />`,
    ...locales.map(
      (value) =>
        `<link data-seo rel="alternate" hreflang="${languageTags[value]}" href="${siteUrl}/${value}/" />`,
    ),
    `<link data-seo rel="alternate" hreflang="x-default" href="${siteUrl}/en/" />`,
    meta("name", "apple-itunes-app", "app-id=6819322032"),
    meta("name", "robots", "index,follow,max-image-preview:large"),
    meta("property", "og:type", "website"),
    meta("property", "og:title", title),
    meta("property", "og:description", description),
    meta("property", "og:url", canonical),
    meta("property", "og:site_name", t("词库转转")),
    meta("property", "og:locale", ogLocales[locale]),
    ...locales
      .filter((value) => value !== locale)
      .map((value) =>
        meta("property", "og:locale:alternate", ogLocales[value]),
      ),
    meta("property", "og:image", `${siteUrl}/social-card.png`),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    meta(
      "property",
      "og:image:alt",
      "DictShift — Free online IME dictionary converter: Sogou, Rime, Gboard, TXT",
    ),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", title),
    meta("name", "twitter:description", description),
    meta("name", "twitter:image", `${siteUrl}/social-card.png`),
    `<script data-seo type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`,
  ].join("\n");
}
export function updateSeo(locale: Locale) {
  document.head
    .querySelectorAll("[data-seo]")
    .forEach((element) => element.remove());
  document.head.insertAdjacentHTML("beforeend", renderSeo(locale));
}
