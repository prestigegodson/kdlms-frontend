import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classTopicsApi from "@/api/classTopics";
import type { ClassTopic } from "@/api/classTopics";
import { ClassTopicsCard } from "./ClassTopicsCard";

vi.mock("@/api/classTopics", async () => {
  const actual = await vi.importActual<typeof import("@/api/classTopics")>("@/api/classTopics");
  return {
    ...actual,
    listClassTopics: vi.fn(),
    createClassTopic: vi.fn(),
    reorderClassTopics: vi.fn(),
  };
});

function topic(overrides: Partial<ClassTopic>): ClassTopic {
  return {
    id: "t1",
    classId: "c1",
    title: "Fractions",
    description: null,
    position: 0,
    gradesPublishedAt: null,
    ...overrides,
  };
}

function renderCard(writable = true) {
  const router = createMemoryRouter(
    [{ path: "/", element: <ClassTopicsCard classId="c1" writable={writable} /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ClassTopicsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists topics in order with their publish state and a link to grade each", async () => {
    vi.mocked(classTopicsApi.listClassTopics).mockResolvedValue([
      topic({}),
      topic({ id: "t2", title: "Decimals", position: 1, gradesPublishedAt: "2026-10-29T10:00:00Z" }),
    ]);

    renderCard();

    expect(await screen.findByText("Fractions")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Grades published")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grade learners on Decimals" })).toHaveAttribute(
      "href",
      "/tutor/classes/c1/topics/t2",
    );
    expect(screen.getByRole("button", { name: "Move Fractions up" })).toBeDisabled();
  });

  it("moves a topic down by sending the new order", async () => {
    const fractions = topic({});
    const decimals = topic({ id: "t2", title: "Decimals", position: 1 });
    vi.mocked(classTopicsApi.listClassTopics).mockResolvedValue([fractions, decimals]);
    vi.mocked(classTopicsApi.reorderClassTopics).mockResolvedValue([decimals, fractions]);

    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: "Move Fractions down" }));

    expect(classTopicsApi.reorderClassTopics).toHaveBeenCalledWith("c1", ["t2", "t1"]);
  });

  it("adds a topic", async () => {
    vi.mocked(classTopicsApi.listClassTopics).mockResolvedValue([]);
    vi.mocked(classTopicsApi.createClassTopic).mockResolvedValue(topic({}));

    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: /Add topic/ }));
    await userEvent.type(screen.getByLabelText("Title"), "Fractions");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add topic" }));

    expect(classTopicsApi.createClassTopic).toHaveBeenCalledWith("c1", { title: "Fractions", description: null });
  });

  it("hides editing controls on a read-only class", async () => {
    vi.mocked(classTopicsApi.listClassTopics).mockResolvedValue([topic({})]);

    renderCard(false);

    expect(await screen.findByText("Fractions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add topic/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Fractions" })).not.toBeInTheDocument();
  });
});
