import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { NeedsAttentionCard } from "@/features/dashboard/components/NeedsAttentionCard";

function renderCard(props: Parameters<typeof NeedsAttentionCard>[0]) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <NeedsAttentionCard {...props} /> },
      { path: "/school/academics/classes/:classId", element: <div>Class detail page</div> },
      { path: "/school/students", element: <div>Students page</div> },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("NeedsAttentionCard", () => {
  it("shows a positive all-clear state when both gaps are clear", () => {
    renderCard({
      setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
    });

    expect(screen.getByText("All clear")).toBeInTheDocument();
    expect(
      screen.getByText("Every class has a class teacher and every student has a linked guardian."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/class teacher$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/linked guardian$/)).not.toBeInTheDocument();
  });

  it("names each class with no class teacher, pluralizing the summary line", () => {
    renderCard({
      setupGaps: {
        classesWithoutClassTeacher: [
          { classId: "c1", className: "Primary 1", levelName: "Primary" },
          { classId: "c2", className: "Primary 2", levelName: "Primary" },
        ],
        studentsWithoutGuardian: 0,
      },
    });

    expect(screen.getByText("2 classes with no class teacher")).toBeInTheDocument();
    expect(screen.getByText("Primary 1", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Primary 2", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/linked guardian/)).not.toBeInTheDocument();
  });

  it("shows the singular form for exactly one gap of each kind", () => {
    renderCard({
      setupGaps: {
        classesWithoutClassTeacher: [{ classId: "c1", className: "Primary 1", levelName: "Primary" }],
        studentsWithoutGuardian: 1,
      },
    });

    expect(screen.getByText("1 class with no class teacher")).toBeInTheDocument();
    expect(screen.getByText("1 student with no linked guardian")).toBeInTheDocument();
  });

  it("deep-links the guardian gap to the student registry filtered to students with no guardian", () => {
    renderCard({
      setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 4 },
    });

    expect(screen.getByText("4 students with no linked guardian").closest("a")).toHaveAttribute(
      "href",
      "/school/students?hasGuardian=false",
    );
  });
});
