import { useEffect, useState } from "react";
import { cssColorToHex, normalizeHex } from "@/core/theme/color";

interface ColorFieldProps {
  label: string;
  value: string;
  backdrop: string;
  onChange(value: string): void;
}

export function ColorField({ label, value, backdrop, onChange }: ColorFieldProps) {
  const displayValue = normalizeHex(value) ?? cssColorToHex(value, backdrop) ?? value;
  const [draft, setDraft] = useState(displayValue);
  const pickerValue = normalizeHex(value) ?? cssColorToHex(value, backdrop) ?? "#000000";

  useEffect(() => {
    setDraft(displayValue);
  }, [displayValue]);

  function commit() {
    const next = normalizeHex(draft) ?? cssColorToHex(draft, backdrop);
    if (next) {
      onChange(next);
      setDraft(next);
    } else {
      setDraft(displayValue);
    }
  }

  return (
    <label className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/45 p-2.5 transition-colors hover:border-border hover:bg-card/70">
      <span
        className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-black/10 shadow-inner dark:border-white/15"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={pickerValue}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label={`Escolher cor: ${label}`}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {label}
        </span>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setDraft(displayValue);
              event.currentTarget.blur();
            }
          }}
          spellCheck={false}
          className="mt-0.5 w-full min-w-0 bg-transparent font-mono text-[11px] text-muted-foreground outline-none transition-colors focus:text-foreground"
          aria-label={`Valor da cor: ${label}`}
        />
      </span>
    </label>
  );
}
