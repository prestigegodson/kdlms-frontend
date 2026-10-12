import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { QuestionTagsField } from "@/features/takeHomeQuizzes/components/QuestionTagsField";

function Harness({ initial = [] as string[], disabled = false }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <QuestionTagsField id="tags" tags={tags} onChange={setTags} disabled={disabled} />
      <output data-testid="tags">{tags.join("|")}</output>
    </>
  );
}

describe("QuestionTagsField", () => {
  it("adds a lower-cased tag on Enter and on a comma, ignoring duplicates", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Topic tags");

    await user.type(input, "  Photosynthesis {Enter}");
    await user.type(input, "plants,");
    await user.type(input, "PHOTOSYNTHESIS{Enter}");

    expect(screen.getByTestId("tags")).toHaveTextContent("photosynthesis|plants");
  });

  it("removes a tag and hides the input once five tags are set", async () => {
    render(<Harness initial={["a", "b", "c", "d", "e"]} />);
    const user = userEvent.setup();

    expect(screen.queryByPlaceholderText("Add a tag")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove tag c" }));

    expect(screen.getByTestId("tags")).toHaveTextContent("a|b|d|e");
    expect(screen.getByPlaceholderText("Add a tag")).toBeInTheDocument();
  });

  it("is read-only when disabled", () => {
    render(<Harness initial={["algebra"]} disabled />);
    expect(screen.getByText("algebra", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove tag algebra" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add a tag")).not.toBeInTheDocument();
  });
});
