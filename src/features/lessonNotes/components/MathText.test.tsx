import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathText } from "@/features/lessonNotes/components/MathText";

// Every string with a backslash below is passed through a `{...}` expression
// container (a plain JS string literal, `\\` = one backslash) rather than a
// bare JSX attribute - JSX attribute string literals don't process escape
// sequences at all, so `attr="\\"` there would render two literal backslashes.

describe("MathText", () => {
  it("renders KaTeX markup for each inline expression and keeps surrounding prose as plain text", () => {
    const text =
      "Solve: \\( \\frac{4}{9}+\\frac{2}{9} \\), \\( \\frac{1}{3}+\\frac{1}{6} \\), and " +
      "\\( \\frac{3}{4}+\\frac{1}{8} \\). Write each answer in its lowest terms.";

    const { container } = render(<MathText text={text} />);

    expect(container).toHaveTextContent("Solve:");
    expect(container).toHaveTextContent("Write each answer in its lowest terms.");
    expect(container.querySelectorAll(".katex")).toHaveLength(3);
    // The rendered maths should never leave the literal \( \) delimiters visible
    // to the user - that's the whole bug being fixed. (KaTeX's own MathML
    // annotation legitimately embeds the raw \frac source for accessibility,
    // so that substring is expected to appear inside the markup.)
    expect(container.innerHTML).not.toContain("\\(");
    expect(container.innerHTML).not.toContain("\\)");
  });

  it("leaves a string with no delimiters entirely as plain text", () => {
    const { container } = render(<MathText text="Learners identify the parts of a plant." />);

    expect(container).toHaveTextContent("Learners identify the parts of a plant.");
    expect(container.querySelectorAll(".katex")).toHaveLength(0);
  });

  it("renders KaTeX's own error styling for malformed LaTeX rather than crashing the page", () => {
    const text = "Bad maths: \\( \\frac{1 \\).";

    const { container } = render(<MathText text={text} />);

    expect(container).toHaveTextContent("Bad maths:");
    // throwOnError: false means KaTeX catches its own ParseError and renders
    // a `.katex-error` span instead of throwing - MathText's own try/catch is
    // a second-line defence for anything that isn't a parse error.
    expect(container.querySelector(".katex-error")).not.toBeNull();
  });

  it("does not treat a single backslash-paren or a lone $ as a delimiter", () => {
    const text = "Cost is $500, not \\ a formula.";

    const { container } = render(<MathText text={text} />);

    expect(container).toHaveTextContent(text);
    expect(container.querySelectorAll(".katex")).toHaveLength(0);
  });
});
