import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as reportsApi from "@/api/reports";
import type { ResultScope } from "@/api/types";
import { ReportPreviewNavigator } from "@/features/reporting/components/ReportPreviewNavigator";
import type { ReportStudentRow } from "@/features/reporting/components/StudentReportList";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/reports", async () => {
  const actual = await vi.importActual<typeof import("@/api/reports")>("@/api/reports");
  return { ...actual, previewStudentReport: vi.fn(), downloadStudentReportPdf: vi.fn() };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const students: ReportStudentRow[] = [
  { studentId: "s1", studentName: "Ada Obi", admissionNumber: "KDL001" },
  { studentId: "s2", studentName: "Bola Ade", admissionNumber: "KDL002" },
  { studentId: "s3", studentName: "Chidi Eze", admissionNumber: "KDL003" },
];

function Harness({ initial = "s1", scope = "TERM" }: { initial?: string; scope?: ResultScope }) {
  const [studentId, setStudentId] = useState(initial);
  return (
    <ReportPreviewNavigator
      students={students}
      termId="term-1"
      scope={scope}
      studentId={studentId}
      onStudentChange={setStudentId}
      onClose={() => {}}
    />
  );
}

function previewHtml() {
  return screen.getByTitle("Result report preview").getAttribute("srcdoc");
}

describe("ReportPreviewNavigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reportsApi.previewStudentReport).mockImplementation(async (id) => `<p>report ${id}</p>`);
  });

  it("disables Previous on the first student and Next on the last", async () => {
    const { unmount } = render(<Harness initial="s1" />);
    await screen.findByTitle("Result report preview");
    expect(screen.getByRole("button", { name: "Previous student" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next student" })).toBeEnabled();
    unmount();

    render(<Harness initial="s3" />);
    await screen.findByTitle("Result report preview");
    expect(screen.getByRole("button", { name: "Next student" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous student" })).toBeEnabled();
  });

  it("steps to the next student and shows their report and position", async () => {
    render(<Harness />);
    await waitFor(() => expect(previewHtml()).toBe("<p>report s1</p>"));
    expect(screen.getByText("Report — Ada Obi (1 of 3)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next student" }));

    await waitFor(() => expect(previewHtml()).toBe("<p>report s2</p>"));
    expect(screen.getByText("Report — Bola Ade (2 of 3)")).toBeInTheDocument();
  });

  it("prefetches the neighbours once the current report lands, fetching each only once", async () => {
    render(<Harness initial="s2" />);
    await waitFor(() => expect(reportsApi.previewStudentReport).toHaveBeenCalledTimes(3));
    expect(reportsApi.previewStudentReport).toHaveBeenNthCalledWith(1, "s2", "term-1", "TERM");
    expect(reportsApi.previewStudentReport).toHaveBeenCalledWith("s1", "term-1", "TERM");
    expect(reportsApi.previewStudentReport).toHaveBeenCalledWith("s3", "term-1", "TERM");

    await userEvent.click(screen.getByRole("button", { name: "Next student" }));
    await waitFor(() => expect(previewHtml()).toBe("<p>report s3</p>"));
    expect(reportsApi.previewStudentReport).toHaveBeenCalledTimes(3);
  });

  it("navigates with the arrow keys", async () => {
    render(<Harness />);
    await waitFor(() => expect(previewHtml()).toBe("<p>report s1</p>"));

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(previewHtml()).toBe("<p>report s2</p>"));

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(previewHtml()).toBe("<p>report s1</p>"));
  });

  it("jumps straight to the student picked in the dropdown", async () => {
    render(<Harness />);
    await waitFor(() => expect(previewHtml()).toBe("<p>report s1</p>"));

    await userEvent.selectOptions(screen.getByLabelText("Jump to student"), "s3");

    await waitFor(() => expect(previewHtml()).toBe("<p>report s3</p>"));
    expect(screen.getByText("Report — Chidi Eze (3 of 3)")).toBeInTheDocument();
  });

  it("keeps the toolbar usable when a report fails to render", async () => {
    vi.mocked(reportsApi.previewStudentReport).mockImplementation(async (id) => {
      if (id === "s1") throw new Error("boom");
      return `<p>report ${id}</p>`;
    });
    render(<Harness />);
    expect(await screen.findByText("Failed to render this report")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next student" }));
    await waitFor(() => expect(previewHtml()).toBe("<p>report s2</p>"));
  });

  it("downloads the current student's PDF with the scope's filename", async () => {
    const blob = new Blob(["pdf"]);
    vi.mocked(reportsApi.downloadStudentReportPdf).mockResolvedValue(blob);
    render(<Harness initial="s2" scope="MIDTERM" />);
    await screen.findByTitle("Result report preview");

    await userEvent.click(screen.getByRole("button", { name: /Download PDF/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "KDL002-result-midterm.pdf"));
    expect(reportsApi.downloadStudentReportPdf).toHaveBeenCalledWith("s2", "term-1", "MIDTERM");
  });
});
