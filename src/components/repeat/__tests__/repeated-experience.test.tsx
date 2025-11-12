import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RepeatedGameExperience } from "@/components/repeat/repeated-experience";
import { createNormalFormGame } from "@/engine/game";
import { encodeGameSearch } from "@/state/game-url";

function setSearch(search: string) {
  window.history.replaceState(null, "", search === "" ? "/repeat/" : `/repeat/?${search}`);
}

/** A custom stag-hunt-shaped 2×2: mutual "Invest" is cooperative and Pareto-dominant. */
function customGameSearch(rowActions: readonly string[], columnActions: readonly string[]) {
  const payoffs = rowActions.map((_, row) =>
    columnActions.map(
      (__, column) =>
        [row === 0 && column === 0 ? 6 : 1, row === 0 && column === 0 ? 6 : 1] as const,
    ),
  );
  return encodeGameSearch({
    game: createNormalFormGame({
      id: "custom",
      title: "Vendor Pact",
      rowActions: [...rowActions],
      columnActions: [...columnActions],
      payoffs: payoffs.map((row) => row.map(([a, b]) => [a, b] as [number, number])),
    }),
    extras: {},
  });
}

afterEach(() => {
  setSearch("");
  cleanup();
});

describe("repeated-game experience", () => {
  it("shows the exact PD discount threshold and a sustainability verdict", () => {
    render(<RepeatedGameExperience />);
    expect(screen.getByText(/continuation probability is at least 1\/2/)).toBeInTheDocument();
    // Default δ = 0.95 ≥ 1/2, so cooperation is sustainable.
    expect(screen.getByText(/At your chosen/)).toHaveTextContent("sustainable");
  });

  it("discloses that competitive Matching Pennies cannot sustain cooperation", () => {
    render(<RepeatedGameExperience />);
    fireEvent.change(screen.getByLabelText("Stage game"), {
      target: { value: "pennies" },
    });
    expect(screen.getByText(/Cooperation cannot be sustained here/)).toBeInTheDocument();
    expect(screen.getByText(/not individually rational/)).toBeInTheDocument();
  });

  it("runs a seeded match and reports a mutual-cooperation rate", () => {
    render(<RepeatedGameExperience />);
    // Default TFT vs TFT on the PD cooperates every round.
    expect(screen.getByText("Mutual cooperation").nextSibling).toHaveTextContent("100%");
  });

  it("iterates a Build-mode custom game arriving on the share link", () => {
    setSearch(customGameSearch(["Invest", "Hold"], ["Invest", "Hold"]));
    render(<RepeatedGameExperience />);

    // The shared game opens on itself rather than on the catalog default.
    expect(screen.getByLabelText("Stage game")).toHaveValue("custom");
    expect(screen.getByRole("option", { name: "Vendor Pact (yours)" })).toBeInTheDocument();
    // The folk-theorem analysis runs on the payoffs the user entered.
    expect(screen.getByText(/\(Invest, Invest\)/)).toBeInTheDocument();
    expect(screen.getByText(/already a stage equilibrium/)).toBeInTheDocument();
  });

  it("makes the cooperative designation the user's choice, not a guess", () => {
    setSearch(customGameSearch(["Invest", "Hold"], ["Invest", "Hold"]));
    render(<RepeatedGameExperience />);

    expect(screen.getByText(/your designation, not a property of the payoffs/)).toBeInTheDocument();
    // Designating (Hold, Hold) instead moves the cooperative marker with it.
    fireEvent.change(screen.getByLabelText("Row's cooperative action"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Column's cooperative action"), {
      target: { value: "1" },
    });
    expect(screen.getByText(/\(Hold, Hold\) — cooperative/)).toBeInTheDocument();
  });

  it("keeps the catalog reachable while a custom game is loaded", () => {
    setSearch(customGameSearch(["Invest", "Hold"], ["Invest", "Hold"]));
    render(<RepeatedGameExperience />);

    fireEvent.change(screen.getByLabelText("Stage game"), { target: { value: "pd" } });
    expect(screen.getByText(/continuation probability is at least 1\/2/)).toBeInTheDocument();
    // Switching back is possible because the custom option never leaves the select.
    expect(screen.getByRole("option", { name: "Vendor Pact (yours)" })).toBeInTheDocument();
  });

  it("refuses a non-binary custom game instead of cropping it", () => {
    setSearch(customGameSearch(["A", "B", "C"], ["A", "B", "C"]));
    render(<RepeatedGameExperience />);

    expect(screen.getByText(/defined for 2×2 stage games/)).toBeInTheDocument();
    expect(screen.getByText(/is 3×3/)).toBeInTheDocument();
    // It falls back to the catalog rather than rendering an analysis of a game nobody built.
    expect(screen.getByLabelText("Stage game")).toHaveValue("pd");
    expect(screen.queryByRole("option", { name: /yours/ })).not.toBeInTheDocument();
  });
});
