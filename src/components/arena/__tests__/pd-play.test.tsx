import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdPlayExperience } from "@/components/arena/pd-play";

function commitOutcome(): void {
  act(() => {
    vi.advanceTimersByTime(150);
  });
}

describe("Prisoner's Dilemma arena and P4 reveal", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("uses a staged outcome, progressive reveal, and a live round narration", () => {
    vi.useFakeTimers();
    render(<PdPlayExperience />);

    const holdPrice = screen.getByRole("button", {
      name: "Hold price (key 1)",
    });
    holdPrice.focus();
    fireEvent.click(holdPrice);

    expect(holdPrice).toBeDisabled();
    expect(screen.getByText("Copycat is deciding…")).toBeVisible();

    commitOutcome();

    expect(document.activeElement).toBe(holdPrice);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Round 1: you held price; Copycat held price.",
    );
    expect(screen.getByTestId("matrix-cell-0-0")).toHaveAttribute(
      "data-highlight",
      "current",
    );

    fireEvent.click(screen.getByText("Analysis / Price war"));
    expect(
      screen.getByText(
        "Full analysis unlocks after round 3, once there is a small pattern to inspect.",
      ),
    ).toBeVisible();

    fireEvent.click(holdPrice);
    commitOutcome();
    fireEvent.click(holdPrice);
    commitOutcome();

    expect(
      screen.getByRole("heading", { name: "best response map" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Show elimination 1 of 2" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Show elimination 1 of 2" }),
    );
    expect(
      screen.getByText("Step 1: You: Undercut eliminates Hold price."),
    ).toBeVisible();
    fireEvent.click(
      screen.getByLabelText("Dim dominated outcomes in the matrix"),
    );
    expect(screen.getByTestId("matrix-cell-1-1")).toHaveAttribute(
      "data-pareto",
      "dominated",
    );
  });

  it("moves focus to replay at the end, then back to the first choice", () => {
    vi.useFakeTimers();
    render(<PdPlayExperience />);

    const holdPrice = screen.getByRole("button", {
      name: "Hold price (key 1)",
    });

    for (let round = 0; round < 10; round += 1) {
      fireEvent.click(holdPrice);
      commitOutcome();
    }

    const playAgain = screen.getByRole("button", { name: "Play again" });
    expect(document.activeElement).toBe(playAgain);

    fireEvent.click(playAgain);
    expect(document.activeElement).toBe(holdPrice);
  });
});
