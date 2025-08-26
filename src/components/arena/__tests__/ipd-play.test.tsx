import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IpdPlayExperience } from "@/components/arena/ipd-play";

function commitOutcome(): void {
  act(() => {
    vi.advanceTimersByTime(150);
  });
}

describe("P6 interactive IPD arena", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("plays against TFT through realized history", () => {
    vi.useFakeTimers();
    render(<IpdPlayExperience />);
    const defect = screen.getByRole("button", { name: "Defect (key 2)" });
    const cooperate = screen.getByRole("button", { name: "Cooperate (key 1)" });

    fireEvent.click(defect);
    commitOutcome();
    expect(screen.getByTestId("ipd-matrix-cell-1-0")).toHaveAttribute(
      "data-highlight",
      "current",
    );

    fireEvent.click(cooperate);
    commitOutcome();
    expect(screen.getByTestId("ipd-matrix-cell-0-1")).toHaveAttribute(
      "data-highlight",
      "current",
    );
  });

  it("keeps a mystery rival hidden until the reveal and gives a seeded TFT counterfactual", () => {
    vi.useFakeTimers();
    render(<IpdPlayExperience />);
    fireEvent.change(screen.getByLabelText("Choose IPD rival"), {
      target: { value: "mystery" },
    });
    expect(
      screen.getByText(
        "Identity stays hidden until the reveal. The seeded environment is already fixed.",
      ),
    ).toBeVisible();

    const cooperate = screen.getByRole("button", { name: "Cooperate (key 1)" });
    for (let round = 0; round < 100; round += 1) {
      fireEvent.click(cooperate);
      commitOutcome();

      if (screen.queryByRole("button", { name: "Play again" })) {
        break;
      }
    }

    expect(screen.getByRole("button", { name: "Play again" })).toBeVisible();
    expect(
      screen.getByText(/Tit for Tat in your seat would have scored/),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Always Defect" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/Always Defect state diagram/)).toBeVisible();
  });
});
