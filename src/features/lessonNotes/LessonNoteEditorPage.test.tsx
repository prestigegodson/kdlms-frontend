import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { LessonNoteEditorPage } from "@/features/lessonNotes/LessonNoteEditorPage";
import { LESSON_NOTE_FIELD_HELP } from "@/features/lessonNotes/lessonNoteFieldHelp";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

// jsdom doesn't implement the layout/geometry APIs ProseMirror's EditorView uses for mouse-driven
// caret placement and scroll-into-view - see RichTextField.test.tsx's identical note. Needed here
// once the format toggle renders a real `LessonNoteDocumentEditor` (Phase 16G).
beforeAll(() => {
  document.elementFromPoint = () => null;
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});

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

// Phase 16G: a note can be authored in either the structured form or a free-form document.
describe("LessonNoteEditorPage format toggle", () => {
  it("defaults a new note to the structured form", async () => {
    renderNewNote();

    expect(await screen.findByLabelText("Evaluation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Structured form" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Free-form document" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to the free-form document editor and back without losing either half", async () => {
    renderNewNote();
    await screen.findByLabelText("Topic");

    await userEvent.type(screen.getByLabelText("Evaluation"), "Solve three problems");
    await userEvent.click(screen.getByRole("button", { name: "Free-form document" }));

    expect(screen.queryByLabelText("Evaluation")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Lesson plan document")).toBeInTheDocument();
    // No Preview toggle in document mode - the canvas is already WYSIWYG.
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Structured form" }));

    expect(await screen.findByLabelText("Evaluation")).toHaveValue("Solve three problems");
  });

  it("offers to convert existing structured content once switched to document mode", async () => {
    renderNewNote();
    await screen.findByLabelText("Topic");

    await userEvent.type(screen.getByLabelText("Evaluation"), "Solve three problems");
    await userEvent.click(screen.getByRole("button", { name: "Free-form document" }));

    expect(await screen.findByText(/hasn't been copied into this document yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Convert now" }));

    await waitFor(() => {
      const editable = screen.getByLabelText("Lesson plan document");
      expect(editable).toHaveTextContent("Solve three problems");
    });
    expect(screen.queryByText(/hasn't been copied into this document yet/)).not.toBeInTheDocument();
  });
});
