import { describe, expect, it } from "vitest";
import type { LessonNoteContentView } from "@/api/lessonNotes";
import { lessonNoteContentToHtml } from "@/features/lessonNotes/components/lessonNoteContentToHtml";

const BASE: LessonNoteContentView = {
  mode: "STRUCTURED",
  body: null,
  subTopic: null,
  duration: null,
  averageAge: null,
  objectives: [],
  entryBehaviour: null,
  instructionalMaterials: [],
  references: [],
  presentation: [],
  evaluation: null,
  conclusion: null,
  assignment: null,
};

describe("lessonNoteContentToHtml", () => {
  it("renders a blank structured note as an empty document", () => {
    expect(lessonNoteContentToHtml(BASE)).toBe("<p></p>");
  });

  it("renders each non-blank field as a heading and paragraph", () => {
    const html = lessonNoteContentToHtml({ ...BASE, subTopic: "Adding fractions", evaluation: "Solve 3 problems" });

    expect(html).toContain("<h3>Sub-topic</h3><p>Adding fractions</p>");
    expect(html).toContain("<h3>Evaluation</h3><p>Solve 3 problems</p>");
    expect(html).not.toContain("Duration");
  });

  it("renders a list field as a bullet list, skipping blank rows", () => {
    const html = lessonNoteContentToHtml({ ...BASE, objectives: ["Add fractions", "  ", "Subtract fractions"] });

    expect(html).toContain("<h3>Behavioural objectives</h3><ul><li>Add fractions</li><li>Subtract fractions</li></ul>");
  });

  it("renders presentation steps as a table", () => {
    const html = lessonNoteContentToHtml({
      ...BASE,
      presentation: [{ label: "Step 1", teacherActivity: "Explains", learnerActivity: "Listens" }],
    });

    expect(html).toContain("<table>");
    expect(html).toContain("<td>Step 1</td><td>Explains</td><td>Listens</td>");
  });

  it("falls back to a default step label when blank", () => {
    const html = lessonNoteContentToHtml({
      ...BASE,
      presentation: [{ label: "", teacherActivity: "Explains", learnerActivity: "Listens" }],
    });

    expect(html).toContain("<td>Step 1</td>");
  });

  it("converts inline LaTeX into a math span", () => {
    const html = lessonNoteContentToHtml({ ...BASE, evaluation: "Solve \\(x^2 = 4\\) for x" });

    expect(html).toContain('<span data-type="inline-math" data-latex="x^2 = 4"></span>');
    expect(html).toContain("Solve ");
    expect(html).toContain(" for x");
  });

  it("escapes HTML-significant characters in plain prose", () => {
    const html = lessonNoteContentToHtml({ ...BASE, evaluation: "Is 3 < 5 & 5 > 3?" });

    expect(html).toContain("Is 3 &lt; 5 &amp; 5 &gt; 3?");
    expect(html).not.toContain("<5");
  });

  it("escapes a quote inside a LaTeX expression's attribute value", () => {
    const html = lessonNoteContentToHtml({ ...BASE, evaluation: 'Solve \\(a"b\\)' });

    expect(html).toContain('data-latex="a&quot;b"');
  });
});
