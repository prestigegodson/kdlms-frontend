import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClassroomArmsField } from "@/features/academics/components/ClassroomArmsField";

const ARMS = [
  { classId: "a", className: "JSS 1A" },
  { classId: "b", className: "JSS 1B" },
  { classId: "c", className: "JSS 1C" },
  { classId: "d", className: "JSS 1D" },
];

function renderField(selected: string[], onChange = vi.fn(), isLocked?: (id: string) => boolean) {
  render(
    <ClassroomArmsField
      idPrefix="test-class"
      classes={ARMS}
      homeClassId="a"
      selected={new Set(selected)}
      onChange={onChange}
      isLocked={isLocked}
      hint="hint"
    />,
  );
  return onChange;
}

describe("ClassroomArmsField", () => {
  it("starts collapsed, summarising the classrooms reached", () => {
    renderField(["c"]);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("JSS 1A")).toBeInTheDocument();
    expect(screen.getByText("JSS 1C")).toBeInTheDocument();
    expect(screen.queryByText("JSS 1B")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change classrooms" })).toHaveAttribute("aria-expanded", "false");
  });

  it("offers the other classrooms with a count when only the home classroom is reached", async () => {
    const onChange = renderField([]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Share with other classrooms (3)" }));
    expect(screen.getByLabelText(/^JSS 1A/)).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(onChange).toHaveBeenCalledWith(new Set(["b", "c", "d"]));
  });

  it("keeps a locked classroom when clearing all", async () => {
    const onChange = renderField(["b", "c", "d"], vi.fn(), (id) => id === "b");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Change classrooms" }));
    expect(screen.getByLabelText("JSS 1B")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenCalledWith(new Set(["b"]));
  });
});
