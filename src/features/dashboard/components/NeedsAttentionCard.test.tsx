import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { NeedsAttentionCard } from "@/features/dashboard/components/NeedsAttentionCard";

function renderCard(props: Parameters<typeof NeedsAttentionCard>[0]) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <NeedsAttentionCard {...props} /> },
      { path: "/school/academics/classes/:classId", element: <div>Class detail page</div> },
      { path: "/school/guardians", element: <div>Guardians page</div> },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("NeedsAttentionCard", () => {
  it("renders nothing when both gaps are clear", () => {
    const { container } = renderCard({
      setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
    });

    expect(container).toBeEmptyDOMElement();
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
});
