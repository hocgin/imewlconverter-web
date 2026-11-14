import { useI18n } from "./i18n";

const formats = [
  [
    "搜狗 SCEL",
    ".scel",
    "scel",
    "scel",
    "搜狗细胞词库。可用于转换到 Rime 或纯文本；原始词频可能无法完整保留。",
  ],
  [
    "Rime / 中州韵",
    ".dict.yaml",
    "rime",
    "rime",
    "导出为词条 TSV，不含 YAML 元数据头。导入 Rime 前需要补充元信息；词条固定按词频降序排列。",
  ],
  [
    "Gboard 文本",
    "TXT",
    "gboard",
    "gboard",
    "先解压 Gboard 备份，再选择其中的文本词库。ZIP 文件不能直接导入。",
  ],
  [
    "Gboard 二进制",
    "user_dict_3_3",
    "gboardbin",
    "gboardbin",
    "Gboard 二进制词库与文本词库采用不同格式，请按文件内容选择。",
  ],
  [
    "QQ 拼音",
    ".qpyd",
    "qpyd",
    "—",
    "支持 QPYD 导入。导出 QQ 词库时，请从完整目录选择对应的可用导出格式。",
  ],
  [
    "纯词表 TXT",
    ".txt",
    "word",
    "word",
    "每行一个词。转为需要编码的格式时，请在高级设置中启用拼音或其他编码生成器。",
  ],
];
export default function FormatGuide() {
  const { t } = useI18n();
  return (
    <section
      className="format-guide"
      id="format-guide"
      aria-labelledby="guide-title"
    >
      <div className="section-kicker">{t("格式与功能指南")}</div>
      <h2 id="guide-title">{t("词库格式怎么选？")}</h2>
      <p>
        {t(
          "引擎提供 54 种导入格式与 46 种导出格式。以下常见格式已有特定样例验证，实际兼容性仍取决于文件内容和转换方向。",
        )}
      </p>
      <div
        className="format-table-wrap"
        tabIndex={0}
        role="region"
        aria-label={t("格式与功能指南")}
      >
        <table>
          <caption className="sr-only">
            {t("常见词库格式、导入导出代码与使用注意事项")}
          </caption>
          <thead>
            <tr>
              {["词库格式", "文件类型", "导入代码", "导出代码", "使用说明"].map(
                (label) => (
                  <th key={label} scope="col">
                    {t(label)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {formats.map(([name, extension, input, output, note]) => (
              <tr key={input}>
                <th scope="row">{t(name)}</th>
                <td>
                  <code>{extension}</code>
                </td>
                <td>
                  <code>{input}</code>
                </td>
                <td>
                  <code>{output}</code>
                </td>
                <td>{t(note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="feature-guide">
        <article>
          <h3>{t("批量转换与合并")}</h3>
          <p>
            {t(
              "一次选择最多 100 个同格式文件，总计不超过 50 MB。可合并输出，或逐个转换后下载 ZIP。超过 10 MB 建议拆分或使用电脑。",
            )}
          </p>
        </article>
        <article>
          <h3>{t("按需整理词库")}</h3>
          <p>
            {t(
              "生成拼音、五笔等编码，进行简繁转换，按词长和词频过滤，移除字符，或调整排序与词频。默认保留原词库设置，不自动去重。",
            )}
          </p>
        </article>
        <article>
          <h3>{t("从浏览器到输入法")}</h3>
          <p>
            {t(
              "转换完成后检查预览和提示，再导入目标输入法。你也可以在 iPhone 上使用支持搜狗和文本词库导入的 DDUP 键盘。",
            )}
          </p>
          <a href="#ios-app">{t("了解 DDUP iOS 键盘")} →</a>
        </article>
      </div>
      <a className="guide-convert-link" href="#converter">
        {t("开始本地词库转换")} →
      </a>
    </section>
  );
}
