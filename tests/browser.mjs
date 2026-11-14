// Executed by ego-browser through scripts/test-browser.mjs, not by ordinary Node.
const root = "__PROJECT_ROOT__";
const finish = "__FINISH__";
const { readFile, writeFile, mkdir } = await import("node:fs/promises");
const { default: assert } = await import("node:assert/strict");
const { createHash } = await import("node:crypto");
const { spawnSync } = await import("node:child_process");
const task = await taskSpace("词库转转实现验收");
const page = task.page("p1");
const dir = `${root}/artifacts/verification`;
await mkdir(dir, { recursive: true });
const checks = [];
const record = (name, detail = {}) => {
  checks.push({ name, passed: true, ...detail });
  console.log(`PASS ${name}`);
};
const fixtureRoot = `${root}/imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverterCoreTest/Test`;
const dotnet = [process.env.DOTNET, "dotnet", "/tmp/imewl-dotnet/dotnet"]
  .filter(Boolean)
  .find(
    (p) => spawnSync(p, ["--list-sdks"], { encoding: "utf8" }).status === 0,
  );
const cli = `${root}/imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverterCmd/bin/Release/net10.0/ImeWlConverterCmd.dll`;
await page.goto("http://127.0.0.1:5173/zh-hans/");
await page.waitForFunction(
  () => document.querySelector(".engine-status")?.textContent.includes("就绪"),
  undefined,
  { timeout: 120000 },
);
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await page.snapshot();
// UI path: demo, real conversion, download, ZIP, native picker, searchable format.
await page.click("text=用示例试试看");
assert.match(await page.evaluate(() => document.querySelector('.format-picker input').value), /word/);
await page.fill('.format-picker input >> nth=0', 'scel');
await page.press('.format-picker input >> nth=0', 'ArrowDown');
await page.press('.format-picker input >> nth=0', 'Enter');
await page.click('.desktop-action .convert-button');
await page.waitForSelector('.error-panel', { state: 'visible', timeout: 30000 });
const sampleError = await page.evaluate(() => document.querySelector('.error-message').textContent);
assert.match(sampleError, /SCEL/);
assert.match(sampleError, /word/);
assert.doesNotMatch(sampleError, /IO_EOF_ReadBeyondEOF/);
assert.equal(sampleError.split('示例词库.txt').length - 1, 1);
assert.equal(await page.evaluate(() => document.activeElement.id), 'conversion-error');
record('TXT sample with SCEL selected explains the mismatch and identifies the file once');
await page.fill('.format-picker input >> nth=0', 'word');
await page.press('.format-picker input >> nth=0', 'ArrowDown');
await page.press('.format-picker input >> nth=0', 'Enter');
await page.click(".desktop-action .convert-button");
await page.waitForSelector(".output-file", {
  state: "visible",
  timeout: 120000,
});
assert.equal(
  await page.evaluate(
    () => document.querySelector(".engine-status").textContent,
  ),
  "转换已完成",
);
const downloadWait = page.waitForEvent("download", { timeout: 30000 });
await page.click(".download-button");
const download = await downloadWait;
await download.saveAs(`${dir}/demo.dict.yaml`);
const demo = await readFile(`${dir}/demo.dict.yaml`, "utf8");
assert.match(demo, /中国\tzhong guo\t0/);
assert.equal(demo.trim().split("\n").length, 8);
record("UI demo conversion and downloaded bytes");

await page.setInputFiles('input[aria-label="选择词库文件"]', [
  `${fixtureRoot}/唐诗300首【官方推荐】.scel`,
]);
await page.click("text=清空");
await page.setInputFiles('input[aria-label="选择词库文件"]', [
  `${fixtureRoot}/唐诗300首【官方推荐】.scel`,
]);
assert.match(
  await page.evaluate(
    () => document.querySelector(".format-picker input").value,
  ),
  /scel/,
);
await page.click(".desktop-action .convert-button");
await page.waitForSelector(".output-file", {
  state: "visible",
  timeout: 120000,
});
assert.match(
  await page.evaluate(
    () => document.querySelector(".output-summary p").textContent,
  ),
  /3,563/,
);
const scelWait = page.waitForEvent("download", { timeout: 30000 });
await page.click(".download-button");
await (await scelWait).saveAs(`${dir}/ui-scel.dict.yaml`);
record("UI SCEL detection, conversion, download", { entries: 3563 });

