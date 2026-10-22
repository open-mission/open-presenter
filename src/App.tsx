import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminView from "./views/AdminView";
import PreferencesView from "./views/PreferencesView";
import PublicView from "./views/PublicView";
import ShortcutsView from "./views/ShortcutsView";
import StageView from "./views/StageView";
import StreamView from "./views/StreamView";
import ThemeEditorView from "./views/ThemeEditorView";
import SongEditorView from "./views/SongEditorView";
import RemoteView from "./features/remote/RemoteView";
import { Toaster } from "@/components/ui/sonner";
import { useMediaPortSync } from "@/core/config/mediaPort";
import { initSongGroupsSync } from "@/features/songs/songGroupsStore";
import { useDesktopShortcuts } from "@/core/hooks/useDesktopShortcuts";
import { showMainWindow } from "@/core/ipc/commands";
import { isMainWindow } from "@/core/ipc/tauri";

export default function App() {
  useMediaPortSync();
  useDesktopShortcuts();

  useEffect(() => {
    initSongGroupsSync();

    if (isMainWindow()) {
      // Revela a janela principal apenas quando estiver nela, eliminando o flash branco
      // e sem roubar o foco de subjanelas (preferências, atalhos, editores).
      showMainWindow().catch((err) => {
        console.error("Falha ao revelar janela principal:", err);
      });
    }
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AdminView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/preferences" element={<PreferencesView />} />
        <Route path="/shortcuts" element={<ShortcutsView />} />
        <Route path="/public" element={<PublicView />} />
        <Route path="/stage" element={<StageView />} />
        <Route path="/stream" element={<StreamView />} />
        <Route path="/theme-editor" element={<ThemeEditorView />} />
        <Route path="/song-editor" element={<SongEditorView />} />
        <Route path="/remote" element={<RemoteView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </HashRouter>
  );
}
