import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as studentsApi from "@/api/students";
import type { AgeDistribution } from "@/api/students";
import { ApiError } from "@/api/client";
import { AgeDistributionCard } from "@/features/students/components/AgeDistributionCard";

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, getStudentAgeDistribution: vi.fn() };
});

const DISTRIBUTION: AgeDistribution = {
  bands: [
    { age: 6, count: 2 },
    { age: 8, count: 8 },
  ],
  totalStudents: 10,
  unknownAge: 0,
};

describe("AgeDistributionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a row per band with its count and share of the total", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue(DISTRIBUTION);

    render(<AgeDistributionCard />);

    expect(await screen.findByText("6")).toBeInTheDocument();
    // "8" appears twice - once as the age label, once as that band's count.
    expect(screen.getAllByText("8")).toHaveLength(2);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("gives the tallest band's rail full width, relative to the largest band", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue(DISTRIBUTION);

    const { container } = render(<AgeDistributionCard />);
    await screen.findByText("6");

    const rails = container.querySelectorAll<HTMLDivElement>("[aria-hidden] > div");
    expect(rails).toHaveLength(2);
    expect(rails[0]?.style.width).toBe("25%"); // 2 of maxCount 8
    expect(rails[1]?.style.width).toBe("100%"); // 8 of maxCount 8
  });

  it("shows the unknown-age footer only when unknownAge is greater than zero, pluralized correctly", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue({ ...DISTRIBUTION, unknownAge: 3 });

    render(<AgeDistributionCard />);

    expect(await screen.findByText("3 students have no date of birth on file.")).toBeInTheDocument();
  });

  it("uses the singular form for exactly one unknown-age student", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue({ ...DISTRIBUTION, unknownAge: 1 });

    render(<AgeDistributionCard />);

    expect(await screen.findByText("1 student has no date of birth on file.")).toBeInTheDocument();
  });

  it("omits the unknown-age footer when unknownAge is zero", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue(DISTRIBUTION);

    render(<AgeDistributionCard />);

    await screen.findByText("6");
    expect(screen.queryByText(/no date of birth on file/)).not.toBeInTheDocument();
  });

  it("shows an explicit empty message when there are no active students", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue({
      bands: [],
      totalStudents: 0,
      unknownAge: 0,
    });

    render(<AgeDistributionCard />);

    expect(await screen.findByText("No active students yet.")).toBeInTheDocument();
  });

  it("renders nothing when there are no active students and hideWhenEmpty is set", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockResolvedValue({
      bands: [],
      totalStudents: 0,
      unknownAge: 0,
    });

    const { container } = render(<AgeDistributionCard hideWhenEmpty />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders an error alert when the fetch fails", async () => {
    vi.mocked(studentsApi.getStudentAgeDistribution).mockRejectedValue(new ApiError(500, "Server error"));

    render(<AgeDistributionCard />);

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
