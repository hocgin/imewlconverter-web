// Production browser checks; run after pnpm build with preview on port 4174.
const root = "__PROJECT_ROOT__";
const finish = "__FINISH__";
const { default: assert } = await import("node:assert/strict");
const { mkdir, readFile, writeFile } = await import("node:fs/promises");
const task = await taskSpace("词库网站本地化与SEO验收");
const page = await task.newPage();
const dir = `${root}/artifacts/verification/localization`;
await mkdir(dir, { recursive: true });
const checks = [];
const record = (name, details) => {
  checks.push({ name, passed: true, details });
  console.log(`PASS ${name}`, details || "");
};
const origin = "http://127.0.0.1:4174";
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await page.cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__localizationErrors=[];const originalError=console.error;console.error=(...args)=>{window.__localizationErrors.push(args.map(String).join(' '));originalError(...args)};addEventListener('error',event=>window.__localizationErrors.push(event.message))`,
});
await page.goto(`${origin}/en/`);
await page.waitForFunction(
  () => document.querySelector(".engine-status")?.textContent.includes("ready"),
  undefined,
  { timeout: 120000 },
);
await page.snapshot();

await page.click("text=Try a sample");
for (const [locale, tag] of [
  ["zh-hant", "zh-Hant"],
  ["zh-hans", "zh-Hans"],
  ["en", "en"],
]) {
  await page.click(`loc=href:/${locale}/`);
  const state = await page.evaluate(() => ({
    path: location.pathname,
    lang: document.documentElement.lang,
    canonical: document.querySelector('link[rel="canonical"]').href,
    files: [...document.querySelectorAll(".file-list b")].map(
      (el) => el.textContent,
    ),
    codes: [...document.querySelectorAll(".format-picker input")].map((el) =>
      el.value.split(" · ").pop(),
    ),
    meta: document.querySelector('meta[name="apple-itunes-app"]').content,
    schema: JSON.parse(
      document.querySelector('script[type="application/ld+json"]').textContent,
    )["@graph"].map((n) => n["@type"]),
  }));
  assert.equal(state.path, `/${locale}/`);
  assert.equal(state.lang, tag);
  assert.equal(state.canonical, `https://dict.aipan.app/${locale}/`);
  assert.deepEqual(state.files, ["sample-dictionary.txt"]);
  assert.deepEqual(state.codes, ["word", "rime"]);
  assert.equal(state.meta, "app-id=6819322032");
  assert.ok(
    state.schema.includes("WebApplication") &&
      state.schema.includes("MobileApplication"),
  );
  record(`Switch to ${locale} preserves files and conversion settings`, state);
}
await page.click("loc=href:/zh-hant/");
await page.click(".desktop-action .convert-button");
await page.waitForSelector("#results .download-button", { timeout: 120000 });
const result = await page.evaluate(() => ({
  summary: document.querySelector(".output-summary p").textContent,
  preview: document.querySelector(".preview pre").textContent,
}));
assert.match(result.summary, /匯入 8 條.*匯出 8 條/);
assert.match(result.preview, /中國|中国/);
assert.match(result.preview, /ni hao/);
record(
  "Real WASM word-list to Rime conversion works in Traditional Chinese",
  result.summary,
);
await page.snapshot();
const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
await page.click("#results .download-button");
const download = await downloadPromise;
await download.saveAs(`${dir}/sample.dict.yaml`);
assert.match(await readFile(`${dir}/sample.dict.yaml`, "utf8"), /ni hao/);
record("Converted dictionary downloads successfully");
for (const locale of ["en", "zh-hans", "zh-hant"]) {
  await page.goto(`${origin}/${locale}/`);
  await page.waitForFunction(
    () =>
      /ready|就緒|就绪/.test(
        document.querySelector(".engine-status")?.textContent || "",
      ),
    undefined,
    { timeout: 120000 },
  );
  assert.deepEqual(
    await page.evaluate(() => window.__localizationErrors),
    [],
    `${locale} hydration/runtime errors`,
  );
  for (const width of [375, 768, 1440]) {
    await page.cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    const state = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
      images: [...document.querySelectorAll("#ios-app img")].map((img) => ({
        src: img.getAttribute("src"),
        width: img.width,
        height: img.height,
      })),
      canonicals: document.querySelectorAll('link[rel="canonical"]').length,
      h1: document.querySelectorAll("h1").length,
    }));
    assert.equal(state.width, width);
    assert.ok(state.content <= width, `${locale} ${JSON.stringify(state)}`);
    assert.equal(state.canonicals, 1);
    assert.equal(state.h1, 1);
    assert.ok(
      state.images.every(
        (img) =>
          img.src.startsWith("/app-store/") && img.width > 0 && img.height > 0,
      ),
    );
    record(`${locale} layout at ${width}px`, {
      width: state.width,
      content: state.content,
    });
    if (width === 375 || width === 1440)
      await page.screenshot({
        path: `${dir}/${locale}-${width}.png`,
        fullPage: true,
      });
  }
}
// Test automatic matching without disturbing existing preferences in the user's profile.
await page.cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `Object.defineProperty(navigator, 'languages', {configurable:true,get:()=>['zh-TW']});Storage.prototype.getItem=function(){return null}`,
});
await page.goto(`${origin}/`);
await page.waitForFunction(() => location.pathname === "/zh-hant/");
record("Root automatically matches Traditional Chinese browser language");
await page.goto(`${origin}/en/`);
assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
record("Explicit English URL overrides browser language");
await page.cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `Object.defineProperty(navigator, 'languages', {configurable:true,get:()=>['fr-FR']})`,
});
await page.goto(`${origin}/`);
await page.waitForFunction(() => location.pathname === "/en/");
record("Unsupported browser language falls back to English");
await page.cdp("Emulation.clearDeviceMetricsOverride");
await writeFile(`${dir}/report.json`, JSON.stringify(checks, null, 2));
console.log(`${checks.length} browser checks passed.`);
if (finish) await task.finish({ keep: [] });
