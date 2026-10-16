import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";

vi.mock("@/api/sessions", () => ({
  listSessions: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }),
  listTerms: vi.fn().mockResolvedValue([]),
}));

function renderPicker(classes: { id: string; name: string; group?: string }[]) {
  render(<ClassTermPicker classes={classes} classId="" onClassChange={vi.fn()} termId="" onTermChange={vi.fn()} />);
  return screen.getByLabelText("Class");
}

describe("ClassTermPicker", () => {
  it("groups classes under their level, in the order the levels arrive", () => {
    const select = renderPicker([
      { id: "1a", name: "JSS 1A", group: "JSS 1" },
      { id: "1b", name: "JSS 1B", group: "JSS 1" },
      { id: "2a", name: "JSS 2A", group: "JSS 2" },
    ]);

    const groups = within(select).getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("label"))).toEqual(["JSS 1", "JSS 2"]);
    expect(within(groups[0]).getAllByRole("option").map((option) => option.textContent)).toEqual(["JSS 1A", "JSS 1B"]);
  });

  it("keeps a flat list when no class names a level", () => {
    const select = renderPicker([
      { id: "1a", name: "JSS 1A" },
      { id: "1b", name: "JSS 1B" },
    ]);

    expect(within(select).queryAllByRole("group")).toHaveLength(0);
    expect(within(select).getAllByRole("option")).toHaveLength(3);
  });
});
