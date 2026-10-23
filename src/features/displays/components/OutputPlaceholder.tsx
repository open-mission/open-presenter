import type { DisplayOutput } from "@/core/types";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/core/lib/utils";

interface OutputPlaceholderProps {
  output?: Partial<DisplayOutput> | null;
  className?: string;
  showLabel?: boolean;
}

export function OutputPlaceholder({
  output,
  className,
  showLabel = true,
}: OutputPlaceholderProps) {
  const isEnabled = output?.placeholderEnabled ?? true;
  const type = output?.placeholderType ?? "logo";
  const url = output?.placeholderUrl;
  const fit = output?.placeholderFit ?? "contain";

  if (!isEnabled || type === "none") {
    return null;
  }

  // Custom uploaded or URL image
  if (type === "image" && url) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-none bg-black",
          className,
        )}
      >
        <img
          src={url}
          alt={output?.name ?? "Plano de Fundo"}
          className={cn(
            "w-full h-full",
            fit === "contain" && "object-contain",
            fit === "cover" && "object-cover",
            fit === "center" && "object-none object-center",
          )}
        />
      </div>
    );
  }

  // Official OpenPresenter full logo placeholder
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-zinc-900 via-zinc-950 to-black text-white select-none pointer-events-none p-4",
        className,
      )}
    >
      {/* Background ambient glow */}
      <div className="absolute size-44 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Brand logo */}
      <div className="relative flex items-center justify-center mb-2">
        <BrandMark className="size-16 sm:size-20 text-zinc-100 drop-shadow-[0_4px_24px_rgba(99,102,241,0.25)]" />
      </div>

      {showLabel && (
        <div className="flex flex-col items-center gap-0.5 text-center relative z-10">
          <span className="font-bold tracking-widest text-xs sm:text-sm uppercase text-zinc-200">
            Open Presenter
          </span>
          {output?.name && (
            <span className="text-[10px] tracking-wider text-zinc-400 font-mono">
              {output.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
