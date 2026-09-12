import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import type { BillView } from "@/api/billing";
import { WardBillsPage } from "@/features/guardian/WardBillsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore } from "@/stores/featureStore";
import { resetWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return {
    ...actual,
    listMyWards: vi.fn(),
    listWardBills: vi.fn(),
    getWardBill: vi.fn(),
    downloadWardBillPdf: vi.fn(),
  };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  currentClassName: "Primary 3",
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const BILL_SUMMARY = {
  sessionId: "session-1",
  sessionName: "2026/2027",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "SCH/2026/0001-T1",
  total: 5000,
  currency: "NGN",
};

const BILL: BillView = {
  studentId: "s1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 3",
  levelId: "level-1",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2026/2027",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "SCH/2026/0001-T1",
  billable: true,
  chargedLines: [{ feeId: "fee-1", feeName: "Tuition", amount: 5000 }],
  optionalLines: [],
  transportFares: [],
  total: 5000,
  currency: "NGN",
  bankAccounts: [],
  instructions: null,
  advance: false,
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "guardian-1",
      email: "guardian@example.com",
      firstName: "Gina",
      lastName: "G",
      role: "GUARDIAN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <WardBillsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("WardBillsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    resetFeatureStore();
    vi.mocked(wardsApi.listWardBills).mockResolvedValue([BILL_SUMMARY]);
    vi.mocked(wardsApi.getWardBill).mockResolvedValue(BILL);
    vi.mocked(wardsApi.downloadWardBillPdf).mockResolvedValue(new Blob(["%PDF-"]));
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("shows a retryable error state when the ward list fails to load", async () => {
    vi.mocked(wardsApi.listMyWards).mockRejectedValueOnce(new Error("network down")).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("First Term")).toBeInTheDocument();
  });

  it("shows an empty state when the ward has no published bills yet", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.listWardBills).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No bills yet")).toBeInTheDocument();
  });

  it("lists a published bill's session, term, reference, and formatted total", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);

    renderPage();

    expect(await screen.findByText("2026/2027")).toBeInTheDocument();
    expect(screen.getByText("First Term")).toBeInTheDocument();
    expect(screen.getByText("SCH/2026/0001-T1")).toBeInTheDocument();
  });

  it("opens a bill in a modal when its row is tapped, and downloads the PDF", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("First Term");
    await user.click(screen.getByText("First Term"));

    expect(await screen.findByText("Tuition")).toBeInTheDocument();
    expect(wardsApi.getWardBill).toHaveBeenCalledWith("s1", "term-1");

    await user.click(screen.getByRole("button", { name: /Download PDF/ }));

    await waitFor(() => expect(wardsApi.downloadWardBillPdf).toHaveBeenCalledWith("s1", "term-1"));
    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "SCH/2026/0001-bill-First Term.pdf"),
    );
  });
});
