import { dotnet } from "./_framework/dotnet.js";
import { conversionErrorMessage, inputValidationMessage, uniqueName } from "./utils.mjs";

let currentId = 0;
const limitsReady = fetch(new URL("./limits.json", import.meta.url)).then(
  (response) => {
    if (!response.ok) throw new Error("无法加载转换配置，请重试。");
    return response.json();
  },
);
const ready = (async () => {
  const { getAssemblyExports, getConfig, setModuleImports, runMain } =
    await dotnet.withDiagnosticTracing(false).create();
  let lastReport = 0;
  setModuleImports("bridge", {
    progress(stage, current, total) {
      const now = performance.now();
      if (now - lastReport > 70 || current === total || !current) {
        self.postMessage({
          id: currentId,
          type: "progress",
          progress: { stage, current, total },
        });
        lastReport = now;
      }
    },
  });
  await runMain();
  return (await getAssemblyExports(getConfig().mainAssemblyName))
    .BrowserConverter;
})();
// Observe a startup rejection even if no request has arrived yet.
ready.catch(() => {});
limitsReady.catch(() => {});
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(() => handle(data)).catch(() => {});
};

async function handle(message) {
  currentId = message.id;
  let initialized = false;
  try {
    const api = await ready;
    const limits = await limitsReady;
    initialized = true;
    if (message.type === "init") {
      self.postMessage({
        id: message.id,
        result: JSON.parse(api.Capabilities()),
      });
      return;
    }
    if (message.type !== "convert") throw new Error("未知引擎请求。");
    const { files, from, to, mode, settings, mapping } = message.request;
    if (
      !files.length ||
      files.length > limits.maxFiles ||
      files.reduce((n, f) => n + f.size, 0) > limits.maxInputBytes
    )
      throw new Error("文件数量或大小超出限制。");
    if (files.some((f) => f.name.toLowerCase().endsWith(".zip")))
      throw new Error("请先解压 ZIP 文件。");
    if (mapping && mapping.size > limits.maxMappingBytes)
      throw new Error("自定义编码映射表不能超过 5 MB。");
    const mappingText = mapping ? await mapping.text() : "";
    const outputs = [],
      errors = [],
      used = new Set();
    const groups = mode === "merge" ? [files] : files.map((file) => [file]);
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      api.Begin();
      try {
        for (const file of group) {
          self.postMessage({
            id: message.id,
            type: "progress",
            progress: {
              stage: `正在读取 ${file.name}`,
              current: index + 1,
              total: groups.length,
            },
          });
          const bytes = new Uint8Array(await file.arrayBuffer());
          const invalid = inputValidationMessage(from, bytes);
          if (invalid) throw new Error(`${file.name}：${invalid}`);
          api.AddInput(file.name, bytes);
        }
        const metadata = JSON.parse(
          await api.Convert(from, to, JSON.stringify(settings), mappingText),
        );
        // byte[] JS interop returns a copied JS array, independent of the WASM heap.
        const bytes = api.TakeOutput();
        const extension = metadata.extension.startsWith(".")
          ? metadata.extension
          : `.${metadata.extension}`;
        const stem =
          group.length > 1
            ? "合并词库"
            : group[0].name.replace(/(?:\.dict\.ya?ml|\.[^.]+)$/i, "");
        const base = (stem || "转换词库").replace(
          /[\\/:*?"<>|\u0000-\u001f]/g,
          "_",
        );
        const name = uniqueName(`${base}${extension}`, used);
        outputs.push({
          ...metadata,
          name,
          data: bytes,
          source: group.map((f) => f.name).join("、"),
        });
      } catch (error) {
        const detail = conversionErrorMessage(
          error?.message || String(error),
          group.map((f) => f.name),
        );
        if (mode === "merge") throw new Error(detail);
        errors.push(detail);
      } finally {
        api.Begin();
      }
    }
    self.postMessage(
      { id: message.id, result: { outputs, errors } },
      outputs.map((o) => o.data.buffer),
    );
  } catch (error) {
    self.postMessage({
      id: message.id,
      error: error?.message || String(error),
      fatal: !initialized,
    });
  }
}
