import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TournamentExperience } from "@/components/evolve/tournament-experience";

describe("P8 evolution surface", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/evolve/");
  });

  it("opens the seeded evolution view with an operable scrubber and table fallback", async () => {
    render(<TournamentExperience />);

    fireEvent.click(screen.getByRole("tab", { name: "Evolution" }));
    expect(
      screen.getByRole("heading", {
        name: "Population shares under a fixed environment",
      }),
    ).toBeVisible();

    const scrubber = screen.getByRole("slider", {
      name: "Generation scrubber",
    });
    fireEvent.change(scrubber, { target: { value: "20" } });
    expect(scrubber).toHaveValue("20");
    await waitFor(() => expect(screen.getByText("Showing generation 20 of 100.")).toBeVisible());

    fireEvent.click(screen.getByText("View each generation as an accessible data table"));
    expect(
      screen.getByRole("table", {
        name: "Population share at every generation for this seeded evolution run.",
      }),
    ).toBeVisible();
  });

  it("recomputes from a reviewed preset and carries all inputs in the URL", () => {
    render(<TournamentExperience />);
    fireEvent.click(screen.getByRole("tab", { name: "Evolution" }));

    fireEvent.change(screen.getByLabelText("Story"), {
      target: { value: "noise" },
    });
    expect(
      screen.getByText(
        "With a 3% action-flip rate, Pavlov leads this selected field. That is this model's output, not a universal ranking of strategies.",
      ),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Action noise"), {
      target: { value: "0.05" },
    });
    expect(screen.getByLabelText("Action noise")).toHaveValue("0.05");
    expect(window.location.search).toContain("ev=1");
    expect(window.location.search).toContain("seed=940419");
    expect(window.location.search).toContain("cap=500");
  });
});
