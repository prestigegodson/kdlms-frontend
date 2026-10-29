import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import * as staffApi from "@/api/staffAttendance";
import { RegisterTab } from "./RegisterTab";

vi.mock("@/api/staffAttendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/staffAttendance")>("@/api/staffAttendance");
  return { ...actual, getRegister: vi.fn() };
});

const day = {
  date: "2026-10-26",
  clockOut: null,
  late: false,
  lateMinutes: 0,
  earlyLeave: false,
  missingClockOut: false,
  workedMinutes: 0,
  punches: 0,
};

describe("RegisterTab", () => {
  it("shows each person's status in the branch timezone, with late flagged", async () => {
    vi.mocked(staffApi.getRegister).mockResolvedValue({
      date: "2026-10-26",
      timezone: "Africa/Lagos",
      summary: { total: 2, onSite: 1, present: 1, late: 1, absent: 0, notClockedIn: 1 },
      rows: [
        {
          staffMemberId: "s1",
          userId: null,
          kind: "NON_ACADEMIC",
          name: "Ada Obi",
          role: null,
          category: "CLEANER",
          branchId: "b1",
          day: { ...day, status: "CLOCKED_IN", clockIn: "2026-10-26T06:45:00Z", late: true, lateMinutes: 15, punches: 1 },
        },
        {
          staffMemberId: "s2",
          userId: "u2",
          kind: "ACADEMIC",
          name: "Grace Okafor",
          role: "TEACHER",
          category: null,
          branchId: "b1",
          day: { ...day, status: "NOT_CLOCKED_IN", clockIn: null },
        },
      ],
    });
    const router = createMemoryRouter([{ path: "/", element: <RegisterTab /> }]);
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Cleaner")).toBeInTheDocument();
    expect(screen.getByText("On site")).toBeInTheDocument();
    expect(screen.getByText("Late 15m")).toBeInTheDocument();
    expect(screen.getByText("07:45")).toBeInTheDocument();
    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.getByText("Not in yet")).toBeInTheDocument();
  });
});
