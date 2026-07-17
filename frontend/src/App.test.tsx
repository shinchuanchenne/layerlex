import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

function renderApp(route = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LayerLex application", () => {
  it("shows the project foundation page", () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: "LayerLex" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Check application health" }),
    ).toHaveAttribute("href", "/health");
    expect(
      screen.getByRole("link", { name: "Manage decks and cards" }),
    ).toHaveAttribute("href", "/decks");
  });

  it("shows a successful API health result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "layerlex-api" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderApp("/health");

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/health", {
      headers: {},
    });
  });
});
