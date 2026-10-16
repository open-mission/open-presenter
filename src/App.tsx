import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminView from "./views/AdminView";
import PreferencesView from "./views/PreferencesView";
import PublicView from "./views/PublicView";
import StageView from "./views/StageView";
import ThemeEditorView from "./views/ThemeEditorView";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AdminView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/preferences" element={<PreferencesView />} />
        <Route path="/public" element={<PublicView />} />
        <Route path="/stage" element={<StageView />} />
        <Route path="/theme-editor" element={<ThemeEditorView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
