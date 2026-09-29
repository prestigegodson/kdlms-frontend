import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "@/layouts/UpdateBanner";

describe("UpdateBanner", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders nothing when the server version matches the running build", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ version: __APP_VERSION__ }) });

    render(<UpdateBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("A new version is available")).not.toBeInTheDocument();
  });

  it("shows a reload prompt once the server reports a different version", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ version: "a-different-build" }) });

    render(<UpdateBanner />);

    await waitFor(() => expect(screen.getByText("A new version is available")).toBeInTheDocument());
  });

  it("stays silent when the version probe fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    render(<UpdateBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("A new version is available")).not.toBeInTheDocument();
  });
});
