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

describe("P2 Prisoner's Dilemma arena", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("uses a staged outcome, engine-derived reveal, and a live round narration", () => {
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
        "The engine finds that undercutting strictly dominates holding price for both firms.",
      ),
    ).toBeVisible();
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
