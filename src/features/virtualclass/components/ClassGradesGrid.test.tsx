import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classTopicsApi from "@/api/classTopics";
import type { ClassGradebook } from "@/api/classTopics";
import { ClassGradesGrid } from "./ClassGradesGrid";

vi.mock("@/api/classTopics", async () => {
  const actual = await vi.importActual<typeof import("@/api/classTopics")>("@/api/classTopics");
  return { ...actual, saveClassGrades: vi.fn(), publishTopicGrades: vi.fn(), unpublishTopicGrades: vi.fn() };
});

function gradebook(overrides: Partial<ClassGradebook> = {}): ClassGradebook {
  return {
    topics: [
      { id: "t1", classId: "c1", title: "Nouns", description: null, position: 0 },
      {
        id: "t2",
        classId: "c1",
        title: "Verbs",
        description: null,
        position: 1,
        gradesPublishedAt: "2026-10-20T08:00:00Z",
      },
    ],
    learners: [
      { learnerId: "l1", firstName: "Ada", lastName: "Lovelace" },
      { learnerId: "l2", firstName: "Ben", lastName: "Okri" },
    ],
    grades: [
      { topicId: "t1", learnerId: "l1", grade: "A", comment: "Great examples.", gradedAt: "2026-10-20T08:00:00Z" },
    ],
    ...overrides,
  };
}

function renderGrid(props: { gradebook?: ClassGradebook; writable?: boolean; onChange?: () => void } = {}) {
  const onChange = props.onChange ?? vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <ClassGradesGrid
            classId="c1"
            gradebook={props.gradebook ?? gradebook()}
            writable={props.writable ?? true}
            onChange={onChange}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return { onChange };
}

describe("ClassGradesGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lays every topic against every learner with their saved grades", () => {
    renderGrid();

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Topic",
      "1.Ada Lovelace",
      "2.Ben Okri",
    ]);
    const nounsRow = screen.getByRole("row", { name: /Nouns/ });
    expect(within(nounsRow).getByRole("button", { name: "Publish grades for Nouns" })).toBeInTheDocument();
    expect(within(nounsRow).getByLabelText("Grade for Ben Okri on Nouns")).toBeInTheDocument();
    expect(screen.getByText("Verbs")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade for Ada Lovelace on Nouns")).toHaveValue("A");
    expect(screen.getByLabelText("Grade for Ben Okri on Verbs")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Comment for Ada Lovelace on Nouns" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a comment for Ben Okri on Nouns" })).toBeInTheDocument();
  });

  it("saves only the changed cells, grades and comments together, in one request", async () => {
    const updated = gradebook();
    vi.mocked(classTopicsApi.saveClassGrades).mockResolvedValue(updated);
    const { onChange } = renderGrid();

    await userEvent.type(screen.getByLabelText("Grade for Ben Okri on Verbs"), "7/10");
    await userEvent.click(screen.getByRole("button", { name: "Add a comment for Ben Okri on Verbs" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Comment for Ben Okri on Verbs"), "Good effort");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await userEvent.clear(screen.getByLabelText("Grade for Ada Lovelace on Nouns"));
    await userEvent.type(screen.getByLabelText("Grade for Ada Lovelace on Nouns"), "A+");

    expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(classTopicsApi.saveClassGrades).toHaveBeenCalledTimes(1);
    const [classId, entries] = vi.mocked(classTopicsApi.saveClassGrades).mock.calls[0];
    expect(classId).toBe("c1");
    expect(entries).toEqual(
      expect.arrayContaining([
        { learnerId: "l1", topicId: "t1", grade: "A+", comment: "Great examples." },
        { learnerId: "l2", topicId: "t2", grade: "7/10", comment: "Good effort" },
      ]),
    );
    expect(entries).toHaveLength(2);
    expect(onChange).toHaveBeenCalledWith(updated);
  });

  it("blocks saving a comment without a grade", async () => {
    renderGrid();

    await userEvent.click(screen.getByRole("button", { name: "Add a comment for Ben Okri on Nouns" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Comment for Ben Okri on Nouns"), "Needs practice");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(screen.getByText("Enter a grade for every cell you've written a comment for.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(classTopicsApi.saveClassGrades).not.toHaveBeenCalled();
  });

  it("discards every unsaved cell", async () => {
    renderGrid();

    await userEvent.type(screen.getByLabelText("Grade for Ben Okri on Nouns"), "B");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByLabelText("Grade for Ben Okri on Nouns")).toHaveValue("");
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it("publishes a topic's grades, but only once nothing is unsaved", async () => {
    const published = { ...gradebook().topics[0], gradesPublishedAt: "2026-10-29T08:00:00Z" };
    vi.mocked(classTopicsApi.publishTopicGrades).mockResolvedValue(published);
    const { onChange } = renderGrid();

    const publish = screen.getByRole("button", { name: "Publish grades for Nouns" });
    await userEvent.type(screen.getByLabelText("Grade for Ben Okri on Nouns"), "B");
    expect(publish).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(publish).toBeEnabled();

    await userEvent.click(publish);
    expect(classTopicsApi.publishTopicGrades).toHaveBeenCalledWith("c1", "t1");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ topics: [published, gradebook().topics[1]] }));
    expect(screen.getByRole("button", { name: "Unpublish grades for Verbs" })).toBeInTheDocument();
  });

  it("shows a topic as a draft again once unpublished", async () => {
    // The API omits null fields, so an unpublished topic comes back without gradesPublishedAt.
    const unpublished = { id: "t2", classId: "c1", title: "Verbs", description: null, position: 1 };
    vi.mocked(classTopicsApi.unpublishTopicGrades).mockResolvedValue(unpublished);
    const { onChange } = renderGrid();

    await userEvent.click(screen.getByRole("button", { name: "Unpublish grades for Verbs" }));

    expect(classTopicsApi.unpublishTopicGrades).toHaveBeenCalledWith("c1", "t2");
    const refreshed = vi.mocked(onChange).mock.calls[0][0] as ClassGradebook;
    renderGrid({ gradebook: refreshed });
    const verbsRow = screen.getAllByRole("row", { name: /Verbs/ }).at(-1)!;
    expect(within(verbsRow).getByText("Draft")).toBeInTheDocument();
    expect(within(verbsRow).getByRole("button", { name: "Publish grades for Verbs" })).toBeInTheDocument();
  });

  it("is read-only for an archived or over-limit class", () => {
    renderGrid({ writable: false });

    expect(screen.getByLabelText("Grade for Ada Lovelace on Nouns")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Publish grades/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a comment for Ben Okri on Nouns" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Comment for Ada Lovelace on Nouns" })).toBeEnabled();
  });

  it("points to the topics page when the class has no topics", () => {
    renderGrid({ gradebook: gradebook({ topics: [], grades: [] }) });

    expect(screen.getByText(/Add topics to start grading/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to topics" })).toHaveAttribute("href", "/tutor/classes/c1/topics");
  });
});