await writeFile(`${dir}/additional.txt`, "你好\n");
await page.click("text=清空");
await page.click("text=用示例试试看");
await page.setInputFiles('input[aria-label="选择词库文件"]', [
  `${dir}/additional.txt`,
]);
await page.click("text=逐个文件转换");
await page.click(".desktop-action .convert-button");
await page.waitForSelector(".zip-button", {
  state: "visible",
  timeout: 120000,
});
const zipWait = page.waitForEvent("download", { timeout: 30000 });
await page.click(".zip-button");
await (await zipWait).saveAs(`${dir}/outputs.zip`);
const { createRequire } = await import("node:module");
const require = createRequire(`${root}/package.json`);
const { unzipSync } = require("fflate");
const archive = unzipSync(await readFile(`${dir}/outputs.zip`));
assert.equal(Object.keys(archive).length, 2);
assert.match(
  new TextDecoder().decode(archive["additional.dict.yaml"]),
  /你好\tni hao\t0/,
);
record("UI per-file conversion and downloaded ZIP contents");
await page.fill('.format-picker input >> nth=0', 'gboardbin');
await page.press('.format-picker input >> nth=0', 'ArrowDown');
await page.press('.format-picker input >> nth=0', 'Enter');
assert.match(await page.evaluate(() => document.querySelector('.format-picker input').value), /gboardbin/);
record('Search formats and select with keyboard');

// Exercise the public Engine client with real Files and the production worker.
await page.evaluate(async () => {
  const { Engine } = await import("/src/engine.ts");
  const { defaults } = await import("/src/config.ts");
  window.testEngine = new Engine();
  window.testDefaults = defaults;
  window.testOutputs = {};
  window.testCaps = await window.testEngine.init();
  window.runConversion = async ({
    source,
    text,
    name = "input.txt",
    from = "word",
    to = "rime",
    settings = {},
    filter,
    mode = "merge",
    second,
    mapping,
  }) => {
    const options = { ...structuredClone(window.testDefaults), ...settings };
    if (filter)
      options.filter = { ...options.filter, noFilter: false, ...filter };
    const files = [
      new File([source ? new Uint8Array(source) : text || ""], name),
    ];
    if (second)
      files.push(
        new File(
          [second.bytes ? new Uint8Array(second.bytes) : second.text],
          second.name,
        ),
      );
    const result = await window.testEngine.convert(
      {
        files,
        from,
        to,
        settings: options,
        mode,
        mapping: mapping ? new File([mapping], "mapping.tsv") : null,
      },
      () => {},
    );
    window.testOutputs.last = result;
    return {
      errors: result.errors,
      outputs: result.outputs.map((o) => ({
        ...o,
        data: Array.from(o.data),
        preview: o.preview,
      })),
    };
  };
});
const caps = await page.evaluate(() => window.testCaps);
assert.equal(caps.importers.length, 54);
assert.equal(caps.exporters.length, 46);
assert.ok(caps.generators.some((g) => g.id === "UserDefine"));
record("Runtime capabilities", {
  importers: caps.importers.length,
  exporters: caps.exporters.length,
  generators: caps.generators.length,
});

