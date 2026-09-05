import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import type { RemarksSheetView } from "@/api/assessments";
import * as meApi from "@/api/me";
import type { TeacherClassView } from "@/api/me";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { RemarksPanel } from "@/features/assessments/components/RemarksPanel";

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, getRemarksSheet: vi.fn(), saveTeacherRemarks: vi.fn() };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

const CLASS: TeacherClassView = {
  classId: "class-1",
  branchId: "branch-1",
  levelId: "level-1",
  className: "JSS 1A",
  isClassTeacher: true,
  subjectIds: [],
};

const SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const TERM: TermView = {
  id: "term-1",
  schoolId: "school-1",
  sessionId: "session-1",
  termNumber: 1,
  name: "First Term",
  startDate: "2026-09-01",
  endDate: "2026-12-01",
  current: true,
};

const EDITABLE_SHEET: RemarksSheetView = {
  classId: "class-1",
  className: "JSS 1A",
  termId: "term-1",
  classTeacherEditable: true,
  principalRemarkEditable: false,
  traitCategories: [],
  rows: [
    {
      enrollmentId: "enrollment-1",
      studentName: "Zara Bello",
      admissionNumber: "SCH/2026/0001",
      traits: [],
    },
  ],
};

function renderPanel() {
  const router = createMemoryRouter([{ path: "/", element: <RemarksPanel /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("RemarksPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM]);
  });

  it("shows an empty state when the teacher has no classes assigned", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText("No classes assigned yet")).toBeInTheDocument();
  });

  it("loads the sheet once a class and term are picked, and round-trips a remark to the save payload", async () => {
    const user = userEvent.setup();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([CLASS]);
    vi.mocked(assessmentsApi.getRemarksSheet).mockResolvedValue(EDITABLE_SHEET);
    vi.mocked(assessmentsApi.saveTeacherRemarks).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true }],
    });
    renderPanel();

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    expect(await screen.findByLabelText("Class teacher's remark for Zara Bello")).toBeInTheDocument();
    expect(assessmentsApi.getRemarksSheet).toHaveBeenCalledWith("class-1", "term-1");

    await user.type(screen.getByLabelText("Class teacher's remark for Zara Bello"), "A hardworking student.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveTeacherRemarks).toHaveBeenCalledWith("class-1", "term-1", [
      { enrollmentId: "enrollment-1", remark: "A hardworking student." },
    ]);
  });

  it("shows a trait tab per enabled category and includes a rating in the save payload", async () => {
    const user = userEvent.setup();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([CLASS]);
    vi.mocked(assessmentsApi.getRemarksSheet).mockResolvedValue({
      ...EDITABLE_SHEET,
      traitCategories: [
        {
          category: "AFFECTIVE",
          displayName: "Affective disposition",
          traits: [{ id: "trait-1", name: "Punctuality" }],
          scaleOptions: [
            { id: "option-1", value: "1", label: "VERY POOR" },
            { id: "option-2", value: "5", label: "EXCELLENT" },
          ],
        },
        {
          category: "PSYCHOMOTOR",
          displayName: "Psychomotor skills",
          traits: [{ id: "trait-2", name: "Handwriting" }],
          scaleOptions: [
            { id: "option-3", value: "1", label: "VERY POOR" },
            { id: "option-4", value: "5", label: "EXCELLENT" },
          ],
        },
      ],
      rows: [{ ...EDITABLE_SHEET.rows[0], traits: [{ traitId: "trait-1" }, { traitId: "trait-2" }] }],
    });
    vi.mocked(assessmentsApi.saveTeacherRemarks).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true }],
    });
    renderPanel();

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    // Remarks tab shows no trait select of either category.
    expect(await screen.findByLabelText("Class teacher's remark for Zara Bello")).toBeInTheDocument();
    expect(screen.queryByLabelText("Punctuality for Zara Bello")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Affective disposition" }));
    expect(screen.getByLabelText("Punctuality for Zara Bello")).toBeInTheDocument();
    expect(screen.queryByLabelText("Handwriting for Zara Bello")).not.toBeInTheDocument();
    expect(screen.getByText("VERY POOR")).toBeInTheDocument();

    const traitSelect = screen.getByLabelText("Punctuality for Zara Bello");
    await user.selectOptions(traitSelect, "option-2");

    await user.click(screen.getByRole("tab", { name: "Psychomotor skills" }));
    expect(screen.getByLabelText("Handwriting for Zara Bello")).toBeInTheDocument();
    expect(screen.queryByLabelText("Punctuality for Zara Bello")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveTeacherRemarks).toHaveBeenCalledWith("class-1", "term-1", [
      { enrollmentId: "enrollment-1", remark: null, traits: [{ traitId: "trait-1", scaleOptionId: "option-2" }] },
    ]);
  });

  it("keeps a remark and a trait rating edit together across tab switches, in one save", async () => {
    const user = userEvent.setup();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([CLASS]);
    vi.mocked(assessmentsApi.getRemarksSheet).mockResolvedValue({
      ...EDITABLE_SHEET,
      traitCategories: [
        {
          category: "AFFECTIVE",
          displayName: "Affective disposition",
          traits: [{ id: "trait-1", name: "Punctuality" }],
          scaleOptions: [
            { id: "option-1", value: "1", label: "VERY POOR" },
            { id: "option-2", value: "5", label: "EXCELLENT" },
          ],
        },
      ],
      rows: [{ ...EDITABLE_SHEET.rows[0], traits: [{ traitId: "trait-1" }] }],
    });
    vi.mocked(assessmentsApi.saveTeacherRemarks).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true }],
    });
    renderPanel();

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    await user.type(screen.getByLabelText("Class teacher's remark for Zara Bello"), "A hardworking student.");

    await user.click(screen.getByRole("tab", { name: "Affective disposition" }));
    await user.selectOptions(screen.getByLabelText("Punctuality for Zara Bello"), "option-2");

    await user.click(screen.getByRole("tab", { name: "Remarks" }));
    expect(screen.getByLabelText("Class teacher's remark for Zara Bello")).toHaveValue("A hardworking student.");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveTeacherRemarks).toHaveBeenCalledWith("class-1", "term-1", [
      {
        enrollmentId: "enrollment-1",
        remark: "A hardworking student.",
        traits: [{ traitId: "trait-1", scaleOptionId: "option-2" }],
      },
    ]);
  });

  it("renders remarks read-only, with a warning, when the caller isn't this class's class teacher", async () => {
    const user = userEvent.setup();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([CLASS]);
    vi.mocked(assessmentsApi.getRemarksSheet).mockResolvedValue({
      ...EDITABLE_SHEET,
      classTeacherEditable: false,
      rows: [{ ...EDITABLE_SHEET.rows[0], classTeacherRemark: "Already on file." }],
    });
    renderPanel();

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    expect(await screen.findByText("Already on file.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Class teacher's remark for Zara Bello")).not.toBeInTheDocument();
    expect(screen.getByText(/Only this class's class teacher can write remarks/)).toBeInTheDocument();
  });
});
