import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as reportSettingsApi from "@/api/reportSettings";
import type { LevelTemplateAssignmentView } from "@/api/reportSettings";
import { ApiError } from "@/api/client";
import { ReportSettingsPage } from "@/features/reporting/ReportSettingsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/reportSettings", async () => {
  const actual = await vi.importActual<typeof import("@/api/reportSettings")>("@/api/reportSettings");
  return {
    ...actual,
    getReportSettings: vi.fn(),
    saveReportSettings: vi.fn(),
    listLevelTemplates: vi.fn(),
    assignLevelTemplate: vi.fn(),
    clearLevelTemplate: vi.fn(),
    previewLevelSample: vi.fn(),
  };
});

const RESOLVED_LEVEL: LevelTemplateAssignmentView = {
  levelId: "level-1",
  levelName: "Primary",
  baseLevel: "PRIMARY",
  assessmentMode: "NUMERIC",
  assignedTemplateId: undefined,
  assignedTemplateName: undefined,
  resolvedTemplateId: "template-1",
  resolvedTemplateName: "Platform standard sheet",
  availableTemplates: [],
};

const UNRESOLVED_LEVEL: LevelTemplateAssignmentView = {
  levelId: "level-2",
  levelName: "Nursery",
  baseLevel: "NURSERY",
  assessmentMode: "QUALITATIVE",
  assignedTemplateId: undefined,
  assignedTemplateName: undefined,
  resolvedTemplateId: undefined,
  resolvedTemplateName: undefined,
  availableTemplates: [],
};

function renderAsSchoolAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <ReportSettingsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("ReportSettingsPage — preview sample", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reportSettingsApi.getReportSettings).mockResolvedValue({ schoolId: "school-1" });
    vi.mocked(reportSettingsApi.listLevelTemplates).mockResolvedValue([RESOLVED_LEVEL, UNRESOLVED_LEVEL]);
  });

  it("opens the preview modal, shows a spinner, then renders the returned HTML in the iframe", async () => {
    vi.mocked(reportSettingsApi.previewLevelSample).mockResolvedValue("<html><body>Sample report</body></html>");
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Primary");

    const buttons = screen.getAllByRole("button", { name: "Preview sample" });
    await user.click(buttons[0]);

    expect(await screen.findByRole("dialog", { name: /Sample report — Primary/ })).toBeInTheDocument();
    expect(reportSettingsApi.previewLevelSample).toHaveBeenCalledWith("level-1");

    const frame = await screen.findByTitle("Result report preview");
    expect(frame).toHaveAttribute("srcdoc", "<html><body>Sample report</body></html>");
  });

  it("shows an error alert when the preview request fails", async () => {
    vi.mocked(reportSettingsApi.previewLevelSample).mockRejectedValue(
      new ApiError(422, "No result template is available for this level yet."),
    );
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Primary");

    await user.click(screen.getAllByRole("button", { name: "Preview sample" })[0]);

    expect(await screen.findByText("No result template is available for this level yet.")).toBeInTheDocument();
  });

  it("disables the preview button for a level with nothing resolved yet", async () => {
    vi.mocked(reportSettingsApi.previewLevelSample).mockResolvedValue("<html></html>");

    renderAsSchoolAdmin();
    await screen.findByText("Nursery");

    const buttons = screen.getAllByRole("button", { name: "Preview sample" });
    const nurseryRow = screen.getByText("Nursery").closest("tr")!;
    const nurseryButton = within(nurseryRow).getByRole("button", { name: "Preview sample" });
    expect(nurseryButton).toBeDisabled();
    expect(buttons.length).toBe(2);
  });
});
