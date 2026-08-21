import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as birthdaysApi from "@/api/birthdays";
import type { BirthdayView } from "@/api/birthdays";
import { ApiError } from "@/api/client";
import { UpcomingBirthdaysCard } from "@/features/students/components/UpcomingBirthdaysCard";

vi.mock("@/api/birthdays", async () => {
  const actual = await vi.importActual<typeof import("@/api/birthdays")>("@/api/birthdays");
  return { ...actual, listUpcomingBirthdays: vi.fn(), listClassBirthdays: vi.fn() };
});

const ADA: BirthdayView = {
  studentId: "student-ada",
  fullName: "Ada Obi",
  admissionNumber: "BFA/2026/0001",
  classId: "class-1",
  className: "Primary 1",
  levelName: "Primary",
  dateOfBirth: "1990-08-17",
  daysUntil: 3,
  turningAge: 8,
};

/** Fans ADA out into `n` distinct rows, mirroring Pagination.test.tsx's pageOf(...) helper. */
function rowsOf(n: number): BirthdayView[] {
  return Array.from({ length: n }, (_, i) => ({
    ...ADA,
    studentId: `student-${i}`,
    fullName: `Student ${i}`,
    daysUntil: i,
  }));
}

function renderCard(props: Parameters<typeof UpcomingBirthdaysCard>[0] = {}) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <UpcomingBirthdaysCard {...props} /> },
      { path: "/school/students/:studentId", element: <div>Student detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("UpcomingBirthdaysCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the role-shaped school-wide list when classId is omitted, showing name/class/day", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([ADA]);

    renderCard();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Primary 1")).toBeInTheDocument();
    expect(screen.getByText("17 Aug")).toBeInTheDocument();
    expect(screen.getByText("in 3 days")).toBeInTheDocument();
    expect(birthdaysApi.listUpcomingBirthdays).toHaveBeenCalledTimes(1);
    expect(birthdaysApi.listClassBirthdays).not.toHaveBeenCalled();
  });

  it("fetches the class-scoped list and omits the class name when classId is set", async () => {
    vi.mocked(birthdaysApi.listClassBirthdays).mockResolvedValue([ADA]);

    renderCard({ classId: "class-1" });

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.queryByText("Primary 1")).not.toBeInTheDocument();
    expect(birthdaysApi.listClassBirthdays).toHaveBeenCalledWith("class-1");
  });

  it("shows Today for a birthday that's due today", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([{ ...ADA, daysUntil: 0 }]);

    renderCard();

    expect(await screen.findByText("Today")).toBeInTheDocument();
  });

  it("renders nothing when empty and hideWhenEmpty is set", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([]);

    const { container } = renderCard({ hideWhenEmpty: true });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("shows an EmptyState when empty and hideWhenEmpty is not set", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText("No upcoming birthdays")).toBeInTheDocument();
    expect(screen.getByText("No birthdays in the next 7 days.")).toBeInTheDocument();
  });

  it("shows the class-scoped empty description when classId is set and there are no rows", async () => {
    vi.mocked(birthdaysApi.listClassBirthdays).mockResolvedValue([]);

    renderCard({ classId: "class-1", showHeader: false });

    expect(await screen.findByText("No upcoming birthdays")).toBeInTheDocument();
    expect(screen.getByText("No one in this class has a birthday in the next 7 days.")).toBeInTheDocument();
  });

  it("shows the plural header even when there are no upcoming birthdays", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText("Upcoming birthdays")).toBeInTheDocument();
  });

  it("renders an error alert when the fetch fails", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockRejectedValue(new ApiError(500, "Server error"));

    renderCard();

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });

  it("links a row to the student's detail page only when linkable", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([ADA]);

    renderCard({ linkable: true });

    const link = await screen.findByText("Ada Obi").then((el) => el.closest("a"));
    expect(link).toHaveAttribute("href", "/school/students/student-ada");
  });

  it("does not link a row when linkable is not set", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([ADA]);

    renderCard();

    const name = await screen.findByText("Ada Obi");
    expect(name.closest("a")).toBeNull();
  });

  it("shows only the first 5 rows and a View more button for a 12-row response", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue(rowsOf(12));

    renderCard();

    expect(await screen.findByText("Student 0")).toBeInTheDocument();
    expect(screen.getByText("Student 4")).toBeInTheDocument();
    expect(screen.queryByText("Student 5")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View more (7)" })).toBeInTheDocument();
  });

  it("reveals 5 more rows per click and updates the remaining count", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue(rowsOf(12));
    const user = userEvent.setup();

    renderCard();
    await screen.findByText("Student 0");

    await user.click(screen.getByRole("button", { name: "View more (7)" }));

    expect(screen.getByText("Student 9")).toBeInTheDocument();
    expect(screen.queryByText("Student 10")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View more (2)" })).toBeInTheDocument();
  });

  it("shows a Show less button once fully revealed, and collapses back to 5 on click", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue(rowsOf(12));
    const user = userEvent.setup();

    renderCard();
    await screen.findByText("Student 0");

    await user.click(screen.getByRole("button", { name: "View more (7)" }));
    await user.click(screen.getByRole("button", { name: "View more (2)" }));

    expect(screen.getByText("Student 11")).toBeInTheDocument();
    const showLess = screen.getByRole("button", { name: "Show less" });

    await user.click(showLess);

    expect(screen.queryByText("Student 5")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View more (7)" })).toBeInTheDocument();
  });

  it("renders no footer button when there are 5 or fewer rows", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue(rowsOf(5));

    renderCard();

    await screen.findByText("Student 0");
    expect(screen.queryByRole("button", { name: /View more|Show less/ })).not.toBeInTheDocument();
  });

  it("shows the total count in the header badge, not the visible count", async () => {
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue(rowsOf(12));

    renderCard();

    const heading = await screen.findByText("Upcoming birthdays");
    expect(within(heading.parentElement as HTMLElement).getByText("12")).toBeInTheDocument();
  });

  it("shows a count line for the headerless variant", async () => {
    vi.mocked(birthdaysApi.listClassBirthdays).mockResolvedValue(rowsOf(12));

    renderCard({ classId: "class-1", showHeader: false });

    expect(await screen.findByText("12 upcoming birthdays")).toBeInTheDocument();
  });

  it("resets the reveal back to 5 when classId changes", async () => {
    vi.mocked(birthdaysApi.listClassBirthdays).mockImplementation((classId) =>
      Promise.resolve(classId === "class-1" ? rowsOf(12) : rowsOf(3)),
    );
    const user = userEvent.setup();

    const { rerender } = render(<UpcomingBirthdaysCard classId="class-1" />);
    await screen.findByText("Student 0");
    await user.click(screen.getByRole("button", { name: "View more (7)" }));
    expect(screen.getByText("Student 9")).toBeInTheDocument();

    rerender(<UpcomingBirthdaysCard classId="class-2" />);

    await waitFor(() => expect(screen.queryByText("Student 9")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /View more|Show less/ })).not.toBeInTheDocument();
  });
});