for (const [name, file, from, code] of [
  ["scel-rime", "唐诗300首【官方推荐】.scel", "scel", "NoCode"],
  ["gboard-rime", "GBoard_dictionary.txt", "gboard", "Pinyin"],
  ["gboardbin-rime", "gboard_user_dict.dict", "gboardbin", "NoCode"],
  ["word-rime", "纯汉字.txt", "word", "Pinyin"],
]) {
  const bytes = [...(await readFile(`${fixtureRoot}/${file}`))];
  const result = await page.evaluate((arg) => window.runConversion(arg), {
    source: bytes,
    name: file,
    from,
    settings: { code, rank: "1" },
  });
  assert.equal(result.errors.length, 0);
  assert.ok(result.outputs[0].exported > 0);
  const browserBytes = Buffer.from(result.outputs[0].data);
  await writeFile(`${dir}/${name}.dict.yaml`, browserBytes);
  const run = spawnSync(
    dotnet,
    [
      cli,
      "-i",
      from,
      "-o",
      "rime",
      "-r",
      "1",
      "-O",
      `${dir}/native-${name}.dict.yaml`,
      "--json",
      `${fixtureRoot}/${file}`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(
    browserBytes,
    await readFile(`${dir}/native-${name}.dict.yaml`),
  );
  record(`Native byte comparison: ${name}`, {
    entries: result.outputs[0].exported,
    sha256: createHash("sha256").update(browserBytes).digest("hex"),
  });
}

let result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n你好\n输入法\nabc\n1\n",
  settings: { code: "Pinyin", rank: "42" },
  filter: {
    wordLengthFrom: 2,
    wordLengthTo: 2,
    ignoreEnglish: true,
    ignoreNumber: true,
  },
});
assert.equal(result.outputs[0].exported, 2);
assert.match(result.outputs[0].preview, /中国\tzhong guo\t42/);
assert.doesNotMatch(result.outputs[0].preview, /输入法|abc/);
record("Length/category filters and fixed frequency");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国abc\n你好123\n",
  to: "word",
  filter: { replaceEnglish: true, replaceNumber: true },
});
assert.match(result.outputs[0].preview, /中国\r?\n你好/);
assert.doesNotMatch(result.outputs[0].preview, /abc|123/);
record("Registered English and number removal transforms");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\tzhong guo\t0\n你好\tni hao\t1\n",
  from: "rime",
  to: "word",
  filter: { wordRankFrom: 1 },
});
assert.equal(result.outputs[0].exported, 1);
assert.match(result.outputs[0].preview, /你好/);
record("Frequency filter boundary excludes zero rank");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n词库\n",
  to: "word",
  settings: { chinese: "SimplifiedToTraditional" },
});
assert.match(result.outputs[0].preview, /中國/);
assert.match(result.outputs[0].preview, /詞庫/);
record("Simplified to traditional");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中\n国\n",
  settings: { code: "Wubi86" },
});
assert.match(result.outputs[0].preview, /中\tkh/);
record("Registered Wubi generator");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "b\na\nc\n",
  to: "word",
  settings: { sort: "ByWord", descending: true },
});
assert.equal(
  result.outputs[0].preview.replace(/^\uFEFF/, ""),
  "c\r\nb\r\na\r\n",
);
record("Explicit output sorting");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
  to: "self",
  settings: { code: "Pinyin", rank: "7", customFormat: "213 ,nyyy" },
});
assert.match(result.outputs[0].preview, /中国,zhong guo,7/);
record("Custom text export specification");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
  settings: { code: "UserDefine", multiCode: "code_e2=p11+p12+p21+p22" },
  mapping: "中\tab\n国\tcd\n",
});
assert.match(result.outputs[0].preview, /中国\tabcd\t0/);
record("In-memory custom mapping and multi-character rule");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
  to: "scel",
  settings: {
    code: "Pinyin",
    dictionaryId: "abc123",
    dictionaryName: "本地测试词库",
    dictionaryCategory: "验收分类",
    dictionaryDescription: "浏览器本地转换",
  },
});
const binary = Buffer.from(result.outputs[0].data);
assert.equal(result.outputs[0].isBinary, true);
assert.equal(result.outputs[0].preview, null);
assert.ok(binary.includes(Buffer.from("本地测试词库", "utf16le")));
assert.ok(binary.includes(Buffer.from("验收分类", "utf16le")));
assert.ok(binary.includes(Buffer.from("浏览器本地转换", "utf16le")));
record("SCEL binary output and embedded metadata");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
  name: "same.txt",
  settings: { code: "Pinyin" },
  second: { text: "你好\n", name: "same.txt" },
  mode: "merge",
});
assert.equal(result.outputs.length, 1);
assert.equal(result.outputs[0].exported, 2);
record("Merge multiple files");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
  name: "same.txt",
  settings: { code: "Pinyin" },
  second: { text: "你好\n", name: "same.txt" },
  mode: "separate",
});
assert.equal(result.outputs.length, 2);
assert.equal(new Set(result.outputs.map((o) => o.name)).size, 2);
record("Sequential per-file outputs and duplicate names");
const scel = [...(await readFile(`${fixtureRoot}/唐诗300首【官方推荐】.scel`))];
result = await page.evaluate((arg) => window.runConversion(arg), {
  source: scel,
  name: 'renamed.txt',
  from: 'scel',
});
assert.equal(result.errors.length, 0);
assert.equal(result.outputs[0].exported, 3563);
record('Real SCEL content remains importable after renaming to TXT');
const incompleteScel = new Uint8Array(0x1544);
incompleteScel.set(scel.slice(0, 8));
incompleteScel[0x1540] = 1; // Claims one pinyin record, but the record is absent.
const truncatedError = await page.evaluate(async source => {
  try {
    await window.runConversion({ source, name: 'truncated.scel', from: 'scel' });
    return null;
  } catch (error) {
    return error.message;
  }
}, [...incompleteScel]);
assert.match(truncatedError, /内容可能不完整/);
assert.doesNotMatch(truncatedError, /IO_EOF_ReadBeyondEOF/);
assert.equal(truncatedError.split('truncated.scel').length - 1, 1);
record('Truncated SCEL parser failure has a readable error and one filename');
result = await page.evaluate((arg) => window.runConversion(arg), {
  source: scel,
  name: "good.scel",
  from: "scel",
  second: { bytes: [0, 1, 2], name: "broken.scel" },
  mode: "separate",
});
assert.equal(result.outputs.length, 1);
assert.equal(result.errors.length, 1);
assert.match(result.errors[0], /broken.scel/);
record("Per-file partial failure retains successful output");
const mergedFailure = await page.evaluate(
  async (arg) => {
    try {
      await window.runConversion(arg);
      return null;
    } catch (e) {
      return e.message;
    }
  },
  {
    source: scel,
    name: "good.scel",
    from: "scel",
    second: { bytes: [0, 1, 2], name: "broken.scel" },
    mode: "merge",
  },
);
assert.match(mergedFailure, /broken.scel/);
record("Merge failure identifies bad file");
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
});
assert.equal(result.outputs[0].exported, 0);
record("Missing code produces explicit zero-entry result");
const zipError = await page.evaluate(async () => {
  try {
    await window.runConversion({
      text: "PK",
      name: "backup.zip",
      from: "gboard",
    });
    return null;
  } catch (e) {
    return e.message;
  }
});
assert.match(zipError, /解压/);
record("Unsupported ZIP input is rejected");
const cancellation = await page.evaluate(async () => {
  const options = { ...structuredClone(window.testDefaults), code: "Pinyin" };
  let ticks = 0;
  const timer = setInterval(() => ticks++, 10);
  const promise = window.testEngine.convert(
    {
      files: [new File(["中国\n".repeat(250000)], "large.txt")],
      from: "word",
      to: "rime",
      mode: "merge",
      settings: options,
      mapping: null,
    },
    () => {},
  );
  setTimeout(() => window.testEngine.reset(), 100);
  let error;
  try {
    await promise;
  } catch (e) {
    error = e.message;
  }
  clearInterval(timer);
  return { ticks, error };
});
assert.ok(cancellation.ticks >= 2);
assert.match(cancellation.error, /取消/);
result = await page.evaluate((arg) => window.runConversion(arg), {
  text: "中国\n",
  settings: { code: "Pinyin" },
});
assert.equal(result.outputs[0].exported, 1);
record("Worker cancellation, responsive UI and runtime recovery", cancellation);

