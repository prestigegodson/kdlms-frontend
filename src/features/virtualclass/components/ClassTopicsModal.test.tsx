import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MyClassTopics } from "@/api/classTopics";
import { ClassTopicsModal } from "./ClassTopicsModal";

describe("ClassTopicsModal", () => {
  it("shows a published grade and comment, and marks the rest as not graded", async () => {
    const topics: MyClassTopics = {
      classId: "c1",
      className: "Science",
      topics: [
        {
          id: "t1",
          title: "Plants",
          description: null,
          published: true,
          grade: "B+",
          comment: "Labelled every part.",
          gradedAt: "2026-10-29T10:00:00Z",
        },
        { id: "t2", title: "Light", description: null, published: false, grade: null, comment: null, gradedAt: null },
      ],
    };

    render(<ClassTopicsModal title="Topics & grades" load={() => Promise.resolve(topics)} onClose={() => {}} />);

    expect(await screen.findByText("B+")).toBeInTheDocument();
    expect(screen.getByText("Labelled every part.")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Not graded yet")).toBeInTheDocument();
  });
});
