import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPublicTheme, themeCoverageLabel } from "@/features/slide-themes/pages";
import { useSlideThemesStore } from "@/features/slide-themes/store";

const SETTINGS_VALUE = "__settings__";

export function EventThemeSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (guid: string | null) => void;
  disabled?: boolean;
}) {
  const themes = useSlideThemesStore((s) => s.themes);
  const options = themes.filter(
    (theme) => isPublicTheme(theme) && Boolean(theme.pages?.length),
  );

  return (
    <Select
      value={value ?? SETTINGS_VALUE}
      onValueChange={(next) => onChange(next === SETTINGS_VALUE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Usar configurações" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={SETTINGS_VALUE}>Usar configurações</SelectItem>
        {options.map((theme) => (
          <SelectItem key={theme.guid} value={theme.guid}>
            {theme.title} · {themeCoverageLabel(theme)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
