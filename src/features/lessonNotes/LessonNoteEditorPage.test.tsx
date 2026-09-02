import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { LessonNoteEditorPage } from "@/features/lessonNotes/LessonNoteEditorPage";
import { LESSON_NOTE_FIELD_HELP } from "@/features/lessonNotes/lessonNoteFieldHelp";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

function renderNewNote() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "teacher@school.example",
      firstName: "A",
      lastName: "B",
      role: "TEACHER",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [{ path: "/school/lesson-notes/:noteId", element: <LessonNoteEditorPage /> }],
    { initialEntries: ["/school/lesson-notes/new?subjectId=s1&termId=t1&weekNumber=3"] },
  );
  render(<RouterProvider router={router} />);
}

// isNew short-circuits the getLessonNote fetch, so the editable branch renders with no API mocking needed.
describe("LessonNoteEditorPage field descriptions", () => {
  it("shows a description above a StringListField-backed field", async () => {
    renderNewNote();

    expect(await screen.findByText(LESSON_NOTE_FIELD_HELP.objectives)).toBeInTheDocument();
  });

  it("shows a description above a plain FormField and wires aria-describedby", async () => {
    renderNewNote();

    expect(await screen.findByText(LESSON_NOTE_FIELD_HELP.evaluation)).toBeInTheDocument();
    const evaluation = screen.getByLabelText("Evaluation");
    expect(evaluation).toHaveAttribute("aria-describedby", "lesson-note-evaluation-description");
  });

  it("hides descriptions in preview mode", async () => {
    renderNewNote();
    await screen.findByText(LESSON_NOTE_FIELD_HELP.evaluation);

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.queryByText(LESSON_NOTE_FIELD_HELP.evaluation)).not.toBeInTheDocument();
  });
});
