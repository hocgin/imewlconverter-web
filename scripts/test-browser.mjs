import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
let script = (
  await readFile(new URL(process.argv.includes('--localization') ? '../tests/localization.mjs' : process.argv.includes('--formats') ? '../tests/format-picker.mjs' : '../tests/browser.mjs', import.meta.url), "utf8")
)
  .replace('"__PROJECT_ROOT__"', JSON.stringify(root))
  .replace('"__FINISH__"', String(!process.argv.includes("--keep-task")));
if (process.argv.includes('--online')) {
  const ts = await import('typescript');
  const engine = ts.transpileModule((await readFile(new URL('../src/engine.ts',import.meta.url),'utf8')).replace('import.meta.env.BASE_URL',JSON.stringify('/')), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const config = ts.transpileModule((await readFile(new URL('../src/config.ts',import.meta.url),'utf8')).replace(/import limits from [^;]+;/,`const limits = ${await readFile(new URL('../shared/limits.json',import.meta.url),'utf8')};`), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const dataUrl = source => 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  script=script.replace('taskSpace("词库转转实现验收")','taskSpace("词库转转线上逐项验收")')
    .replace('http://127.0.0.1:5173/zh-hans/','https://dict.aipan.app/zh-hans/')
    .replace('artifacts/verification','artifacts/verification/online')
    .replace('"/src/engine.ts"',JSON.stringify(dataUrl(engine)))
    .replace('"/src/config.ts"',JSON.stringify(dataUrl(config)));
  script=script.replace('// Layout, reduced motion, keyboard access and actual mobile UI conversion.',await readFile(new URL('../tests/format-matrix.mjs',import.meta.url),'utf8')+'\n// Layout, reduced motion, keyboard access and actual mobile UI conversion.');
}
const result = spawnSync("ego-browser", ["nodejs"], {
  input: script,
  stdio: ["pipe", "inherit", "inherit"],
  maxBuffer: 10 * 1024 * 1024,
});
if (result.error)
  console.error(
    "浏览器测试需要 Ego Lite 与 ego-browser CLI。",
    result.error.message,
  );
process.exit(result.status ?? 1);
