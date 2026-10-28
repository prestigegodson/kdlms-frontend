import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as tutorCurrenciesApi from "@/api/tutorCurrencies";
import { TutorCurrenciesCard } from "./TutorCurrenciesCard";

vi.mock("@/api/tutorCurrencies");

const ALL = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;

describe("TutorCurrenciesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tutorCurrenciesApi.getTutorCurrencies).mockResolvedValue({
      enabled: [...ALL],
      defaultCurrency: "NGN",
      supported: [...ALL],
    });
  });

  it("saves the enabled currencies and the default", async () => {
    vi.mocked(tutorCurrenciesApi.updateTutorCurrencies).mockResolvedValue({
      enabled: ["NGN", "KES", "USD"],
      defaultCurrency: "USD",
      supported: [...ALL],
    });
    const user = userEvent.setup();
    render(<TutorCurrenciesCard />);

    await user.click(await screen.findByLabelText("GHS"));
    await user.click(screen.getByLabelText("ZAR"));
    await user.selectOptions(screen.getByLabelText("Default currency"), "USD");
    await user.click(screen.getByRole("button", { name: "Save currencies" }));

    expect(tutorCurrenciesApi.updateTutorCurrencies).toHaveBeenCalledWith({
      enabled: ["NGN", "KES", "USD"],
      defaultCurrency: "USD",
    });
    expect(await screen.findByText("Tutor currencies updated.")).toBeInTheDocument();
  });

  it("moves the default off a currency that is switched off", async () => {
    const user = userEvent.setup();
    render(<TutorCurrenciesCard />);

    await user.click(await screen.findByLabelText("NGN"));

    expect(screen.getByLabelText("Default currency")).toHaveValue("GHS");
  });

  it("can't save with every currency switched off", async () => {
    vi.mocked(tutorCurrenciesApi.getTutorCurrencies).mockResolvedValue({
      enabled: ["USD"],
      defaultCurrency: "USD",
      supported: [...ALL],
    });
    const user = userEvent.setup();
    render(<TutorCurrenciesCard />);

    await user.click(await screen.findByLabelText("USD"));

    expect(screen.getByText("Enable at least one currency.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save currencies" })).toBeDisabled();
  });

  it("shows the server's message when a save is refused", async () => {
    vi.mocked(tutorCurrenciesApi.updateTutorCurrencies).mockRejectedValue(
      new ApiError(422, "Enable at least one currency for tutors."),
    );
    const user = userEvent.setup();
    render(<TutorCurrenciesCard />);

    await user.click(await screen.findByRole("button", { name: "Save currencies" }));

    expect(await screen.findByText("Enable at least one currency for tutors.")).toBeInTheDocument();
  });
});