// Layout, reduced motion, keyboard access and actual mobile UI conversion.
await page.reload();
await page.waitForFunction(
  () => document.querySelector(".engine-status")?.textContent.includes("就绪"),
  undefined,
  { timeout: 120000 },
);
for (const width of [375, 768, 1024, 1440]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(metrics.content <= metrics.width, JSON.stringify(metrics));
  assert.equal(metrics.width, width, 'Mobile layout viewport must not expand around overflowing content');
  await page.screenshot({ path: `${dir}/layout-${width}.png` });
  record(`Responsive width ${width}`, metrics);
}
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 812,
  height: 375,
  deviceScaleFactor: 1,
  mobile: true,
});
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
);
record("Phone landscape");
await page.cdp("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
assert.equal(
  await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  ),
  true,
);
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 812,
  deviceScaleFactor: 1,
  mobile: true,
});
await page.snapshot();
await page.click("text=用示例试试看");
await page.click(".mobile-action .convert-button");
await page.waitForSelector(".output-file", {
  state: "visible",
  timeout: 120000,
});
assert.match(
  await page.evaluate(
    () => document.querySelector(".output-summary p").textContent,
  ),
  /导出 8 条/,
);
record("Mobile viewport conversion with reduced motion");
await page.screenshot({ path: `${dir}/mobile-result.png` });
await page.reload();
await page.waitForFunction(() => document.querySelector('.engine-status')?.textContent.includes('就绪'), undefined, { timeout: 120000 });
await page.evaluate(() => {
  const elements = [...document.querySelectorAll('body *')].filter(e => e instanceof HTMLElement)
    .map(e => [e, parseFloat(getComputedStyle(e).fontSize)]);
  for (const [element, size] of elements) element.style.fontSize = `${size * 2}px`;
});
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
await page.screenshot({ path: `${dir}/enlarged-text-200.png` });
record('Two-times text size at 375px without horizontal overflow');
const injection = await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `const OriginalWorker = window.Worker; window.Worker = class { constructor(...args) { if (!window.allowTestWorker) throw new Error('模拟引擎加载失败'); return new OriginalWorker(...args); } };`,
});
await page.reload();
await page.waitForSelector('.error-panel', { state: 'visible', timeout: 30000 });
assert.equal(await page.evaluate(() => document.activeElement.id), 'conversion-error');
await page.evaluate(() => { window.allowTestWorker = true; });
await page.click('text=重新加载引擎');
await page.waitForFunction(() => document.querySelector('.engine-status')?.textContent.includes('就绪'), undefined, { timeout: 120000 });
await page.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
record('Startup failure focuses error and retry loads real runtime');
await page.cdp("Emulation.clearDeviceMetricsOverride");
await page.cdp("Emulation.setEmulatedMedia", { features: [] });
await writeFile(
  `${dir}/browser-results.json`,
  JSON.stringify(
    { browser: "Ego Lite / Chromium", realDevice: false, checks },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    passed: checks.length,
    report: `${dir}/browser-results.json`,
  }),
);
if (finish) await task.finish({ keep: [] });
