# 词库转转

基于深蓝词库转换引擎的浏览器本地词库转换网站。React + Vite + TypeScript、HeroUI v3、Tailwind CSS v4，独立 .NET 10 WebAssembly 宿主运行在 Web Worker 中。采用奶油白、亮黄、电蓝的 Neubrutalism 界面，适配手机、平板和桌面。

## 本地开发

需要 Node.js 22.18+、pnpm 10、.NET 10 SDK 与 `wasm-tools` 工作负载。

```sh
git submodule update --init --recursive
dotnet workload install wasm-tools
pnpm install
pnpm dev
```

默认打开 <http://127.0.0.1:5173/>。可用 `DOTNET=/path/to/dotnet pnpm dev` 指定 SDK；构建脚本也会检查本机已存在的 `/tmp/imewl-dotnet/dotnet`。开发命令会在宿主源码或固定引擎版本变化时重新构建 WASM。开发服务器启动后修改宿主代码，请执行 `pnpm build:wasm` 并刷新页面。

```sh
pnpm check          # TypeScript 检查
pnpm test           # 格式建议、文件名、选项校验测试
pnpm test:formats   # 生产预览中的格式菜单点击、搜索、键盘回归（需 Ego Lite）
pnpm build:wasm     # 独立构建引擎并复制至 public/engine
pnpm build          # 构建整个静态网站至 dist/
pnpm preview        # 预览 dist/，默认 127.0.0.1:4173
```

`pnpm build` 不会自动修改或拉取子模块，缺失源码时会输出明确提示。SDK 工作负载与递归子模块应在 CI 中提前准备。

## 转换流程

- 选择或拖入同格式词库，搜索并确认输入、输出格式。默认输出 Rime，TXT、BIN、DAT 等有歧义的扩展名不会自动选定格式。
- 默认合并输出，也可以逐文件转换、单独下载或本地打包为 ZIP。合并时任何文件解析异常都会终止本次转换；逐文件模式保留其余成功结果。
- 高级选项包括实际注册的编码生成器、自定义映射、简繁转换、词长与词频过滤、字符移除、排序、固定词频、自定义文本布局及 SCEL 元数据。
- 默认保留原编码、词频与顺序，不过滤、不自动去重。纯词表导出至 Rime 等需要编码的格式时应开启拼音生成。
- 运行期间可取消；取消直接终止 Worker，下一次转换重新启动运行时，保留已选择的文件和设置。
- 文件只存在于当前浏览器页面内存中。网站不包含转换后端、账号、远程 LLM 或词库上传接口。

限制统一定义在 `shared/limits.json`：总输入 50 MiB、最多 100 个文件、超过 10 MiB 提示内存占用、自定义映射表最多 5 MiB。Worker 与 C# 宿主均校验输入限制。大型词库尤其可能超出移动设备的内存能力。

## 已知边界

- 固定版本引擎注册了 54 个导入器、46 个导出器。界面中的“有样例验证”只对应特定真实样本，不表示所有格式方向、任意文件或输入法内安装均已通过验证。
- Rime 导出是词条 TSV，扩展名为 `.dict.yaml`，没有 YAML 元数据头，并由原导出器固定按词频降序排列。
- Big5 输入存在上游解码错误；部分导入导出器忽略显式文本编码。选项旁及结果中会提示。
- ZIP 输入未实现。Gboard 备份需要先解压，文本词库和二进制 `user_dict_3_3` 分别使用 `gboard`、`gboardbin`。
- SCEL 等格式可能丢失原始词频。网站保留格式算法行为，不声称完成所有兼容性修复。
- 部分格式需要浏览器无法使用的能力，调用时会显示错误；这些格式保留在完整目录中并标注待验证。

宿主仅适配内存流、选项、排序和消息传输，复用上游导入、变换及导出实现；没有修改引擎子模块和历史 PoC。另补接了上游已有但默认未注册的英文字符移除变换，确保网页选项生效；范围过滤始终按网页填写的上下界调用上游过滤器。SCEL 的二进制元数据在宿主中纠正，用于隐藏文本预览。文本预览最多 2,000 字符，并识别 BOM。

## 自动化验收

`pnpm test:browser` 需要正在运行的开发服务器，以及 Ego Lite、`ego-browser` CLI。测试使用专用 TaskSpace，默认在结束时关闭。运行前构建上游原生 CLI，供真实转换结果对照：

```sh
dotnet build imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverterCmd -c Release
pnpm dev
# 另一个终端
pnpm test:browser
```

测试覆盖界面真实下载、批量 ZIP、SCEL/Gboard 文本/Gboard 二进制/TXT 对照、高级变换、失败与取消恢复，以及 375/768/1024/1440px 布局。报告、下载文件与截图写入忽略的 `artifacts/verification/`。原生逐字节对照显式设定词频为 1，避免 CLI 默认补词频与网页默认保留零词频之间的差异；另有测试独立验证默认保留零词频。

Firefox 可在启动本机 Geckodriver 后执行 `python3 tests/firefox.py`，通过 `WEBDRIVER_URL`、`FIREFOX_BINARY` 覆盖默认本机路径。

本次执行范围和未验证平台记录在 [验证记录](docs/verification.md)。移动视口模拟不等于 iOS 真机验收。

## 静态部署

部署 `dist/` 全部内容，当前按站点根路径 `/` 构建。确保 Worker 与 `_framework` 资源保持同源，`.wasm` 使用 `application/wasm`，不要将缺失引擎文件重写成 `index.html`。若启用 Brotli/Gzip 静态压缩，需正确设置 `Content-Encoding`。源码完整构建不要求后端，也不要求额外的跨源隔离响应头。

生产域名为 https://dict.aipan.app/，使用 Cloudflare Workers Static Assets。

```sh
pnpm deploy
```

部署命令先构建真实 WASM 和前端，再通过已固定版本的 cf CLI 上传预构建静态资源；域名、账户与兼容日期定义在 `cloudflare.config.ts`。首次在新设备上部署前运行 `pnpm exec cf auth login` 登录对应账户。`pnpm exec cf deploy --prebuilt --mode production --dry-run` 可检查当前打包产物。

## 许可与来源

本项目遵循 [GPL-3.0](LICENSE)。转换引擎为 [imewlconverter-wasm](https://github.com/hocgin/imewlconverter-wasm)，内部固定引用 [深蓝词库转换](https://github.com/studyzy/imewlconverter) 的 `501a1b77d46187e0b5072f8a27550fa77454c7d1`。第三方测试语料的来源与历史证据见引擎子模块报告。
