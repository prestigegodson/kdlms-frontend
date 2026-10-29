import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as staffApi from "@/api/staffAttendance";
import * as webauthn from "@/utils/webauthn";
import { ClockInPage } from "./ClockInPage";

vi.mock("@/api/staffAttendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/staffAttendance")>("@/api/staffAttendance");
  return { ...actual, publicClockOptions: vi.fn(), publicClockIn: vi.fn() };
});

vi.mock("@/utils/webauthn", async () => {
  const actual = await vi.importActual<typeof import("@/utils/webauthn")>("@/utils/webauthn");
  return { ...actual, passkeysSupported: vi.fn(), getPasskeyAssertion: vi.fn() };
});

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: "/clock", element: <ClockInPage /> }], { initialEntries: [url] });
  render(<RouterProvider router={router} />);
}

describe("ClockInPage", () => {
  beforeEach(() => {
    vi.mocked(webauthn.passkeysSupported).mockReturnValue(true);
    vi.mocked(staffApi.publicClockOptions).mockResolvedValue({
      challenge: "challenge",
      rpId: "kdlms.com",
      timeoutMillis: 120000,
    });
  });

  it("asks for a gate scan when opened without a code", () => {
    renderAt("/clock");
    expect(screen.getByText("Scan the QR code on the gate screen to clock in.")).toBeInTheDocument();
    expect(staffApi.publicClockOptions).not.toHaveBeenCalled();
  });

  it("explains when the browser can't use passkeys", () => {
    vi.mocked(webauthn.passkeysSupported).mockReturnValue(false);
    renderAt("/clock?s=station-1&c=code");
    expect(screen.getByText(/can't use passkeys/)).toBeInTheDocument();
  });

  it("redeems the code straight away, then clocks in on tap and shows the result", async () => {
    vi.mocked(webauthn.getPasskeyAssertion).mockResolvedValue({ id: "cred" });
    vi.mocked(staffApi.publicClockIn).mockResolvedValue({
      staffName: "Ada Obi",
      direction: "IN",
      occurredAt: "2026-10-26T06:42:00Z",
      localTime: "07:42",
      timezone: "Africa/Lagos",
      late: true,
      duplicate: false,
    });
    renderAt("/clock?s=station-1&c=code-1");

    await userEvent.click(await screen.findByRole("button", { name: "Clock in / out" }));

    expect(staffApi.publicClockOptions).toHaveBeenCalledWith("station-1", "code-1");
    expect(staffApi.publicClockIn).toHaveBeenCalledWith("station-1", "challenge", { id: "cred" });
    expect(await screen.findByText("Clocked in at 07:42")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("tells the person to rescan when the code has expired", async () => {
    vi.mocked(staffApi.publicClockOptions).mockRejectedValue(new Error("This gate code has expired."));
    renderAt("/clock?s=station-1&c=old");

    expect(await screen.findByText("This gate code has expired.")).toBeInTheDocument();
    expect(screen.getByText("Scan the QR code on the gate screen again.")).toBeInTheDocument();
  });
});
