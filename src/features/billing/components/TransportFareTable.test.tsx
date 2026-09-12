import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { TransportFareGridView } from "@/api/billing";
import { ApiError } from "@/api/client";
import { TransportFareTable } from "@/features/billing/components/TransportFareTable";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, saveTransportFares: vi.fn() };
});

const GRID: TransportFareGridView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  sessionId: "session-1",
  sessionName: "2026/2027",
  routes: [
    { routeId: "route-1", routeName: "Ikeja", active: true, oneWayAmount: 30000, toAndFroAmount: 50000 },
    { routeId: "route-2", routeName: "Yaba", active: true, oneWayAmount: null, toAndFroAmount: null },
  ],
};

function renderTable() {
  const onSaved = vi.fn();
  render(<TransportFareTable grid={GRID} branchId="branch-1" onSaved={onSaved} />);
  return { onSaved };
}

describe("TransportFareTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds each route's amounts from the grid, leaving an unpriced route blank", async () => {
    renderTable();

    expect(await screen.findByLabelText("Ikeja one-way fare")).toHaveValue(30000);
    expect(await screen.findByLabelText("Ikeja to-and-fro fare")).toHaveValue(50000);
    expect(await screen.findByLabelText("Yaba one-way fare")).toHaveValue(null);
  });

  it("shows no unsaved-changes bar until a value actually changes", () => {
    renderTable();

    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it("editing one route's fare saves only that dirty row", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveTransportFares).mockResolvedValue({
      outcomes: [{ routeId: "route-2", success: true, message: null }],
    });
    const { onSaved } = renderTable();

    await user.type(await screen.findByLabelText("Yaba one-way fare"), "25000");
    expect(await screen.findByText("1 unsaved change")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(billingApi.saveTransportFares).toHaveBeenCalledWith(
        "session-1",
        [{ routeId: "route-2", oneWayAmount: 25000, toAndFroAmount: null }],
        "branch-1",
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("1 fare saved."));
  });

  it("discarding reverts every edited field", async () => {
    const user = userEvent.setup();
    renderTable();

    const input = await screen.findByLabelText("Ikeja one-way fare");
    await user.clear(input);
    await user.type(input, "99999");
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(await screen.findByLabelText("Ikeja one-way fare")).toHaveValue(30000);
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it("a negative amount is rejected inline without calling the API", async () => {
    const user = userEvent.setup();
    renderTable();

    const input = await screen.findByLabelText("Yaba one-way fare");
    await user.type(input, "-5");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Enter a number 0 or greater, or leave blank.")).toBeInTheDocument();
    expect(billingApi.saveTransportFares).not.toHaveBeenCalled();
  });

  it("a rejected save surfaces the error inline", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveTransportFares).mockRejectedValue(new ApiError(500, "Failed to save fares"));
    renderTable();

    await user.type(await screen.findByLabelText("Yaba one-way fare"), "25000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Failed to save fares")).toBeInTheDocument();
  });
});
