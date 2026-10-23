import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Monitor } from "lucide-react";
import { identifyDisplays } from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";

export default function IdentifyOverlayView() {
  const location = useLocation();

  // Parse query params from hash location (e.g. #/identify?index=1&name=Monitor&w=1920&h=1080)
  const search = location.search || (window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "");
  const params = new URLSearchParams(search);
  const index = params.get("index") || "1";
  const name = (params.get("name") || "Monitor").replace(/\+/g, " ");
  const width = params.get("w") || window.innerWidth.toString();
  const height = params.get("h") || window.innerHeight.toString();

  function dismiss() {
    if (isTauri()) {
      void identifyDisplays(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dismiss();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      onClick={dismiss}
      className="h-screen w-screen bg-black/50 backdrop-blur-xs flex items-center justify-center p-8 select-none cursor-pointer"
    >
      <div className="flex flex-col items-center justify-center rounded-3xl border-4 border-indigo-500/80 bg-zinc-950/95 px-16 py-12 shadow-[0_0_80px_rgba(99,102,241,0.5)] text-center text-white animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 text-indigo-400 mb-2">
          <Monitor className="size-8" />
          <span className="text-xl font-bold uppercase tracking-wider">Identificação de Tela</span>
        </div>

        {/* Big Monitor Number */}
        <div className="text-[140px] font-black leading-none tracking-tighter text-white drop-shadow-md my-2">
          {index}
        </div>

        {/* Monitor Name */}
        <div className="text-2xl font-semibold text-zinc-200 mt-1 max-w-lg truncate">
          {name}
        </div>

        {/* Resolution */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 border border-zinc-700/80 px-4 py-1.5 text-sm font-mono text-zinc-300">
          <span>{width} x {height} px</span>
        </div>

        <div className="text-xs text-zinc-500 mt-6">
          Clique ou pressione Esc para fechar
        </div>
      </div>
    </div>
  );
}
