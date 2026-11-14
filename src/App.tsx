import { useI18n } from "./i18n";
import { Button, Input, Label, Spinner, TextField } from "@heroui/react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Cpu,
  FileText,
  FolderArchive,
  Github,
  HardDrive,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Advanced from "./Advanced";
import AppPromotion from "./AppPromotion";
import FormatGuide from "./FormatGuide";
import { LanguageSwitcher } from "./i18n";
import { createTranslator } from "./translate";
import CopyDiagnostics from "./CopyDiagnostics";
import { FormatPicker } from "./components";
import {
  defaults,
  MAX_FILES,
  MAX_INPUT_BYTES,
  MAX_MAPPING_BYTES,
  WARN_INPUT_BYTES,
} from "./config";
import { Engine } from "./engine";
import { detectFormat, fileSize, validationMessage } from "./utils.mjs";
import type { Capabilities, Output, Progress, Settings, Status } from "./types";
import { sampled } from "./format-info";
const message = createTranslator("zh-hans");
const statusLabels: Record<Status, string> = {
  loading: "引擎加载中",
  ready: "本地引擎已就绪",
  converting: "正在本地转换",
  cancelled: "转换已取消",
  success: "转换已完成",
  partial: "已完成，请检查提示",
  error: "需要处理一下",
};
export default function App() {
  const { t } = useI18n();
  const engine = useRef(new Engine());
  const fileInput = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const urls = useRef(new Set<string>());
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [files, setFiles] = useState<File[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("rime");
  const [mode, setMode] = useState<"merge" | "separate">("merge");
  const [settings, setSettings] = useState<Settings>(() =>
    structuredClone(defaults),
  );
  const [mapping, setMapping] = useState<File | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const errorStack = useRef<string | undefined>(undefined);
  const [diagnosticReport, setDiagnosticReport] = useState("");
  const [progress, setProgress] = useState<Progress>({
    stage: message("准备转换"),
  });
  const [dragging, setDragging] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogType, setCatalogType] = useState<"importers" | "exporters">(
    "importers",
  );
  const [packing, setPacking] = useState(false);
  const busy = status === "converting";
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  const importers = [...(caps?.importers || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const exporters = [...(caps?.exporters || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const clearUrls = () => {
    urls.current.forEach(URL.revokeObjectURL);
    urls.current.clear();
  };
  const load = async () => {
    errorStack.current = undefined;
    const id = ++sequence.current;
    engine.current.reset(message("重新加载转换引擎。"));
    setStatus("loading");
    setError("");
    try {
      const value = await engine.current.init();
      if (sequence.current !== id) return;
      setCaps(value);
      setStatus("ready");
    } catch (e) {
      if (sequence.current === id) {
        setStatus("error");
        errorStack.current = e instanceof Error ? e.stack : String(e);
        setError(e instanceof Error ? e.message : message("引擎无法启动。"));
      }
    }
  };
  useEffect(() => {
    void load();
    return () => {
      ++sequence.current;
      engine.current.reset();
      clearUrls();
    };
  }, []);
  useEffect(() => {
    if (error) document.getElementById("conversion-error")?.focus();
  }, [error]);
  useEffect(() => {
    if (!error && !errors.length) {
      setDiagnosticReport("");
      return;
    }
    const metadata = (file: File) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });
    setDiagnosticReport(
      message("词库转转 · 错误诊断信息\n") +
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            error,
            errors,
            stack: errorStack.current,
            conversion: {
              from,
              to,
              mode,
              settings,
              files: files.map(metadata),
              mapping: mapping ? metadata(mapping) : null,
            },
            engine: { status, ready: Boolean(caps), progress },
            results: outputs.map(({ data, preview, ...output }) => ({
              ...output,
              size: data.length,
            })),
            environment: {
              url: location.origin + location.pathname,
              userAgent: navigator.userAgent,
              language: navigator.language,
              languages: navigator.languages,
              platform: navigator.platform,
              online: navigator.onLine,
              secureContext: window.isSecureContext,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                pixelRatio: window.devicePixelRatio,
              },
              webAssembly: typeof WebAssembly !== "undefined",
              worker: typeof Worker !== "undefined",
            },
          },
          null,
          2,
        ),
    );
  }, [
    error,
    errors,
    from,
    to,
    mode,
    settings,
    files,
    mapping,
    caps,
    status,
    progress,
    outputs,
  ]);
  const invalidate = () => {
    errorStack.current = undefined;
    clearUrls();
    setOutputs([]);
    setErrors([]);
    setError("");
    if (caps) setStatus("ready");
  };
  const updateSettings = (value: Settings) => {
    invalidate();
    setSettings(value);
  };
  function addFiles(incoming: File[]) {
    if (busy) return;
    const all = [...files];
    for (const file of incoming)
      if (
        !all.some(
          (f) =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified,
        )
      )
        all.push(file);
    if (all.length > MAX_FILES) {
      setError(message("一次最多选择 {0} 个文件。", [MAX_FILES]));
      return;
    }
    if (all.reduce((n, f) => n + f.size, 0) > MAX_INPUT_BYTES) {
      setError(message("文件总大小不能超过 50 MB，请拆分转换。"));
      return;
    }
    invalidate();
    setFiles(all);
    const detected = new Set(
      all.map((f) => detectFormat(f.name)).filter(Boolean),
    );
    if (
      !files.length &&
      detected.size === 1 &&
      all.every((f) => detectFormat(f.name))
    )
      setFrom([...detected][0]!);
    else if (!files.length) setFrom("");
  }
  const sample = () => {
    invalidate();
    setFiles([
      new File(
        ["中国\n你好\n输入法\n自由\n词库\n转转\n世界\n开源\n"],
        t("示例词库.txt"),
        { type: "text/plain" },
      ),
    ]);
    setFrom("word");
    setTo("rime");
    setSettings({ ...structuredClone(defaults), code: "Pinyin" });
  };
  const detected = new Set(
    files.map((f) => detectFormat(f.name)).filter(Boolean),
  );
  const mixed =
    detected.size > 1 ||
    (from !== "" && [...detected].some((id) => id !== from));
  const hasZip = files.some((f) => f.name.toLowerCase().endsWith(".zip"));
  async function convert() {
    errorStack.current = undefined;
    setError("");
    const invalid =
      mapping && mapping.size > MAX_MAPPING_BYTES
        ? message("自定义编码映射表不能超过 5 MB。")
        : validationMessage(settings, mapping);
    if (!files.length || !from || !to || invalid || mixed || hasZip) {
      setError(
        invalid ||
          (!files.length
            ? message("请先选择词库文件。")
            : mixed
              ? message("检测到不同格式，请拆分为同格式任务。")
              : hasZip
                ? message("暂不支持 ZIP 输入，请先解压并选择词库文件。")
                : message("请选择输入和输出格式。")),
      );
      return;
    }
    const id = ++sequence.current;
    invalidate();
    setStatus("converting");
    setProgress({ stage: message("正在准备本地引擎…") });
    try {
      const result = await engine.current.convert(
        { files, from, to, mode, settings, mapping },
        (value) => {
          if (sequence.current === id) setProgress(value);
        },
      );
      if (sequence.current !== id) return;
      setOutputs(result.outputs);
      setErrors(result.errors);
      const hasWarnings = result.outputs.some(
        (o) => o.warnings.length || o.exportErrors || !o.exported,
      );
      setStatus(
        result.errors.length || hasWarnings
          ? result.outputs.length
            ? "partial"
            : "error"
          : "success",
      );
      if (!result.outputs.length)
        setError(message("没有生成可下载的文件，请检查下方错误与格式设置。"));
      requestAnimationFrame(() =>
        document.getElementById("results")?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "nearest",
        }),
      );
    } catch (e) {
      if (sequence.current === id) {
        setStatus("error");
        errorStack.current = e instanceof Error ? e.stack : String(e);
        setError(
          e instanceof Error ? e.message : message("转换失败，请重试。"),
        );
      }
    }
  }
  const cancel = () => {
    ++sequence.current;
    engine.current.reset();
    setStatus("cancelled");
    setProgress({ stage: message("转换已取消，文件与设置已保留。") });
  };
  function save(data: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([data as BlobPart]));
    urls.current.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }, 30000);
  }
  async function downloadZip() {
    setPacking(true);
    try {
      const { zip } = await import("fflate");
      const archive = await new Promise<Uint8Array>((resolve, reject) =>
        zip(
          Object.fromEntries(outputs.map((o) => [o.name, o.data])),
          { level: 0 },
          (err, data) => (err ? reject(err) : resolve(data)),
        ),
      );
      save(archive, message("词库转转-转换结果.zip"));
    } catch (e) {
      errorStack.current = e instanceof Error ? e.stack : String(e);
      setError(message("打包失败，请使用单个文件下载。"));
    } finally {
      setPacking(false);
    }
  }
  const runButton = (
    <Button
      className="convert-button"
      isDisabled={busy || status === "loading" || !caps}
      onPress={() => void convert()}
    >
      <Zap aria-hidden="true" size={19} fill="currentColor" />
      {t("开始转换")}
      <ArrowRight aria-hidden="true" size={21} />
    </Button>
  );
  return (
    <>
      <a href="#converter" className="skip-link">
        {t("跳转到转换工具")}
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label={t("词库转转首页")}>
          <span className="brand-icon">
            <ArrowLeftRight aria-hidden="true" size={24} strokeWidth={2.7} />
          </span>
          <span>
            {t("词库转转")}
            <span className="brand-dot">.</span>
          </span>
          <span className="web-label">WEB</span>
        </a>
        <nav aria-label={t("主导航")}>
          <a href="#formats">
            {t("支持格式")}
            <ArrowDown aria-hidden="true" size={13} />
          </a>
          <a href="#help">{t("使用指南")}</a>
          <a
            className="github-link"
            href="https://github.com/hocgin/imewlconverter-web"
            target="_blank"
            rel="noreferrer"
          >
            <Github aria-hidden="true" size={19} />
            <span>GitHub</span>
            <ArrowRight
              aria-hidden="true"
              size={14}
              className="external-arrow"
            />
          </a>
          <LanguageSwitcher />
        </nav>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              {t("为你的输入法，换个词库。")}
            </div>
            <div className="hero-title-row">
              <h1 id="hero-title">
                <span className="title-intro">{t("输入法词库，")}</span>
                <span className="title-ending">
                  <span className="highlight">
                    {t("本地转换")}
                    <svg
                      viewBox="0 0 260 14"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M3 10Q80 1 130 7T257 4" />
                    </svg>
                  </span>
                  <span className="title-period">{t("。")}</span>
                </span>
              </h1>
              <AppPromotion />
            </div>
            <p>
              {t("搜狗、Rime、Gboard… 词库格式不同，好词不必重来。")} <br />
              {t("在浏览器里轻松转换，文件始终留在你的设备上。")}
            </p>
            <div className="hero-tags">
              <span>
                <ShieldCheck aria-hidden="true" size={15} />
                {t("无需上传")}
              </span>
              <span>
                <Cpu aria-hidden="true" size={15} />
                {t("WASM 驱动")}
              </span>
              <span>
                <Check aria-hidden="true" size={15} />
                {t("免费开源")}
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-grid" />
            <div className="art-note">
              SAME WORDS.
              <br />
              NEW POSSIBILITIES.
            </div>
            <div className="format-sticker sticker-from">
              <span className="sticker-file">
                <FileText aria-hidden="true" size={26} />
              </span>
              <div>
                <b>{t("搜狗词库")}</b>
                <code>.scel</code>
              </div>
              <span className="sticker-number">01</span>
            </div>
            <div className="art-arrow">
              <ArrowDown aria-hidden="true" size={42} strokeWidth={1.8} />
            </div>
            <div className="format-sticker sticker-to">
              <span className="sticker-file">
                <FileText aria-hidden="true" size={26} />
              </span>
              <div>
                <b>{t("Rime 词库")}</b>
                <code>.dict.yaml</code>
              </div>
              <span className="sticker-number">02</span>
            </div>
            <div className="local-stamp">
              <LockKeyhole aria-hidden="true" size={16} />
              100%
              <br />
              <small>{t("本地转换")}</small>
            </div>
            <Sparkles
              aria-hidden="true"
              className="art-spark"
              size={36}
              strokeWidth={1.6}
            />
          </div>
        </section>
        <section
          className="converter"
          id="converter"
          aria-label={t("词库转换工具")}
        >
          <div className="workbench-bar">
            <span>
              <span className="workbench-dot" />
              {t("转换工作台")}
              <span className="bar-en">/ CONVERTER</span>
            </span>
            <span
              className={`engine-status ${status === "error" ? "status-error" : ""}`}
              role="status"
            >
              <span
                className={
                  status === "loading" || busy
                    ? "status-dot pulsing"
                    : "status-dot"
                }
              />
              {t(statusLabels[status])}
            </span>
          </div>
          <div className="workspace">
            <section className="upload-panel">
              <div className="step-title">
                <span className="step-number">01</span>
                <h2>{t("放入你的词库")}</h2>
                <span className="tiny-label">LOCAL FILES</span>
              </div>
              <div
                className={`dropzone ${dragging ? "dragging" : ""} ${files.length ? "has-files" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy) setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <div className="upload-illustration" aria-hidden="true">
                  <div className="mini-file back-file" />
                  <div className="mini-file front-file">
                    <ArrowDownToLine aria-hidden="true" size={27} />
                    <span />
                  </div>
                  <span className="file-plus">＋</span>
                </div>
                <h3>
                  {dragging ? t("松开文件，开始流转") : t("把词库文件拖到这里")}
                </h3>
                <p>{t("或从设备中选择，支持多个同格式文件")}</p>
                <Button
                  className="choose-button"
                  variant="secondary"
                  onPress={() => fileInput.current?.click()}
                  isDisabled={busy}
                >
                  <Plus aria-hidden="true" size={18} />
                  {t("选择词库文件")}
                </Button>
                <input
                  ref={fileInput}
                  className="sr-only"
                  aria-label={t("选择词库文件")}
                  type="file"
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
                <span className="dropzone-hint">
                  {t("SCEL / TXT / RIME / 更多格式 · 总计不超过 50 MB")}
                </span>
              </div>
              {files.length > 0 ? (
                <div className="file-list">
                  <div className="file-list-heading">
                    <span>
                      {t("已选择 {0} 个文件", [files.length])}{" "}
                      <span className="muted">/ {fileSize(bytes)}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={busy}
                      onPress={() => {
                        invalidate();
                        setFiles([]);
                        setFrom("");
                      }}
                    >
                      {t("清空")}
                    </Button>
                  </div>
                  <ul>
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        <FileText aria-hidden="true" size={20} />
                        <div>
                          <b title={f.name}>{f.name}</b>
                          <span>
                            {fileSize(f.size)} ·{" "}
                            {detectFormat(f.name)?.toUpperCase() ||
                              t("请确认输入格式")}
                          </span>
                        </div>
                        <Button
                          isIconOnly
                          variant="ghost"
                          aria-label={t("移除 {0}", [f.name])}
                          isDisabled={busy}
                          onPress={() => {
                            invalidate();
                            setFiles(files.filter((_, n) => n !== i));
                          }}
                        >
                          <X aria-hidden="true" size={17} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="sample-row">
                  <span>
                    <CircleHelp aria-hidden="true" size={15} />
                    {t("手边没有词库？")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={sample}
                    isDisabled={busy}
                  >
                    {t("用示例试试看")}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Button>
                </div>
              )}
              <div className="privacy-note">
                <LockKeyhole aria-hidden="true" size={16} />
                <p>
                  <b>{t("你的词库，只属于你。")}</b>{" "}
                  {t("文件不会上传到服务器，关闭页面后自动清除。")}
                </p>
              </div>
            </section>
            <section className="settings-panel">
              <div className="step-title">
                <span className="step-number blue-number">02</span>
                <h2>{t("选择转换方向")}</h2>
                <span className="tiny-label">MAKE THE SWITCH</span>
              </div>
              <fieldset disabled={busy} className="conversion-fields">
                <div className="format-fields">
                  <FormatPicker
                    label={t("输入格式")}
                    value={from}
                    onChange={(v) => {
                      invalidate();
                      setFrom(v);
                    }}
                    formats={importers}
                    disabled={busy || !caps}
                  />
                  <div className="direction-row">
                    <span />{" "}
                    <Button
                      isIconOnly
                      variant="ghost"
                      className="swap-button"
                      aria-label={t("交换输入与输出格式")}
                      isDisabled={
                        !from ||
                        !importers.some((f) => f.id === to) ||
                        !exporters.some((f) => f.id === from) ||
                        busy
                      }
                      onPress={() => {
                        invalidate();
                        setFrom(to);
                        setTo(from);
                      }}
                    >
                      <ArrowLeftRight aria-hidden="true" size={18} />
                    </Button>
                    <span />
                  </div>
                  <FormatPicker
                    label={t("输出格式")}
                    value={to}
                    onChange={(v) => {
                      invalidate();
                      setTo(v);
                    }}
                    formats={exporters}
                    disabled={busy || !caps}
                  />
                </div>
                <div className="mode-label">{t("多文件处理方式")}</div>
                <div
                  className="mode-control"
                  role="group"
                  aria-label={t("多文件处理方式")}
                >
                  <Button
                    variant="ghost"
                    className={mode === "merge" ? "selected" : ""}
                    aria-pressed={mode === "merge"}
                    onPress={() => {
                      invalidate();
                      setMode("merge");
                    }}
                    isDisabled={busy}
                  >
                    <CheckCheck aria-hidden="true" size={17} />
                    {t("合并为一个词库")}
                  </Button>
                  <Button
                    variant="ghost"
                    className={mode === "separate" ? "selected" : ""}
                    aria-pressed={mode === "separate"}
                    onPress={() => {
                      invalidate();
                      setMode("separate");
                    }}
                    isDisabled={busy}
                  >
                    <FileText aria-hidden="true" size={17} />
                    {t("逐个文件转换")}
                  </Button>
                </div>
                <Advanced
                  settings={settings}
                  setSettings={updateSettings}
                  caps={caps}
                  mapping={mapping}
                  setMapping={(f) => {
                    invalidate();
                    setMapping(f);
                  }}
                  from={from}
                  to={to}
                />
              </fieldset>
              <div className="context-notes">
                {to === "rime" && (
                  <p>
                    {t(
                      "Rime 输出为词条 TSV，不含 YAML 头；导入输入法前请补充词库元信息。",
                    )}
                  </p>
                )}
                {from === "word" &&
                  to === "rime" &&
                  settings.code === "NoCode" && (
                    <p className="warning-note">
                      {t(
                        "纯词表没有拼音。请在高级设置中选择“生成编码 → 拼音”。",
                      )}
                    </p>
                  )}
                {mixed && (
                  <p className="warning-note">
                    {t("检测到不同格式，请拆分为同格式任务。")}
                  </p>
                )}
                {hasZip && (
                  <p className="warning-note">
                    {t("暂不支持 ZIP 输入，请先解压 Gboard 备份。")}
                  </p>
                )}
                {bytes > WARN_INPUT_BYTES && (
                  <p className="warning-note">
                    {t("大词库可能占用较多内存，手机建议拆分转换。")}
                  </p>
                )}
              </div>
              <div className="desktop-action">
                {busy ? (
                  <Button
                    className="cancel-button"
                    variant="secondary"
                    onPress={cancel}
                  >
                    <X aria-hidden="true" size={18} />
                    {t("取消转换")}
                  </Button>
                ) : (
                  runButton
                )}
                <span className="action-caption">
                  {t("不注册 · 不上传 · 不设转换次数")}
                </span>
              </div>
            </section>
          </div>
          {(busy || status === "cancelled") && (
            <div className="progress-panel" role="status">
              {busy && <Spinner size="sm" />}
              <span>{t(progress.stage)}</span>
              {progress.total != null && progress.total > 0 && (
                <span>
                  {progress.current || 0} / {progress.total}
                </span>
              )}
            </div>
          )}
          {error && (
            <div
              className="error-panel"
              id="conversion-error"
              tabIndex={-1}
              role="alert"
            >
              <span className="error-message">{t(error)}</span>
              <CopyDiagnostics report={diagnosticReport} />
              {!caps && status !== "loading" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => void load()}
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  {t("重新加载引擎")}
                </Button>
              )}
            </div>
          )}
        </section>
        {(outputs.length > 0 || errors.length > 0) && (
          <section
            className="results panel"
            id="results"
            aria-labelledby="result-title"
          >
            <div className="result-heading">
              <div>
                <span className="eyebrow">WORDS, RECONNECTED.</span>
                <h2 id="result-title">
                  {status === "success"
                    ? t("转换完成，好词就位。")
                    : t("转换结果")}
                </h2>
              </div>
              {outputs.length > 1 && (
                <Button
                  className="zip-button"
                  onPress={() => void downloadZip()}
                  isDisabled={packing}
                >
                  <FolderArchive aria-hidden="true" size={18} />
                  {packing ? t("正在打包…") : t("打包下载 ZIP")}
                </Button>
              )}
            </div>
            {errors.length > 0 && !error && (
              <CopyDiagnostics report={diagnosticReport} />
            )}
            {errors.map((message, i) => (
              <p key={i} className="result-warning" role="alert">
                {t(message)}
              </p>
            ))}
            {outputs.map((output, i) => (
              <article className="output-file" key={`${output.name}-${i}`}>
                <div className="output-summary">
                  <FileText aria-hidden="true" size={25} />
                  <div>
                    <h3>{output.name}</h3>
                    <p>
                      {t("导入 {0} 条 · 导出 {1} 条 · {2} · {3} 秒", [
                        output.imported.toLocaleString(),
                        output.exported.toLocaleString(),
                        fileSize(output.data.length),
                        (output.elapsedMs / 1000).toFixed(2),
                      ])}
                    </p>
                  </div>
                  <Button
                    className="download-button"
                    onPress={() => save(output.data, output.name)}
                  >
                    <ArrowDownToLine aria-hidden="true" size={17} />
                    {t("下载")}
                    <span className="sr-only"> {output.name}</span>
                  </Button>
                </div>
                {output.warnings.map((w, n) => (
                  <p className="result-warning" key={n}>
                    {t(w)}
                  </p>
                ))}
                {output.exportErrors > 0 && (
                  <p className="result-warning">
                    {t("导出时有 {0} 条错误，请检查结果。", [
                      output.exportErrors,
                    ])}
                  </p>
                )}
                {output.exported === 0 && (
                  <p className="result-warning">
                    {t(
                      "没有导出词条，请检查输入格式、过滤条件以及是否需要生成编码。",
                    )}
                  </p>
                )}
                {output.preview !== null ? (
                  <details className="preview">
                    <summary>
                      {t("预览前 2,000 字符")}
                      <ChevronDown aria-hidden="true" size={15} />
                    </summary>
                    <pre>{output.preview || t("（空文件）")}</pre>
                  </details>
                ) : (
                  <p className="binary-note">
                    {t("二进制词库不提供文本预览。")}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}
        <section className="benefits" aria-label={t("工具特点")}>
          <div>
            <span className="benefit-icon yellow-icon">
              <ShieldCheck aria-hidden="true" size={23} />
            </span>
            <div>
              <h3>{t("隐私，从本地开始")}</h3>
              <p>{t("词库文件无需离开你的设备")}</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon blue-icon">
              <Zap aria-hidden="true" size={23} />
            </span>
            <div>
              <h3>{t("小小浏览器，大大转换力")}</h3>
              <p>{t("由深蓝词库转换引擎驱动")}</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon pink-icon">
              <HardDrive aria-hidden="true" size={23} />
            </span>
            <div>
              <h3>{t("打开即用，不挑设备")}</h3>
              <p>{t("电脑、平板、手机都能轻松操作")}</p>
            </div>
          </div>
        </section>
        <FormatGuide />
        <section className="lower-grid">
          <section className="formats-section" id="formats">
            <div className="section-kicker">FORMAT FRIENDLY</div>
            <h2>
              {t("格式不同，")} <span>{t("也能聊得来。")}</span>
            </h2>
            <p className="section-description">
              {t("从熟悉的输入法出发，去你想去的地方。")}
            </p>
            <div className="format-chips">
              {[
                t("搜狗 SCEL"),
                t("Rime / 中州韵"),
                "Gboard",
                t("QQ 拼音"),
                t("百度拼音"),
                t("纯文本 TXT"),
              ].map((label, i) => (
                <span
                  className={
                    i === 0 ? "chip-yellow" : i === 1 ? "chip-blue" : ""
                  }
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
            <details className="format-catalog">
              <summary>
                {t("查看全部格式")}{" "}
                <span>
                  {caps
                    ? t("{0} 种导入 / {1} 种导出", [
                        caps.importers.length,
                        caps.exporters.length,
                      ])
                    : t("等待引擎就绪")}
                </span>
                <Plus aria-hidden="true" size={17} />
              </summary>
              <div className="catalog-body">
                <p>
                  {t(
                    "“样例验证”仅表示已有特定转换样例，不代表任意文件、方向及输入法安装均已验证。",
                  )}
                </p>
                <div className="catalog-tabs">
                  <Button
                    variant="ghost"
                    aria-pressed={catalogType === "importers"}
                    onPress={() => setCatalogType("importers")}
                  >
                    {t("导入格式")}
                  </Button>
                  <Button
                    variant="ghost"
                    aria-pressed={catalogType === "exporters"}
                    onPress={() => setCatalogType("exporters")}
                  >
                    {t("导出格式")}
                  </Button>
                </div>
                <TextField value={catalogQuery} onChange={setCatalogQuery}>
                  <Label>{t("搜索格式")}</Label>
                  <Input placeholder={t("输入名称或格式代码")} />
                </TextField>
                <ul>
                  {(caps?.[catalogType] || [])
                    .filter((f) =>
                      `${f.id} ${t(f.displayName)}`
                        .toLowerCase()
                        .includes(catalogQuery.toLowerCase()),
                    )
                    .map((f) => (
                      <li key={f.id}>
                        <span>
                          {t(f.displayName)}
                          <code>{f.id}</code>
                        </span>
                        <small>
                          {sampled.has(f.id) ? t("有样例验证") : t("待验证")}
                        </small>
                      </li>
                    ))}
                </ul>
              </div>
            </details>
          </section>
          <section className="help-section" id="help">
            <div className="section-kicker">A LITTLE HELP</div>
            <h2>{t("转换前，你可能想知道")}</h2>
            {[
              [
                t("怎么开始转换？"),
                t(
                  "选择一个或多个同格式文件，确认输入与输出格式，然后点击“开始转换”。纯 TXT 每行一个词时请选择“纯词表”，转为需要编码的格式时开启拼音生成。",
                ),
              ],
              [
                t("我的文件会被上传吗？"),
                t(
                  "不会。转换通过 WebAssembly 在你的浏览器本地进行。网络仅用于加载网站与引擎资源，词库内容不会发送到服务器。关闭页面后请自行保存已下载文件。",
                ),
              ],
              [
                t("为什么没有转换出词条？"),
                t(
                  "请确认输入格式与文件内容匹配。TXT 没有拼音，转 Rime 等格式时需要生成编码；过滤条件过严也可能导致空结果。部分格式仍待验证，请检查结果提示。",
                ),
              ],
              [
                t("有哪些已知兼容性限制？"),
                t(
                  "Big5 输入存在上游解码问题；Gboard ZIP 需要先解压，文本与二进制词库请选择对应格式；Rime 输出不含 YAML 元数据头。SCEL 等格式也可能不完整保留词频，请检查转换结果。",
                ),
              ],
              [
                t("手机可以转换大词库吗？"),
                t(
                  "小型词库可在手机浏览器处理。大型词库会占用较多内存，超过 10 MB 时建议拆分或改用电脑。单次总输入限制为 50 MB，不保证所有设备都能完成。",
                ),
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus aria-hidden="true" size={17} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        </section>
      </main>
      <footer>
        <div className="footer-brand">
          <ArrowLeftRight aria-hidden="true" size={19} />
          {t("词库转转")}
          <span>{t("让每一个好词，都有新去处。")}</span>
        </div>
        <div>
          <span>{t("基于深蓝词库转换 · GPL-3.0")}</span>
          <a
            href="https://github.com/studyzy/imewlconverter"
            target="_blank"
            rel="noreferrer"
          >
            {t("上游引擎")}
            <ArrowRight aria-hidden="true" size={13} />
          </a>
        </div>
      </footer>
      <div className="mobile-action">
        <span>
          {busy
            ? t(progress.stage)
            : files.length
              ? t("{0} 个文件 · {1}", [files.length, fileSize(bytes)])
              : t("词库始终留在本地")}
        </span>
        {busy ? (
          <Button className="cancel-button" onPress={cancel}>
            {t("取消转换")}
            <X aria-hidden="true" size={17} />
          </Button>
        ) : (
          runButton
        )}
      </div>
    </>
  );
}
