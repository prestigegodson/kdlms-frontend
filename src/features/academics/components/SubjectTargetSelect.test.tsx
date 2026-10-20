import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SubjectTargetSelect } from "@/features/academics/components/SubjectTargetSelect";
import type { GroupableSubject } from "@/features/academics/subjectTarget";

const SUBJECTS: GroupableSubject[] = [
  { subjectId: "maths", subjectName: "Mathematics" },
  { subjectId: "physics", subjectName: "Physics", subjectGroupId: "sci", subjectGroupName: "Sciences" },
  { subjectId: "chemistry", subjectName: "Chemistry", subjectGroupId: "sci", subjectGroupName: "Sciences" },
  { subjectId: "french", subjectName: "French", subjectGroupId: "lang", subjectGroupName: "Languages" },
];

function Harness({
  initial = "",
  onChange = vi.fn(),
  subjectGroups,
  placeholder,
  leadingOptions,
}: {
  initial?: string;
  onChange?: (key: string) => void;
  subjectGroups?: { subjectGroupId: string; subjectGroupName: string }[];
  placeholder?: string | null;
  leadingOptions?: { key: string; label: string }[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="subject">Subject</label>
      <SubjectTargetSelect
        id="subject"
        value={value}
        onChange={(key) => {
          setValue(key);
          onChange(key);
        }}
        subjects={SUBJECTS}
        subjectGroups={subjectGroups}
        placeholder={placeholder}
        leadingOptions={leadingOptions}
      />
      <button type="button" onClick={() => setValue("french")}>
        Reset externally
      </button>
    </>
  );
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Subject"));
  return screen.getByRole("listbox", { name: "Subjects" });
}

describe("SubjectTargetSelect", () => {
  it("shows the selected subject's name and lists subjects under their group headings", async () => {
    const user = userEvent.setup();
    render(<Harness initial="physics" />);
    expect(screen.getByLabelText("Subject")).toHaveValue("Physics");

    const listbox = await open(user);
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Select a subject…",
      "French",
      "Chemistry",
      "Physics",
      "Mathematics",
    ]);
    expect(within(within(listbox).getByRole("group", { name: "Sciences" })).getAllByRole("option")).toHaveLength(2);
    expect(within(listbox).getByRole("group", { name: "Other subjects" })).toHaveTextContent("Mathematics");
    expect(within(listbox).queryByRole("option", { name: "Sciences" })).not.toBeInTheDocument();
  });

  it("offers a selectable group as an option of its own, its subjects after it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} subjectGroups={[{ subjectGroupId: "sci", subjectGroupName: "Sciences" }]} />);

    const listbox = await open(user);
    await user.click(within(listbox).getByRole("option", { name: "Sciences" }));
    expect(onChange).toHaveBeenCalledWith("group:sci");
    expect(screen.getByLabelText("Subject")).toHaveValue("Sciences");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters by subject name and keeps every subject of a group whose name matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.type(screen.getByLabelText("Subject"), "chem");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Chemistry"]);

    await user.clear(screen.getByLabelText("Subject"));
    await user.type(screen.getByLabelText("Subject"), "scien");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Chemistry", "Physics"]);

    await user.clear(screen.getByLabelText("Subject"));
    await user.type(screen.getByLabelText("Subject"), "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching subjects")).toBeInTheDocument();
  });

  it("selects with the keyboard without submitting an enclosing form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Harness onChange={onChange} />
      </form>,
    );

    await user.click(screen.getByLabelText("Subject"));
    await user.type(screen.getByLabelText("Subject"), "math");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("maths");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Subject")).toHaveValue("Mathematics");
  });

  it("closes on Escape and restores the selected name without changing the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="physics" onChange={onChange} />);

    await open(user);
    await user.type(screen.getByLabelText("Subject"), "fre");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Physics");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the value through the placeholder option, and offers none when placeholder is null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Harness initial="physics" onChange={onChange} />);

    await user.click(within(await open(user)).getByRole("option", { name: "Select a subject…" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("Subject")).toHaveValue("");
    unmount();

    render(<Harness initial="physics" placeholder={null} />);
    expect(within(await open(user)).queryByRole("option", { name: "Select a subject…" })).not.toBeInTheDocument();
  });

  it("shows a value changed from outside", async () => {
    const user = userEvent.setup();
    render(<Harness initial="physics" />);

    await user.click(screen.getByRole("button", { name: "Reset externally" }));
    expect(screen.getByLabelText("Subject")).toHaveValue("French");
  });

  it("lists leading options first, shows a picked one's label, and filters them by the query", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} leadingOptions={[{ key: "all", label: "All subjects" }]} />);

    const listbox = await open(user);
    const labels = within(listbox).getAllByRole("option").map((option) => option.textContent);
    expect(labels.slice(0, 2)).toEqual(["Select a subject…", "All subjects"]);

    await user.click(within(listbox).getByRole("option", { name: "All subjects" }));
    expect(onChange).toHaveBeenCalledWith("all");
    expect(screen.getByLabelText("Subject")).toHaveValue("All subjects");

    await user.click(screen.getByLabelText("Subject"));
    await user.type(screen.getByLabelText("Subject"), "phy");
    expect(within(screen.getByRole("listbox", { name: "Subjects" })).queryByRole("option", { name: "All subjects" })).toBeNull();
  });
});
