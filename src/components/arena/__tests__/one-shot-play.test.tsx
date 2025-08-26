import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OneShotPlayExperience } from "@/components/arena/one-shot-play";

function commitOutcome(): void {
  act(() => {
    vi.advanceTimersByTime(150);
  });
}

describe("P5 one-shot play arenas", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("surfaces Stag Hunt selection analysis from the engine", () => {
    vi.useFakeTimers();
    render(<OneShotPlayExperience slug="stag" />);
    const stag = screen.getByRole("button", { name: "Stag (key 1)" });

    for (let round = 0; round < 3; round += 1) {
      fireEvent.click(stag);
      commitOutcome();
    }

    fireEvent.click(screen.getByText("Analysis / Stag Hunt"));
    expect(
      screen.getByRole("button", { name: "risk dominant" }).closest("p"),
    ).toHaveTextContent("risk dominant outcome: (Hare, Hare).");
    expect(
      screen.getByText("Payoff-dominant outcome: (Stag, Stag)."),
    ).toBeVisible();
  });

  it("exposes Shark prediction accuracy against a biased scripted input", () => {
    vi.useFakeTimers();
    render(<OneShotPlayExperience slug="pennies" />);
    fireEvent.change(screen.getByLabelText("Choose rival"), {
      target: { value: "markov2" },
    });
    const heads = screen.getByRole("button", { name: "Heads (key 1)" });

    for (let round = 0; round < 8; round += 1) {
      fireEvent.click(heads);
      commitOutcome();
    }

    expect(screen.getByTestId("shark-prediction-accuracy")).toHaveTextContent(
      "Shark prediction accuracy: 63%.",
    );
    expect(screen.getByText(/You are leaking a pattern\./)).toBeVisible();
  });
});
