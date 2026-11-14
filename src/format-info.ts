// Evidence is tied to the pinned engine's checked-in reports and this site's tests.
// A sample result is deliberately not presented as full format compatibility.
export const sampled = new Set([
  "scel",
  "rime",
  "word",
  "gboard",
  "gboardbin",
  "qpyd",
]);

export function formatEvidence(id: string) {
  return sampled.has(id)
    ? "有样例验证 · 请检查实际结果"
    : "待验证 · 可尝试转换并检查结果";
}
