import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as insightsApi from "@/api/insights";
import type { StudentInsightTrendView } from "@/api/insights";
import { StudentInsightPage } from "@/features/insights/StudentInsightPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/insights", async () => {
  const actual = await vi.importActual<typeof import("@/api/insights")>("@/api/insights");
  return { ...actual, getStudentInsightTrend: vi.fn() };
});

const trend: StudentInsightTrendView = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "KDL-001",
  computedAt: "2026-10-30T02:00:00Z",
  terms: [
    { termId: "t1", termName: "First Term", termNumber: 1, sessionName: "2025/2026", className: "Primary 2", severity: "NONE", average: 70, position: 3, classSize: 20, attendanceRate: 95, reasons: [] },
    // No published results yet: average and position are unknown, attendance isn't.
    { termId: "t2", termName: "Second Term", termNumber: 2, sessionName: "2025/2026", className: "Primary 2", severity: "WATCH", attendanceRate: 85, reasons: [] },
    {
      termId: "t3",
      termName: "First Term",
      termNumber: 1,
      sessionName: "2026/2027",
      className: "Primary 3",
      severity: "AT_RISK",
      average: 57.5,
      position: 12,
      classSize: 22,
      attendanceRate: 72,
      reasons: [
        { signal: "AVERAGE_DROP", message: "Term average fell 12.5 points, from 70.0 to 57.5", detail: {} },
        { signal: "LOW_ATTENDANCE", message: "Attendance is 72.0% this term, below 80.0%", detail: {} },
      ],
      computedAt: "2026-10-30T02:00:00Z",
    },
  ],
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "u-1", email: "t@school.example", firstName: "A", lastName: "B", role: "TEACHER", schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/school/insights/students/:studentId", element: <StudentInsightPage /> }], {
    initialEntries: ["/school/insights/students/s1"],
  });
  render(<RouterProvider router={router} />);
}

describe("StudentInsightPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureStore();
    useFeatureStore.setState({ studentInsights: true, status: "loaded" });
    vi.mocked(insightsApi.getStudentInsightTrend).mockResolvedValue(trend);
  });

  it("shows the latest term's severity, its reasons, and when it was computed", async () => {
    renderPage();

    expect(await screen.findByText("Term average fell 12.5 points, from 70.0 to 57.5")).toBeInTheDocument();
    expect(insightsApi.getStudentInsightTrend).toHaveBeenCalledWith("s1");
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("Attendance is 72.0% this term, below 80.0%")).toBeInTheDocument();
    expect(screen.getAllByText(/Updated/).length).toBeGreaterThan(0);
  });

  it("draws one panel per measure, each describing every term", async () => {
    renderPage();
    await screen.findByText("Term by term");

    const position = screen.getByRole("img", { name: /^Class position by term/ });
    expect(position.getAttribute("aria-label")).toContain("3rd of 20");
    expect(position.getAttribute("aria-label")).toContain("12th of 22");
    expect(screen.getByRole("img", { name: /^Term average by term/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Attendance by term/ })).toBeInTheDocument();
  });

  it("breaks the average line at a term with no published results instead of joining across it", async () => {
    renderPage();
    await screen.findByText("Term by term");

    const average = screen.getByRole("img", { name: /^Term average by term/ });
    const path = average.querySelector("path")?.getAttribute("d") ?? "";
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).not.toContain("L");
    const attendance = screen.getByRole("img", { name: /^Attendance by term/ });
    expect(attendance.querySelector("path")?.getAttribute("d")?.match(/M/g)).toHaveLength(1);
  });

  it("offers the same numbers as a table, one row per term", async () => {
    renderPage();
    await screen.findByText("Term by term");

    await userEvent.click(screen.getByRole("button", { name: "Show as table" }));

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("3rd of 20")).toBeInTheDocument();
    expect(within(rows[1]).getAllByText("—")).toHaveLength(2);
    expect(within(rows[1]).getByText("85%")).toBeInTheDocument();
    expect(within(rows[2]).getByText("57.5")).toBeInTheDocument();
  });

  it("shows a term's details in a tooltip on hover", async () => {
    renderPage();
    await screen.findByText("Term by term");

    await userEvent.hover(screen.getByRole("button", { name: "First Term · 2026/2027: 12th of 22" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("12th of 22")).toBeInTheDocument();
    expect(within(tooltip).getByText("At risk")).toBeInTheDocument();
  });
});
