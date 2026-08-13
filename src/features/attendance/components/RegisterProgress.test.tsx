import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";

describe("RegisterProgress", () => {
  it("defaults to student/marked wording, pluralizing the remaining count", () => {
    render(<RegisterProgress markedCount={5} totalCount={8} />);

    expect(screen.getByText("5 of 8 marked")).toBeInTheDocument();
    expect(screen.getByText("3 students still unmarked")).toBeInTheDocument();
  });

  it("uses the singular noun for exactly one remaining", () => {
    render(<RegisterProgress markedCount={7} totalCount={8} />);

    expect(screen.getByText("1 student still unmarked")).toBeInTheDocument();
  });

  it("shows no remaining-count line once everything is marked", () => {
    render(<RegisterProgress markedCount={8} totalCount={8} />);

    expect(screen.queryByText(/still un/)).not.toBeInTheDocument();
  });

  it("pluralizes an irregular noun correctly via itemLabelPlural, the dashboard's publication-progress usage", () => {
    render(
      <RegisterProgress
        markedCount={1}
        totalCount={3}
        itemLabel="class"
        itemLabelPlural="classes"
        verbLabel="published"
      />,
    );

    expect(screen.getByText("1 of 3 published")).toBeInTheDocument();
    expect(screen.getByText("2 classes still unpublished")).toBeInTheDocument();
    expect(screen.queryByText(/classs/)).not.toBeInTheDocument();
  });

  it("falls back to a naive +s plural when itemLabelPlural is omitted", () => {
    render(<RegisterProgress markedCount={0} totalCount={2} itemLabel="student" verbLabel="marked" />);

    expect(screen.getByText("2 students still unmarked")).toBeInTheDocument();
  });
});
