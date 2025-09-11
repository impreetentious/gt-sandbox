import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FinitePopulationExperience } from "@/components/evolve/finite-population-experience";

function setSlider(name: RegExp, value: number) {
  fireEvent.change(screen.getByRole("slider", { name }), {
    target: { value: String(value) },
  });
}

function selectGame(label: string) {
  fireEvent.change(screen.getByLabelText("Game"), { target: { value: label } });
}

describe("finite-population surface", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens on the Stag Hunt at N = 20", () => {
    render(<FinitePopulationExperience />);
    expect(
      screen.getByRole("heading", {
        name: "Luck decides more often than fitness",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Game")).toHaveValue("stag-hunt");
    expect(screen.getByRole("slider", { name: /Population size/ })).toHaveValue(
      "20",
    );
  });

  it("reports exactly 1/N under neutral drift, for the whole table", () => {
    render(<FinitePopulationExperience />);
    selectGame("neutral");
    setSlider(/Population size/, 8);
    const table = screen.getByTestId("finite-fixation");
    // Both mutants and the benchmark must all read 1/8.
    expect(table.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(table).toHaveTextContent(/1\/8/);
    // Neither strategy beats the benchmark, because selection does nothing.
    const rows = table.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent(/No$/);
    expect(rows[1]).toHaveTextContent(/No$/);
  });

  it("marks Defect as the only ESS and the only favoured mutant in a PD", () => {
    render(<FinitePopulationExperience />);
    selectGame("prisoners-dilemma");
    expect(screen.getByTestId("finite-ess-a")).toHaveTextContent(/Not an ESS/);
    expect(screen.getByTestId("finite-ess-b")).toHaveTextContent(/An ESS/);
    const rows = screen
      .getByTestId("finite-fixation")
      .querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent(/No$/); // Cooperate not favoured
    expect(rows[1]).toHaveTextContent(/Yes$/); // Defect favoured
  });

  it("surfaces the exact mixed ESS share in Hawk–Dove", () => {
    render(<FinitePopulationExperience />);
    selectGame("hawk-dove");
    const mixed = screen.getByTestId("finite-mixed");
    expect(mixed).toHaveTextContent(/1\/2/);
    expect(mixed).toHaveTextContent(/it is an attractor/);
    expect(screen.getByTestId("finite-ess-a")).toHaveTextContent(/Not an ESS/);
    expect(screen.getByTestId("finite-ess-b")).toHaveTextContent(/Not an ESS/);
  });

  it("calls out where ESS and the 1/N rule disagree in the Stag Hunt", () => {
    render(<FinitePopulationExperience />);
    // Default N = 20: Hare is an ESS but is also favoured, and so is Stag's
    // ESS status contradicted by Hare's invasion — the disagreement banner.
    expect(screen.getByTestId("finite-disagreement")).toHaveTextContent(
      /The two tests disagree here/,
    );
  });

  it("drops the disagreement banner once the population is large enough", () => {
    render(<FinitePopulationExperience />);
    setSlider(/Population size/, 50);
    expect(screen.queryByTestId("finite-disagreement")).not.toBeInTheDocument();
  });

  it("shows the interior rest point as a repellor in the Stag Hunt", () => {
    render(<FinitePopulationExperience />);
    expect(screen.getByTestId("finite-mixed")).toHaveTextContent(/2\/3/);
    expect(screen.getByTestId("finite-mixed")).toHaveTextContent(/it repels/);
  });

  it("exposes the fixation curve as an accessible data table", () => {
    render(<FinitePopulationExperience />);
    setSlider(/Population size/, 4);
    fireEvent.click(
      screen.getByText("View the fixation curve as an accessible data table"),
    );
    const table = screen.getByRole("table", {
      name: /Exact fixation probability for Stag from every starting count/,
    });
    // States 0..4 inclusive.
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
  });

  it("reports the exact margin over neutral drift", () => {
    render(<FinitePopulationExperience />);
    selectGame("neutral");
    setSlider(/Population size/, 6);
    fireEvent.click(
      screen.getByText("Why these are fractions and not decimals"),
    );
    // Neutral game: fixation is exactly 1/6, so the margin is exactly 0.
    expect(screen.getByTestId("finite-margin")).toHaveTextContent("0");
    expect(
      screen.getByText(/selection is doing nothing at all/),
    ).toBeInTheDocument();
  });
});
