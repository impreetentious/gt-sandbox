import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TournamentExperience } from "@/components/evolve/tournament-experience";

describe("P7 tournament surface", () => {
  afterEach(cleanup);

  it("renders a ranked heatmap and exposes its exact table fallback", () => {
    render(<TournamentExperience />);

    expect(
      screen.getByRole("heading", {
        name: "A finite tournament of repeatable strategies.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Mean payoff across the selected field",
      }),
    ).toBeVisible();
    expect(screen.getByText("View as an accessible data table")).toBeVisible();
    expect(screen.getByTitle("12870870635796287981/5007090051190656000")).toHaveTextContent("2.57");
  });

  it("recomputes a canonical roster selection and preserves the two-strategy floor", () => {
    render(<TournamentExperience />);
    const allCooperate = screen.getByRole("checkbox", {
      name: "Always Cooperate",
    });

    fireEvent.click(allCooperate);
    expect(screen.getByRole("status", { name: "Tournament changes" })).toHaveTextContent(
      "Always Cooperate removed from the tournament. 7 strategies selected.",
    );
    expect(allCooperate).not.toBeChecked();

    for (const strategy of [
      "Always Defect",
      "Tit for Tat",
      "Grim Trigger",
      "Pavlov",
      "Generous TFT",
    ]) {
      fireEvent.click(screen.getByRole("checkbox", { name: strategy }));
    }

    const joss = screen.getByRole("checkbox", { name: "Joss" });
    fireEvent.click(joss);
    expect(screen.getByRole("status", { name: "Tournament changes" })).toHaveTextContent(
      "Keep at least two strategies in the tournament.",
    );
    expect(joss).toBeChecked();
  });
});
