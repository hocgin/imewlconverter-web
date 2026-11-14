import { useI18n } from "./i18n";
import {
  Checkbox,
  ComboBox,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { Check, ChevronDown } from "lucide-react";
import type { Format } from "./types";
import { formatEvidence, sampled } from "./format-info";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  hint?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const { t } = useI18n();
  return (
    <TextField className="field" value={value} onChange={onChange}>
      <Label>{t(label)}</Label>
      <Input type={type} {...props} />
      {hint && <span className="field-hint">{t(hint)}</span>}
    </TextField>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const { t } = useI18n();
  return (
    <Select
      className="field"
      value={value}
      onChange={(v) => onChange(String(v))}
      aria-label={t(label)}
    >
      <Label>{t(label)}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(([id, text]) => (
            <ListBox.Item key={id} id={id} textValue={t(text)}>
              {t(text)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
export function Tick({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Checkbox isSelected={checked} onChange={onChange}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator>
            <Check aria-hidden="true" size={15} />
          </Checkbox.Indicator>
        </Checkbox.Control>
        {t(label)}
      </Checkbox.Content>
    </Checkbox>
  );
}
export function FormatPicker({
  label,
  value,
  onChange,
  formats,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  formats: Format[];
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="format-field">
      <ComboBox
        className="format-picker"
        selectedKey={value || null}
        onSelectionChange={(key) => onChange(key ? String(key) : "")}
        isDisabled={disabled}
        defaultFilter={(text, query) =>
          text.toLowerCase().includes(query.toLowerCase())
        }
      >
        <Label>{t(label)}</Label>
        <ComboBox.InputGroup>
          <Input placeholder={t("搜索名称或格式代码")} />
          <ComboBox.Trigger>
            <ChevronDown aria-hidden="true" size={18} />
          </ComboBox.Trigger>
        </ComboBox.InputGroup>
        {/* WebKit must reveal the selected option against final, unscaled bounds.
            A scale-in animation can scroll the page and immediately dismiss the menu. */}
        <ComboBox.Popover shouldSkipAnimation>
          <ListBox
            autoFocus={false}
            renderEmptyState={() => (
              <p className="empty-search">{t("没有匹配的格式")}</p>
            )}
          >
            {formats.map((f) => (
              <ListBox.Item
                key={f.id}
                id={f.id}
                textValue={`${t(f.displayName)} · ${f.id}`}
              >
                <div className="format-option">
                  <span>{t(f.displayName)}</span>
                  <span className="format-option-meta">
                    <code>{f.id}</code>
                    <small>
                      {sampled.has(f.id) ? t("有样例") : t("待验证")}
                    </small>
                  </span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      {value && <p className="format-evidence">{t(formatEvidence(value))}</p>}
    </div>
  );
}
