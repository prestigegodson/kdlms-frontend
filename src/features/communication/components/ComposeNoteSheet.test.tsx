import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as communicationApi from "@/api/communication";
import { ComposeNoteSheet, type RosterOption } from "@/features/communication/components/ComposeNoteSheet";

vi.mock("@/api/communication", async () => {
  const actual = await vi.importActual<typeof import("@/api/communication")>("@/api/communication");
  return { ...actual, startThreads: vi.fn() };
});

const ROSTER: RosterOption[] = [
  { studentId: "student-1", studentName: "Ada Obi", admissionNumber: "SCH/2026/0001" },
  { studentId: "student-2", studentName: "Bola Ade", admissionNumber: "SCH/2026/0002" },
];

describe("ComposeNoteSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects every roster student via 'Select all' and reports a per-student outcome after submitting", async () => {
    vi.mocked(communicationApi.startThreads).mockResolvedValue({
      broadcastId: "broadcast-1",
      outcomes: [
        { studentId: "student-1", threadId: "thread-1", success: true },
        { studentId: "student-2", threadId: "thread-2", success: true },
      ],
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <ComposeNoteSheet classId="class-1" roster={ROSTER} onClose={vi.fn()} onSaved={onSaved} />,
    );

    await user.click(screen.getByText(/Select all 2/));
    await user.type(screen.getByPlaceholderText("What would you like to share?"), "Great class today!");
    // Selecting more than one student surfaces the per-family privacy line.
    expect(
      screen.getByText("Each family sees only their own copy. Replies come back to you privately."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Log note" }));

    await waitFor(() => {
      expect(communicationApi.startThreads).toHaveBeenCalledWith(
        "class-1",
        expect.any(String),
        "GENERAL",
        "Great class today!",
        ["student-1", "student-2"],
      );
    });
    expect(onSaved).toHaveBeenCalled();
    expect(await screen.findAllByText("Logged")).toHaveLength(2);
  });

  it("disables submission until at least one student is selected and a message is entered", () => {
    render(<ComposeNoteSheet classId="class-1" roster={ROSTER} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Log note" })).toBeDisabled();
  });

  it("pre-selects a single student when opened from a roster row's quick action", () => {
    render(
      <ComposeNoteSheet
        classId="class-1"
        roster={ROSTER}
        initialStudentIds={["student-1"]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("Recipients (1 selected)")).toBeInTheDocument();
  });
});
