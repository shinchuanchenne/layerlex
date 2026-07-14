import { Navigate, Route, Routes } from "react-router-dom";

import { HealthPage } from "./pages/HealthPage";
import { HomePage } from "./pages/HomePage";
import { OuterCardsPage } from "./pages/OuterCardsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/health" element={<HealthPage />} />
      <Route path="/cards" element={<OuterCardsPage />} />
      <Route path="/cards/:outerCardId" element={<OuterCardsPage />} />
      <Route
        path="/cards/:outerCardId/inner/:innerCardId"
        element={<OuterCardsPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
