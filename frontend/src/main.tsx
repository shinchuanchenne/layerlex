import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { AppQueryClientProvider } from "./providers/AppQueryClientProvider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppQueryClientProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppQueryClientProvider>
  </StrictMode>,
);
