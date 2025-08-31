import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameWorkbench } from "@/components/build/game-workbench";
import { pd } from "@/engine/catalog/pd";

describe("P9 custom-game workbench", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/build/");
  });

  it("turns the symmetric PD temptation payoff into an assurance game live", async () => {
    render(<GameWorkbench defaultGame={pd.game} />);

    expect(
      screen.getByRole("heading", { name: "This is a dilemma game." }),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Your payoff for row 2, column 1"), {
      target: { value: "2" },
    });
    fireEvent.change(
      screen.getByLabelText("Rival payoff for row 1, column 2"),
      { target: { value: "2" } },
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "This is a coordination (assurance) game.",
        }),
      ).toBeVisible(),
    );
    expect(within(screen.getByRole("table")).getAllByText("NE")).toHaveLength(
      2,
    );
    expect(window.location.search).toContain("v=1");
  });

  it("announces an invalid payoff and leaves focus on the offending input", async () => {
    render(<GameWorkbench defaultGame={pd.game} />);
    const input = screen.getByLabelText("Your payoff for row 1, column 1");
    input.focus();

    fireEvent.change(input, { target: { value: "1.1234567" } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "at most 6 decimal places",
      ),
    );
    expect(document.activeElement).toBe(input);
    expect(
      screen.getByRole("heading", { name: "This is a dilemma game." }),
    ).toBeVisible();
  });

  it("supports the bounded 4×4 editor and a manual-copy fallback", async () => {
    render(<GameWorkbench />);

    expect(screen.getByText(/Degeneracy detected/)).toBeVisible();

    fireEvent.change(screen.getByLabelText("Number of row actions"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Number of column actions"), {
      target: { value: "4" },
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Row action 4")).toBeVisible(),
    );
    expect(screen.getByLabelText("Column action 4")).toBeVisible();
    expect(
      screen.getByLabelText("Rival payoff for row 4, column 4"),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Copy reproducible link" }),
    );
    const fallback = await screen.findByLabelText(
      "Clipboard access is unavailable. Copy this link manually.",
    );
    expect(fallback).toHaveFocus();
    expect((fallback as HTMLInputElement).value).toContain("v=1");
  });

  it("confirms when the reproducible link reaches the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<GameWorkbench />);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy reproducible link" }),
    );

    expect(
      await screen.findByText(
        "Copied. The complete bounded state is in the link.",
      ),
    ).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("?v=1&"));

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
});
