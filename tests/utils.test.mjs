import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  conversionErrorMessage,
  detectFormat,
  inputValidationMessage,
  uniqueName,
  validationMessage,
} from "../src/utils.mjs";

test("SCEL import rejects text and truncated content before binary parsing", () => {
  const sample = new TextEncoder().encode("中国\n你好\n输入法\n自由\n词库\n转转\n世界\n开源\n");
  assert.equal(sample.length, 59);
  assert.match(inputValidationMessage("scel", sample), /word/);
  assert.match(inputValidationMessage("scel", new Uint8Array()), /SCEL/);
  const incomplete = new Uint8Array(0x1543);
  incomplete.set([0x40, 0x15, 0, 0, 0x44, 0x43, 0x53, 1]);
  assert.match(inputValidationMessage("scel", incomplete), /不完整/);
  assert.match(inputValidationMessage("scel", new Uint8Array(0x1544)), /SCEL/);
  assert.equal(inputValidationMessage("word", sample), "");
});

test("SCEL content validation accepts real and engine-exported dictionaries", async () => {
  for (const path of [
    "../imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverterCoreTest/Test/唐诗300首【官方推荐】.scel",
    "../imewlconverter-wasm/poc/wasm/reports/cli-rime-scel.scel",
  ]) {
    const bytes = await readFile(new URL(path, import.meta.url));
    assert.equal(inputValidationMessage("scel", bytes), "");
  }
});

test("import errors identify the bad file once and explain read failures", () => {
  const detail = conversionErrorMessage("示例词库.txt：IO_EOF_ReadBeyondEOF", ["示例词库.txt"]);
  assert.equal(detail.split("示例词库.txt").length - 1, 1);
  assert.match(detail, /输入格式/);
  assert.doesNotMatch(detail, /IO_EOF/);
  assert.equal(
    conversionErrorMessage("broken.scel：失败", ["good.scel", "broken.scel"]),
    "broken.scel：失败",
  );
  assert.equal(conversionErrorMessage("导出失败", ["a.txt", "b.txt"]), "a.txt、b.txt：导出失败");
});

test("ambiguous filename extensions never silently choose an importer", () => {
  for (const file of ["a.txt", "a.bin", "a.dat", "a.zip", "user_dict.dict"])
    assert.equal(detectFormat(file), null);
  assert.equal(detectFormat("唐诗.SCEL"), "scel");
  assert.equal(detectFormat("基础.dict.yaml"), "rime");
});
test("duplicate output names preserve compound extensions", () => {
  const used = new Set();
  assert.equal(uniqueName("基础.dict.yaml", used), "基础.dict.yaml");
  assert.equal(uniqueName("基础.dict.yaml", used), "基础-2.dict.yaml");
  assert.equal(uniqueName("基础.dict.yaml", used), "基础-3.dict.yaml");
});
test("invalid ranges and missing code maps are rejected before conversion", () => {
  const s = {
    filter: { noFilter: true },
    code: "NoCode",
    rank: "",
    dictionaryId: "",
    multiCode: "",
  };
  assert.equal(validationMessage(s, null), "");
  assert.match(validationMessage({ ...s, code: "UserDefine" }, null), /映射/);
  assert.match(validationMessage({ ...s, code: "UserDefine" }, {}), /规则/);
  assert.match(validationMessage({ ...s, rank: "-1" }, null), /词频/);
  assert.match(validationMessage({ ...s, rank: "2147483648" }, null), /词频/);
  assert.match(
    validationMessage(
      { ...s, filter: { noFilter: false, wordLengthFrom: NaN } },
      null,
    ),
    /整数/,
  );
  assert.match(validationMessage({ ...s, dictionaryId: "1234567" }, null), /6/);
});
