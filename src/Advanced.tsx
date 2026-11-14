import { useI18n } from "./i18n";
import { Button } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { Choice, Field, Tick } from "./components";
import { defaults } from "./config";
import type { Capabilities, Filter, Settings } from "./types";

const filterLabels: [keyof Filter, string][] = [
  ["ignoreEnglish", "移除含英文词条"],
  ["ignoreNumber", "移除含数字词条"],
  ["ignoreSpace", "移除含空格词条"],
  ["ignorePunctuation", "移除含标点词条"],
  ["ignoreNoAlphabetCode", "移除无字母编码词条"],
  ["ignoreFirstCJK", "移除非汉字开头词条"],
  ["replaceEnglish", "去除词内英文"],
  ["replaceNumber", "去除词内数字"],
  ["replaceSpace", "去除词内空格"],
  ["replacePunctuation", "去除词内标点"],
];
export default function Advanced({
  settings: s,
  setSettings,
  caps,
  mapping,
  setMapping,
  from,
  to,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  caps: Capabilities | null;
  mapping: File | null;
  setMapping: (f: File | null) => void;
  from: string;
  to: string;
}) {
  const { t } = useI18n();
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...s, [key]: value });
  const filter = <K extends keyof Filter>(key: K, value: Filter[K]) =>
    set("filter", { ...s.filter, [key]: value });
  const changes = [
    s.code !== "NoCode",
    s.chinese !== "None",
    !s.filter.noFilter,
    s.sort !== "Default" || s.descending,
    s.rank !== "",
    !!s.encoding || !!s.exportEncoding,
    !!s.dictionaryName ||
      !!s.dictionaryId ||
      !!s.dictionaryCategory ||
      !!s.dictionaryDescription,
  ].filter(Boolean).length;
  return (
    <details className="advanced" id="advanced">
      <summary>
        <span>
          {t("高级设置")}{" "}
          <span className="advanced-caption">
            {changes ? t("{0} 组已调整", [changes]) : t("编码、过滤与更多选项")}
          </span>
        </span>
        <span className="plus">＋</span>
      </summary>
      <div className="advanced-body">
        <div className="advanced-heading">
          <p>{t("只调整你需要的选项，其余保留原词库设置。")}</p>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setSettings(structuredClone(defaults));
              setMapping(null);
            }}
          >
            <RotateCcw aria-hidden="true" size={14} />
            {t("重置")}
          </Button>
        </div>
        <section>
          <h3>{t("编码与文字")}</h3>
          <div className="form-grid">
            <Choice
              label={t("生成编码")}
              value={s.code}
              onChange={(v) => set("code", v)}
              options={[
                ["NoCode", t("保留原编码")],
                ...(caps?.generators || []).map(
                  (g) => [g.id, g.name] as [string, string],
                ),
              ]}
            />
            <Choice
              label={t("简繁转换")}
              value={s.chinese}
              onChange={(v) => set("chinese", v)}
              options={[
                ["None", t("保持不变")],
                ["SimplifiedToTraditional", t("简体 → 繁体")],
                ["TraditionalToSimplified", t("繁体 → 简体")],
              ]}
            />
            <Choice
              label={t("源词库编码类型")}
              value={s.sourceCode}
              onChange={(v) => set("sourceCode", v)}
              options={[
                ["Pinyin", t("拼音")],
                ["NoCode", t("无编码")],
                ...(caps?.generators || [])
                  .filter((g) => g.id !== "Pinyin")
                  .map((g) => [g.id, g.name] as [string, string]),
              ]}
            />
            <Field
              label={t("固定词频（留空保留原值）")}
              type="number"
              min={0}
              max={2147483647}
              value={s.rank}
              onChange={(v) => set("rank", v)}
              placeholder={t("原词频")}
            />
          </div>
          {s.code !== "NoCode" && s.code !== "UserDefine" && (
            <div className="check-grid">
              {(
                [
                  ["keepEnglish", t("编码保留英文")],
                  ["keepNumber", t("编码保留数字")],
                  ["keepPunctuation", t("编码保留标点")],
                  ["fullWidth", t("全角转半角")],
                  ["chineseNumbers", t("数字转中文")],
                  ["underscore", t("英文前加下划线")],
                ] as [keyof Settings, string][]
              ).map(([key, label]) => (
                <Tick
                  key={key}
                  label={label}
                  checked={Boolean(s[key])}
                  onChange={(v) => setSettings({ ...s, [key]: v })}
                />
              ))}
            </div>
          )}
          {s.code === "UserDefine" && (
            <div className="mapping-field">
              <label htmlFor="mapping">
                {t("自定义映射表（UTF-8，每行：汉字 ⇥ 编码）")}
              </label>
              <input
                id="mapping"
                type="file"
                accept=".txt,.tsv"
                onChange={(e) => setMapping(e.target.files?.[0] || null)}
              />
              {mapping && <p>{mapping.name}</p>}
              <Field
                label={t("多字词编码规则")}
                value={s.multiCode}
                onChange={(v) => set("multiCode", v)}
                placeholder="code_e2=p11+p12+p21+p22"
                hint={t(
                  "规则以逗号分隔；单字也需设置规则，例如 code_e1=p11+p12+p13+p14。没有匹配规则的词条不会生成编码。",
                )}
              />
            </div>
          )}
        </section>
        <section>
          <div className="section-title">
            <h3>{t("词条过滤")}</h3>
            <Tick
              label={t("启用过滤")}
              checked={!s.filter.noFilter}
              onChange={(v) => filter("noFilter", !v)}
            />
          </div>
          {!s.filter.noFilter && (
            <>
              <div className="form-grid">
                {(
                  [
                    ["wordLengthFrom", t("最小词长")],
                    ["wordLengthTo", t("最大词长")],
                    ["wordRankFrom", t("最低词频")],
                    ["wordRankTo", t("最高词频")],
                    ["wordRankPercentage", t("保留高词频比例（%）")],
                  ] as [keyof Filter, string][]
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    type="number"
                    value={
                      Number.isNaN(s.filter[key]) ? "" : String(s.filter[key])
                    }
                    onChange={(v) => filter(key, v === "" ? NaN : Number(v))}
                  />
                ))}
              </div>
              <div className="check-grid">
                {filterLabels.map(([key, label]) => (
                  <Tick
                    key={key}
                    label={label}
                    checked={Boolean(s.filter[key])}
                    onChange={(v) => filter(key, v)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
        <section>
          <h3>{t("导出设置")}</h3>
          <div className="form-grid">
            <Choice
              label={t("排序方式")}
              value={s.sort}
              onChange={(v) => set("sort", v)}
              options={[
                ["Default", t("保留原顺序")],
                ["ByWord", t("按词语")],
                ["ByCode", t("按编码")],
                ["ByRank", t("按词频")],
              ]}
            />
            <Choice
              label={t("排序方向")}
              value={s.descending ? "desc" : "asc"}
              onChange={(v) => set("descending", v === "desc")}
              options={[
                ["asc", t("升序")],
                ["desc", t("降序")],
              ]}
            />
            <Choice
              label={t("输入文本编码")}
              value={s.encoding || "auto"}
              onChange={(v) => set("encoding", v === "auto" ? "" : v)}
              options={[
                ["auto", t("格式默认")],
                ["UTF-8", "UTF-8"],
                ["GB18030", "GB18030"],
                ["GBK", "GBK"],
                ["Big5", t("Big5（已知解码限制）")],
                ["UTF-16", "UTF-16"],
              ]}
            />
            <Choice
              label={t("输出文本编码")}
              value={s.exportEncoding || "auto"}
              onChange={(v) => set("exportEncoding", v === "auto" ? "" : v)}
              options={[
                ["auto", t("格式默认")],
                ["UTF-8", "UTF-8"],
                ["GB18030", "GB18030"],
                ["GBK", "GBK"],
                ["Big5", "Big5"],
                ["UTF-16", "UTF-16"],
              ]}
            />
          </div>
          <p className="field-hint">
            {t(
              "部分格式采用固定编码及排序，可能忽略相关设置；Rime 固定按词频降序。Big5 输入存在已知解码错误。",
            )}
          </p>
          {(from === "self" || to === "self") && (
            <Field
              label={t("自定义文本格式规则")}
              value={s.customFormat}
              onChange={(v) => set("customFormat", v)}
              hint={t(
                "沿用引擎规则，例如 213 ,nyyy：词语、拼音（空格分隔）、词频。",
              )}
            />
          )}
          {to === "scel" && (
            <div className="form-grid metadata-fields">
              <Field
                label={t("词库编号（最多 6 字符）")}
                maxLength={6}
                value={s.dictionaryId}
                onChange={(v) => set("dictionaryId", v)}
              />
              <Field
                label={t("词库名称")}
                value={s.dictionaryName}
                onChange={(v) => set("dictionaryName", v)}
              />
              <Field
                label={t("词库类别")}
                value={s.dictionaryCategory}
                onChange={(v) => set("dictionaryCategory", v)}
              />
              <Field
                label={t("词库描述")}
                value={s.dictionaryDescription}
                onChange={(v) => set("dictionaryDescription", v)}
              />
            </div>
          )}
        </section>
      </div>
    </details>
  );
}
