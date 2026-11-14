# 实现验证记录

验证日期：2026-11-14。所有转换使用固定子模块中的真实引擎，未使用演示转换算法或转换后端。

部署后的全量入口样例与线上功能验收见 [线上逐项验证报告](online-validation.md)，其中包含 54 个导入入口和 46 个导出入口的逐项明细、复核过程及样本兼容限制。

## Cloudflare 生产部署

已部署至 https://dict.aipan.app/，Worker 为 `imewlconverter-web`，版本 ID 为 `b5a59159-6875-475c-aa7f-69f9ab50f291`。Cloudflare 已创建自定义域名对应的受管理代理 DNS 记录，HTTPS 首页与 Worker 脚本访问通过。

已在公开域名上通过真实浏览器加载 WASM，引擎就绪后完成示例词库转换：导入/导出各 8 条，实际下载 144 字节，与本地验证文件逐字节相同。部署记录为 `artifacts/verification/cloudflare-deployment.json`。后续使用 `pnpm deploy` 更新站点。

## 已通过

| 范围 | 验证结果 |
| --- | --- |
| 构建与类型 | pnpm 10 冻结锁文件安装、独立 .NET 10 WASM 发布、TypeScript 检查、Vite 生产构建通过 |
| 单元测试 | 3 项通过，覆盖歧义扩展名、重复输出文件名、无效选项与映射规则 |
| Chromium | Ego Lite 中 33 项检查通过，报告为 `artifacts/verification/browser-results.json` |
| 原生对照 | SCEL、Gboard 文本、Gboard 二进制、TXT → Rime 四组实际输出与 CLI 逐字节一致；对照显式固定词频 1 |
| 高级功能 | 长度、词频边界、字符过滤与移除、固定词频、简转繁、五笔生成、排序、自定义格式、内存映射及 SCEL 元数据通过 |
| 批量及下载 | 真实单文件下载、合并输出、逐文件输出、重名避让、ZIP 内容检查、逐文件部分失败保留结果通过 |
| 取消与恢复 | 25 万词条任务在 Worker 内执行，主线程计时仍响应；终止后可重新转换；加载失败聚焦错误并可重试 |
| 响应式 | 375 / 768 / 1024 / 1440px、手机横屏、减少动态效果、375px 下文字放大两倍均无横向溢出 |
| Firefox | Firefox WebDriver 启动真实 WASM，TXT 与 SCEL 文件选择、转换和下载通过，输出与 Chromium 字节一致，四档布局通过，共 7 项 |
| Safari 27 | 通过原生 UI 在生产预览执行示例转换，导入/导出均为 8 条；144 字节实际下载与 Chromium 字节一致 |
| 生产预览 | `dist/` 通过 Vite Preview 加载，实际转换与下载通过；主页面资源没有第三方来源 |
| 子模块 | 引擎仓库与上游源码的工作区均无代码改动 |

原始下载文件、ZIP、JSON 报告、布局截图都保存在忽略的 `artifacts/verification/`。Safari 记录为 `safari-results.json`，Firefox 为 `firefox-results.json`。生产示例与开发环境下载一致。

隐私检查覆盖前端与 Worker 的请求代码：Worker 只显式读取同源静态配置并加载 .NET 资源，转换请求通过 `postMessage` 传递，输出通过本地 Blob 下载。未接入词库上传、LLM 或服务端转换。主页面资源检查不等同于对每个待验证格式进行网络抓包。

## 验证范围限制

- 未进行 iOS Safari 真机文件提供器、内存压力及下载验收。手机视口模拟不能代替真机验证。
- Safari 本次覆盖生产示例转换与下载；没有执行完整高级功能矩阵、SCEL 原生文件选择和大型词库测试。
- 本次取消测试使用约 25 万词条，不将它作为 50 MiB 大词库或低内存设备的容量承诺。
- 54 个导入器与 46 个导出器全部可搜索、可选择，只有报告中所列的样例路径经过验证。未验证在各输入法应用中的安装与导入。
- 保留已知上游 Big5 解码、Gboard ZIP 不支持、Rime 缺少 YAML 文件头及格式特定排序/词频行为。网页会提示，未作为本次格式算法修复范围。
- Vite 成功构建时提示入口 JS 超过默认 500 kB 阈值（gzip 约 171 kB）；WASM 首次加载成本仍需在实际部署的压缩与网络环境中评估。

## 重现

### 格式菜单闪退修复

在 Codex 内置浏览器中复现过格式菜单展开后立即关闭。日志与调用栈确认：非模态菜单自动定位已选词条时调用了整页 `scrollIntoView`，入场缩放动画与页面平滑滚动进一步引发滚动校正，随即触发 React Aria 的滚动关闭逻辑。

格式菜单现在跳过入场动画，并关闭 ListBox 打开时的自动聚焦，避免自动定位所选词条造成整页滚动；全局使用即时滚动，转换完成后的显式平滑滚动保留。键盘仍可通过输入框的方向键和 Enter 选择。

已在用户的内置浏览器中完成输入/输出格式的实际指针点选、搜索、键盘选择和 Escape 关闭。临时日志与滚动跟踪均已移除。`pnpm test:formats` 提供额外的 6 项定向回归，使用 `pnpm preview` 的 4173 端口；截图为 `artifacts/verification/format-picker-fixed.png`。

按根目录 README 安装依赖与 .NET 工作负载，构建上游 CLI 并启动 `pnpm dev` 后，执行 `pnpm test:browser`。Firefox 测试需要独立 Geckodriver 端口，默认 4458，运行 `python3 tests/firefox.py`。Safari 通过原生 UI 手工复核，未开启远程自动化或额外系统权限。
