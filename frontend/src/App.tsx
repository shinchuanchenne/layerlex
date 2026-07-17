import { Navigate, Route, Routes } from "react-router-dom";

import { HealthPage } from "./pages/HealthPage";
import { HomePage } from "./pages/HomePage";
import { InnerReviewPage } from "./pages/InnerReviewPage";
import { OuterCardsPage } from "./pages/OuterCardsPage";
import { OuterReviewPage } from "./pages/OuterReviewPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/health" element={<HealthPage />} />
      <Route path="/decks" element={<OuterCardsPage />} />
      <Route path="/decks/:deckId" element={<OuterCardsPage />} />
      <Route
        path="/decks/:deckId/cards/:outerCardId"
        element={<OuterCardsPage />}
      />
      <Route
        path="/decks/:deckId/cards/:outerCardId/inner/:innerCardId"
        element={<OuterCardsPage />}
      />
      <Route path="/cards/*" element={<Navigate to="/decks" replace />} />
      <Route path="/review/outer" element={<OuterReviewPage />} />
      <Route path="/review/outer/:outerCardId" element={<OuterReviewPage />} />
      <Route path="/review/inner" element={<InnerReviewPage />} />
      <Route path="/review/inner/:innerCardId" element={<InnerReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
