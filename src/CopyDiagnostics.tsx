import { useI18n } from "./i18n";
import { Button } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export default function CopyDiagnostics({ report }: { report: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">(
    "idle",
  );
  useEffect(() => setState("idle"), [report]);
  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    setState("copying");
    try {
      await navigator.clipboard.writeText(report);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="diagnostics-copy">
      <Button
        variant="secondary"
        size="sm"
        isDisabled={!report || state === "copying"}
        onPress={() => void copy()}
        aria-label={t("复制错误诊断信息")}
      >
        {state === "copied" ? (
          <Check aria-hidden="true" size={15} />
        ) : (
          <Copy aria-hidden="true" size={15} />
        )}
        {state === "copied" ? t("已复制") : t("复制报错信息")}
      </Button>
      <span className="sr-only" role="status">
        {state === "copied" ? t("错误诊断信息已复制") : ""}
      </span>
      {state === "failed" && (
        <label className="diagnostics-fallback">
          {t("自动复制失败，请选中下方诊断信息手动复制。")}
          <textarea
            readOnly
            value={report}
            onFocus={(event) => event.currentTarget.select()}
            rows={6}
          />
        </label>
      )}
    </div>
  );
}
