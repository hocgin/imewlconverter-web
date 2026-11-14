import { mkdir, readFile, writeFile } from "node:fs/promises";
import { render, locales, languageTags } from "../.prerender/prerender.js";
const dist = new URL("../dist/", import.meta.url);
const template = await readFile(new URL("index.html", dist), "utf8");
for (const locale of locales) {
  const { html, head } = render(locale);
  const page = template
    .replace('lang="en"', `lang="${languageTags[locale]}"`)
    .replace("<!--seo-head-->", head)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  await mkdir(new URL(`${locale}/`, dist), { recursive: true });
  await writeFile(new URL(`${locale}/index.html`, dist), page);
  if (locale === "en") await writeFile(new URL("index.html", dist), page);
}
const origin = "https://dict.aipan.app";
const alternates =
  locales
    .map(
      (locale) =>
        `<xhtml:link rel="alternate" hreflang="${languageTags[locale]}" href="${origin}/${locale}/"/>`,
    )
    .join("") +
  `<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en/"/>`;
await writeFile(
  new URL("sitemap.xml", dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${locales.map((locale) => `<url><loc>${origin}/${locale}/</loc>${alternates}</url>`).join("")}</urlset>\n`,
);
await writeFile(
  new URL("robots.txt", dist),
  `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
);
console.log(
  "Prerendered three localized pages, an English root fallback, sitemap and robots.txt.",
);
