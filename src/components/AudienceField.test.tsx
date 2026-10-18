import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { AudienceField, type AudienceStudent } from "@/components/AudienceField";

const STUDENTS: AudienceStudent[] = [
  { studentId: "s1", fullName: "Ada Okoye", admissionNumber: "KDL001", classId: "c1", className: "JSS 1A", portalLogin: true },
  { studentId: "s2", fullName: "Bola Ade", admissionNumber: "KDL002", classId: "c1", className: "JSS 1A", portalLogin: false },
  { studentId: "s3", fullName: "Chidi Eze", admissionNumber: "KDL003", classId: "c2", className: "JSS 1B", portalLogin: true },
];

function field(props: Partial<ComponentProps<typeof AudienceField>>) {
  return (
    <AudienceField
      name="test-audience"
      audience="ALL"
      selected={new Set()}
      onChange={vi.fn()}
      students={STUDENTS}
      noLoginTag="link"
      footnote="Only the pupils you tick see this."
      {...props}
    />
  );
}

describe("AudienceField", () => {
  it("hides the pupil list while the item goes to everyone", () => {
    render(field({}));
    expect(screen.getByLabelText("All pupils in these classrooms")).toBeChecked();
    expect(screen.queryByLabelText(/Ada Okoye/)).not.toBeInTheDocument();
  });

  it("switches to Selected pupils and ticks one", async () => {
    const onChange = vi.fn();
    const { rerender } = render(field({ onChange }));
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Selected pupils"));
    expect(onChange).toHaveBeenLastCalledWith("SELECTED", new Set());

    rerender(field({ onChange, audience: "SELECTED" }));
    expect(screen.getByText("JSS 1A")).toBeInTheDocument();
    expect(screen.getByText("JSS 1B")).toBeInTheDocument();
    expect(screen.getByText("Only the pupils you tick see this.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Bola Ade/).closest("label")).toHaveTextContent("· link");
    await user.click(screen.getByLabelText(/Chidi Eze/));
    expect(onChange).toHaveBeenLastCalledWith("SELECTED", new Set(["s3"]));
  });

  it("selects a whole classroom, filtered by the search", async () => {
    const onChange = vi.fn();
    render(field({ onChange, audience: "SELECTED" }));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenLastCalledWith("SELECTED", new Set(["s1", "s2"]));

    await user.type(screen.getByLabelText("Search pupils"), "KDL003");
    expect(screen.queryByLabelText(/Ada Okoye/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Chidi Eze/)).toBeInTheDocument();
  });

  it("keeps a locked pupil ticked and refuses narrowing when locked", () => {
    const { rerender } = render(field({ audience: "SELECTED", selected: new Set(["s1"]), isLocked: (id) => id === "s1" }));
    expect(screen.getByLabelText(/Ada Okoye/)).toBeChecked();
    expect(screen.getByLabelText(/Ada Okoye/)).toBeDisabled();
    expect(screen.getByLabelText(/Bola Ade/)).toBeEnabled();

    rerender(field({ narrowingLocked: true, narrowingLockedNote: "This quiz can't be narrowed any more." }));
    expect(screen.getByLabelText("Selected pupils")).toBeDisabled();
    expect(screen.getByText(/can't be narrowed/)).toBeInTheDocument();
  });
});
