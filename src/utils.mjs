export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
// Ambiguous extensions are deliberately not inferred from exporter metadata.
export function detectFormat(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dict.yaml") || lower.endsWith(".dict.yml"))
    return "rime";
  return (
    {
      scel: "scel",
      qcel: "qcel",
      qpyd: "qpyd",
      uwl: "uwl",
      bcd: "bcd",
      bdict: "bdict",
      ld2: "ld2",
      mb: "jdmb",
    }[lower.split(".").pop()] || null
  );
}
// Check content rather than extensions: a real SCEL may have been renamed.
export function inputValidationMessage(format, bytes) {
  if (format !== "scel") return "";
  // The importer reads the pinyin table count at 0x1540, after the SCEL header.
  const header = [0x40, 0x15, 0x00, 0x00, 0x44, 0x43, 0x53, 0x01];
  if (
    bytes.length < 0x1544 ||
    !header.every((value, index) => bytes[index] === value)
  )
    return "文件不是有效的搜狗细胞词库（SCEL），或内容不完整。若是每行一个词的 TXT，请将输入格式改为“纯词表（word）”；其他词库请选择实际格式，或重新导出完整的 SCEL 文件。";
  return "";
}
export function conversionErrorMessage(message, names) {
  const detail = message.replace(
    /IO_EOF_ReadBeyondEOF|Unable to read beyond the end of the stream\.?/g,
    "读取到文件末尾，内容可能不完整或与所选输入格式不符。请检查输入格式，或重新导出词库。",
  );
  // The WASM host already identifies import failures by the offending file.
  return names.some((name) => detail.startsWith(`${name}：`))
    ? detail
    : `${names.join("、")}：${detail}`;
}
export function uniqueName(name, used) {
  const dot = name.indexOf(".");
  const base = dot < 0 ? name : name.slice(0, dot);
  const ext = dot < 0 ? "" : name.slice(dot);
  let candidate = name;
  let index = 2;
  while (used.has(candidate)) candidate = `${base}-${index++}${ext}`;
  used.add(candidate);
  return candidate;
}
export function validationMessage(settings, mapping) {
  const f = settings.filter;
  if (!f.noFilter) {
    if (
      ![
        f.wordLengthFrom,
        f.wordLengthTo,
        f.wordRankFrom,
        f.wordRankTo,
        f.wordRankPercentage,
      ].every(Number.isInteger)
    )
      return "过滤范围必须填写整数。";
    if (f.wordLengthFrom < 1 || f.wordLengthTo < f.wordLengthFrom)
      return "词长范围应从 1 开始，最大值不能小于最小值。";
    if (
      f.wordRankFrom < 0 ||
      f.wordRankTo < f.wordRankFrom ||
      f.wordRankTo > 2147483647
    )
      return "词频范围应为 0–2147483647，最大值不能小于最小值。";
    if (f.wordRankPercentage < 1 || f.wordRankPercentage > 100)
      return "保留词频比例应为 1–100。";
  }
  if (
    settings.rank !== "" &&
    (!/^\d+$/.test(settings.rank) || Number(settings.rank) > 2147483647)
  )
    return "固定词频应为 0–2147483647 的整数。";
  if (settings.code === "UserDefine" && !mapping)
    return "请先选择自定义编码映射文件。";
  if (settings.code === "UserDefine" && !settings.multiCode.trim())
    return "请填写自定义编码规则，否则无法生成编码。";
  if (settings.dictionaryId.length > 6) return "词库编号最多 6 个字符。";
  return "";
}
