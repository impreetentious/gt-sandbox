import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RepeatedGameExperience } from "@/components/repeat/repeated-experience";

afterEach(cleanup);

describe("repeated-game experience", () => {
  it("shows the exact PD discount threshold and a sustainability verdict", () => {
    render(<RepeatedGameExperience />);
    expect(
      screen.getByText(/continuation probability is at least 1\/2/),
    ).toBeInTheDocument();
    // Default δ = 0.95 ≥ 1/2, so cooperation is sustainable.
    expect(screen.getByText(/At your chosen/)).toHaveTextContent("sustainable");
  });

  it("discloses that competitive Matching Pennies cannot sustain cooperation", () => {
    render(<RepeatedGameExperience />);
    fireEvent.change(screen.getByLabelText("Stage game"), {
      target: { value: "pennies" },
    });
    expect(
      screen.getByText(/Cooperation cannot be sustained here/),
    ).toBeInTheDocument();
    expect(screen.getByText(/not individually rational/)).toBeInTheDocument();
  });

  it("runs a seeded match and reports a mutual-cooperation rate", () => {
    render(<RepeatedGameExperience />);
    // Default TFT vs TFT on the PD cooperates every round.
    expect(
      screen.getByText("Mutual cooperation").nextSibling,
    ).toHaveTextContent("100%");
  });
});
