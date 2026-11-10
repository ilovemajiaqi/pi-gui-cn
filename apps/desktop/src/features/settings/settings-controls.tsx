import { useTranslation } from "../../i18n";
import { Select } from "../../ui/select";

/** A checkbox drawn as a switch, so it keeps native checkbox keyboard and form behaviour. */
export function SettingsSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <input
      aria-label={label}
      checked={checked}
      className="settings-switch"
      disabled={disabled}
      role="switch"
      type="checkbox"
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

export interface SettingsSegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** Two or three mutually exclusive options, shown inline like Codex's "Bottom | Right". */
export function SettingsSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly SettingsSegmentedOption<T>[];
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div aria-label={label} className="settings-segmented" role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="settings-segmented__option"
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly SettingsSegmentedOption<T>[];
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
}) {
  const { t } = useTranslation();
  // Without a matching option the trigger would show the first choice as if it
  // were selected, so an unset value gets an explicit placeholder instead.
  const hasValue = options.some((option) => option.value === value);
  return (
    <Select
      label={label}
      options={options}
      value={hasValue ? value : undefined}
      onChange={onChange}
      placeholder={hasValue ? undefined : t("settings.controls.choose")}
    />
  );
}
