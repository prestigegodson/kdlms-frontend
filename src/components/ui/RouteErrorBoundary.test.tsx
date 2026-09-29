import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import * as reloadOnceModule from "@/utils/reloadOnce";

function renderThrowing(error: unknown) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: <div>ok</div>,
      errorElement: <RouteErrorBoundary />,
      loader: () => {
        throw error;
      },
    },
  ]);
  render(<RouterProvider router={router} />);
}

describe("RouteErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // reloadOnce actually calling window.location.reload would break jsdom's
    // navigation in-test - spied on rather than mocking the whole module, so
    // isChunkLoadError's real regex still runs.
    vi.spyOn(reloadOnceModule, "reloadOnce").mockReturnValue(true);
  });

  it("shows the generic crash message for an ordinary render error", async () => {
    renderThrowing(new Error("boom"));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(reloadOnceModule.reloadOnce).not.toHaveBeenCalled();
  });

  it("shows the stale-build message and reloads automatically for a chunk-load error", async () => {
    renderThrowing(new Error("Failed to fetch dynamically imported module"));

    expect(await screen.findByText("A new version is available")).toBeInTheDocument();
    // reloadOnce runs in a passive effect, which can flush after the message is already on screen.
    await waitFor(() => expect(reloadOnceModule.reloadOnce).toHaveBeenCalledTimes(1));
  });

  it("shows the 404 page for an actual unmatched route", () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <div>ok</div>, errorElement: <RouteErrorBoundary /> }],
      { initialEntries: ["/nowhere"] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });
});
