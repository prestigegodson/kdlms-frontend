import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiSettingsApi from "@/api/aiSettings";
import { AdminAiSettingsPage } from "@/features/ai/AdminAiSettingsPage";

vi.mock("@/api/aiSettings", async () => {
  const actual = await vi.importActual<typeof import("@/api/aiSettings")>("@/api/aiSettings");
  return { ...actual, getAiSettings: vi.fn(), updateAiSettings: vi.fn(), getAiUsage: vi.fn() };
});

const BASE_SETTINGS = {
  provider: null,
  model: null,
  maxTokens: null,
  temperature: null,
  effectiveProvider: "log",
  effectiveModel: null,
  effectiveMaxTokens: 4096,
  effectiveTemperature: 0.4,
  availableProviders: ["log"],
};

describe("AdminAiSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current settings, only offers available providers, saves, and shows a success alert", async () => {
    vi.mocked(aiSettingsApi.getAiSettings).mockResolvedValue(BASE_SETTINGS);
    vi.mocked(aiSettingsApi.getAiUsage).mockResolvedValue([]);
    vi.mocked(aiSettingsApi.updateAiSettings).mockResolvedValue({
      ...BASE_SETTINGS,
      model: "log-skeleton-v1",
    });
    const user = userEvent.setup();
    render(<AdminAiSettingsPage />);

    const providerSelect = await screen.findByLabelText("Provider");
    expect(screen.queryByRole("option", { name: "anthropic" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "log" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Model"), "log-skeleton-v1");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(aiSettingsApi.updateAiSettings).toHaveBeenCalledWith({
      provider: null,
      model: "log-skeleton-v1",
      maxTokens: null,
      temperature: null,
    });
    expect(await screen.findByText("AI settings updated.")).toBeInTheDocument();
    expect(providerSelect).toBeInTheDocument();
  });

  it("never renders a key or key-shaped field", async () => {
    vi.mocked(aiSettingsApi.getAiSettings).mockResolvedValue(BASE_SETTINGS);
    vi.mocked(aiSettingsApi.getAiUsage).mockResolvedValue([]);
    render(<AdminAiSettingsPage />);

    await screen.findByLabelText("Provider");
    expect(screen.queryByLabelText(/key/i)).not.toBeInTheDocument();
  });

  it("shows the current month's usage rollup", async () => {
    vi.mocked(aiSettingsApi.getAiSettings).mockResolvedValue(BASE_SETTINGS);
    vi.mocked(aiSettingsApi.getAiUsage).mockResolvedValue([
      {
        schoolId: "school-1",
        schoolName: "Bright Star Academy",
        totalGenerations: 5,
        succeeded: 4,
        failed: 1,
        inputTokens: 1000,
        outputTokens: 2000,
      },
    ]);
    render(<AdminAiSettingsPage />);

    expect(await screen.findByText("Bright Star Academy")).toBeInTheDocument();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(aiSettingsApi.getAiSettings).mockRejectedValue(new Error("boom"));
    vi.mocked(aiSettingsApi.getAiUsage).mockResolvedValue([]);
    render(<AdminAiSettingsPage />);

    expect(await screen.findByText("Failed to load AI settings")).toBeInTheDocument();
  });

  it("shows a provider-default placeholder for temperature when a configured row cleared it", async () => {
    vi.mocked(aiSettingsApi.getAiSettings).mockResolvedValue({
      ...BASE_SETTINGS,
      provider: "openai",
      model: "gpt-5-mini",
      effectiveTemperature: null,
    });
    vi.mocked(aiSettingsApi.getAiUsage).mockResolvedValue([]);
    render(<AdminAiSettingsPage />);

    expect(await screen.findByLabelText("Temperature")).toHaveAttribute("placeholder", "Provider default");
  });
});
