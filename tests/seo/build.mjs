import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { render } from "../../.prerender/prerender.js";
const origin = "https://dict.aipan.app";
const locales = { en: "en", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant" };

test("localized pages contain indexable content and reciprocal SEO signals before JavaScript runs", async () => {
  const sitemap = await readFile(
    new URL("../../dist/sitemap.xml", import.meta.url),
    "utf8",
  );
  for (const [locale, tag] of Object.entries(locales)) {
    const html = await readFile(
      new URL(`../../dist/${locale}/index.html`, import.meta.url),
      "utf8",
    );
    assert.ok(html.includes(`lang="${tag}"`));
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(html.includes(`rel="canonical" href="${origin}/${locale}/"`));
    for (const [alternate, language] of Object.entries(locales)) {
      assert.ok(
        html.includes(`hreflang="${language}" href="${origin}/${alternate}/"`),
      );
      assert.ok(
        sitemap.includes(
          `hreflang="${language}" href="${origin}/${alternate}/"`,
        ),
      );
    }
    assert.ok(html.includes('hreflang="x-default"'));
    assert.ok(
      html.includes('name="apple-itunes-app" content="app-id=6819322032"'),
    );
    assert.ok(html.includes("<table>") && html.includes("user_dict_3_3"));
    assert.ok(
      html.includes('id="ios-app"') && html.includes('id="format-guide"'),
    );
    const schema = JSON.parse(
      html.match(
        /<script data-seo type="application\/ld\+json">(.*?)<\/script>/s,
      )[1],
    );
    assert.equal(
      schema["@graph"].find((node) => node["@type"] === "WebApplication")
        .inLanguage,
      tag,
    );
    assert.ok(
      schema["@graph"]
        .find((node) => node["@type"] === "MobileApplication")
        .installUrl.includes("6819322032"),
    );
    if (locale === "en")
      assert.doesNotMatch(
        render(locale)
          .html.replace(/<div class="language-switcher">[\s\S]*?<\/div>/, "")
          .replace(/<[^>]+>/g, ""),
        /[\u4e00-\u9fff]/,
      );
    assert.ok(sitemap.includes(`<loc>${origin}/${locale}/</loc>`));
  }
  assert.match(
    await readFile(new URL("../../dist/robots.txt", import.meta.url), "utf8"),
    /Sitemap: https:\/\/dict.aipan.app\/sitemap.xml/,
  );
});

test("every displayed App Store asset is cached in the build", async () => {
  const metadata = JSON.parse(
    await readFile(
      new URL(
        "../../public/app-store/6819322032/metadata.json",
        import.meta.url,
      ),
    ),
  );
  for (const app of Object.values(metadata.locales)) {
    await access(new URL(`../../dist${app.icon}`, import.meta.url));
  }
  await access(new URL("../../dist/social-card.png", import.meta.url));
});

test("dynamic validation and engine messages translate while preserving parameters", async () => {
  const { createTranslator } = await import("../../.prerender/prerender.js");
  const en = createTranslator("en");
  const hant = createTranslator("zh-hant");
  assert.equal(
    en("一次最多选择 100 个文件。"),
    "Select up to 100 files at a time.",
  );
  assert.equal(en("正在读取 个人词库.txt"), "Reading 个人词库.txt");
  assert.equal(
    en("sample.txt：导入器报告 3 条解析错误。"),
    "sample.txt：The importer reported 3 parsing errors.",
  );
  assert.equal(hant("正在导入 sample.txt"), "正在匯入 sample.txt");
  assert.equal(en("移除 {0}", ["个人词库.txt"]), "Remove 个人词库.txt");
});
