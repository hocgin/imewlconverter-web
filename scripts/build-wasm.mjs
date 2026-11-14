import { spawnSync } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  readdir,
  rm,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const destination = join(root, "public/engine");
const sourceHash = createHash("sha256");
for (const path of [
  "wasm-host/Program.cs",
  "wasm-host/worker.js",
  "wasm-host/Converter.Host.csproj",
  "shared/limits.json",
  "src/utils.mjs",
  "global.json",
])
  sourceHash.update(await readFile(join(root, path)));
const revision = spawnSync(
  "git",
  ["-C", "imewlconverter-wasm/upstream/imewlconverter", "rev-parse", "HEAD"],
  { cwd: root, encoding: "utf8" },
);
sourceHash.update(revision.stdout || "");
const signature = sourceHash.digest("hex");
const stampPath = join(destination, ".source-hash");
if (
  process.argv.includes("--if-missing") &&
  (await exists(join(destination, "_framework/dotnet.js"))) &&
  (await exists(stampPath)) &&
  (await readFile(stampPath, "utf8")) === signature
)
  process.exit(0);
if (
  !(await exists(
    join(
      root,
      "imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverter.Application/ImeWlConverter.Application.csproj",
    ),
  ))
) {
  console.error(
    "缺少引擎源码。请运行 git submodule update --init --recursive 后重试。",
  );
  process.exit(1);
}
const candidates = [
  process.env.DOTNET,
  "dotnet",
  "/tmp/imewl-dotnet/dotnet",
].filter(Boolean);
const dotnet = candidates.find((command) =>
  spawnSync(command, ["--list-sdks"], { encoding: "utf8" }).stdout?.match(
    /^10\./m,
  ),
);
if (!dotnet) {
  console.error(
    "需要 .NET 10 SDK。请安装并加入 PATH，或设置 DOTNET=/path/to/dotnet。",
  );
  process.exit(1);
}
const result = spawnSync(
  dotnet,
  [
    "publish",
    "wasm-host/Converter.Host.csproj",
    "-c",
    "Release",
    "-o",
    "artifacts/wasm",
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0) {
  console.error(
    `WASM 构建失败。确认已运行 ${dotnet} workload install wasm-tools。`,
  );
  process.exit(result.status || 1);
}
async function findRuntime(path) {
  if (await exists(join(path, "dotnet.js"))) return path;
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) {
      const found = await findRuntime(join(path, item.name));
      if (found) return found;
    }
  }
}
const publishedFramework = join(root, "artifacts/wasm/wwwroot/_framework");
const runtime = (await exists(join(publishedFramework, "dotnet.js")))
  ? publishedFramework
  : await findRuntime(join(root, "artifacts/wasm"));
if (!runtime) throw new Error("构建产物中缺少 dotnet.js。");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(runtime, join(destination, "_framework"), { recursive: true });
await cp(join(root, "wasm-host/worker.js"), join(destination, "worker.js"));
await cp(join(root, "shared/limits.json"), join(destination, "limits.json"));
await cp(join(root, "src/utils.mjs"), join(destination, "utils.mjs"));
await writeFile(stampPath, signature);
console.log("WASM 引擎已准备就绪：public/engine");
