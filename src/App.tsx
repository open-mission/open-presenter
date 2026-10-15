import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminView from "./views/AdminView";
import PublicView from "./views/PublicView";
import StageView from "./views/StageView";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AdminView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/public" element={<PublicView />} />
        <Route path="/stage" element={<StageView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
