import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HotSeatPlayExperience } from "@/components/arena/hot-seat-play";

afterEach(cleanup);

function commitRow(action: 0 | 1): void {
  fireEvent.click(
    screen.getByRole("button", {
      name: `Player 1: ${action === 0 ? "Hold price" : "Undercut"} (key ${action + 1})`,
    }),
  );
}

describe("hot-seat play experience", () => {
  it("conceals Player 1's move during the handover", () => {
    render(<HotSeatPlayExperience slug="pd" />);
    commitRow(1);

    const handover = screen.getByTestId("hot-seat-handover");
    // The concealment screen must not surface the locked choice anywhere.
    expect(handover.textContent).not.toContain("Undercut");
    expect(screen.queryByTestId("hot-seat-column-turn")).toBeNull();
  });

  it("reveals the outcome only after both players commit", () => {
    render(<HotSeatPlayExperience slug="pd" />);
    commitRow(1);
    fireEvent.click(screen.getByRole("button", { name: "Player 2 is ready" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Player 2: Hold price (key 1)" }),
    );

    const reveal = screen.getByTestId("hot-seat-reveal");
    expect(within(reveal).getByText(/Player 1 chose/)).toBeInTheDocument();
    expect(reveal.textContent).toContain("Undercut");
    expect(reveal.textContent).toContain("Hold price");
  });

  it("lets the analysis measure either player's perspective", () => {
    render(<HotSeatPlayExperience slug="pd" />);
    // Play three rounds to unlock the full analysis panels.
    for (let round = 0; round < 3; round += 1) {
      commitRow(1);
      fireEvent.click(
        screen.getByRole("button", { name: "Player 2 is ready" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Player 2: Undercut (key 2)" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Next round|See the analysis/ }),
      );
    }

    fireEvent.click(screen.getByText("Analysis / Prisoner's Dilemma"));
    const player2 = screen.getByRole("button", { name: "Player 2" });
    fireEvent.click(player2);
    expect(player2).toHaveAttribute("aria-pressed", "true");
  });
});
