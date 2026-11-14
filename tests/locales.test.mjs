import { test } from "node:test";
import assert from "node:assert/strict";
import { localeFromPath, matchLanguage } from "../src/locales.mjs";

test("browser language matching respects priority, scripts and Chinese regions", () => {
  for (const [input, expected] of [
    [["fr-FR"], "en"],
    [[], "en"],
    [["en-GB", "zh-TW"], "en"],
    [["fr", "zh-CN"], "zh-hans"],
    [["zh"], "zh-hans"],
    [["zh-SG"], "zh-hans"],
    [["zh-TW"], "zh-hant"],
    [["zh-HK"], "zh-hant"],
    [["zh-MO"], "zh-hant"],
    [["zh-Hans-HK"], "zh-hans"],
    [["zh-Hant-CN"], "zh-hant"],
    [["ZH_tw"], "zh-hant"],
  ])
    assert.equal(matchLanguage(input), expected, input.join(", "));
});

test("explicit locale paths are independent of browser language", () => {
  assert.equal(localeFromPath("/en/"), "en");
  assert.equal(localeFromPath("/zh-hans/"), "zh-hans");
  assert.equal(localeFromPath("/zh-hant/"), "zh-hant");
  assert.equal(localeFromPath("/"), null);
  assert.equal(localeFromPath("/unknown/"), null);
});
