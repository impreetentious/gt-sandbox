import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExtensivePlayExperience } from "@/components/arena/extensive-play";

describe("extensive-form play surface — entry deterrence", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the entry-deterrence tree and the initial narration", () => {
    render(<ExtensivePlayExperience slug="entry-deterrence" />);
    expect(
      screen.getByRole("heading", { name: "Entry Deterrence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Choose to enter the market or stay out\./),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-entrant-move")).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-incumbent-move")).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-accommodate")).toBeInTheDocument();
  });

  it("plays In against the rational incumbent and lands on (1, 1)", () => {
    render(<ExtensivePlayExperience slug="entry-deterrence" />);
    fireEvent.click(screen.getByRole("button", { name: "In" }));
    expect(
      screen.getByText(/Outcome: Entrant 1, Incumbent 1/),
    ).toBeInTheDocument();
    // On completion the action buttons are removed; only Play again remains.
    expect(screen.queryByRole("button", { name: "In" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play again" }),
    ).toBeInTheDocument();
  });

  it("switching to the committed incumbent turns In into a mutual loss", () => {
    render(<ExtensivePlayExperience slug="entry-deterrence" />);
    fireEvent.click(screen.getByRole("radio", { name: /Committed Incumbent/ }));
    fireEvent.click(screen.getByRole("button", { name: "In" }));
    expect(
      screen.getByText(/Outcome: Entrant -1, Incumbent -1/),
    ).toBeInTheDocument();
  });

  it("play again resets the session and restores the action buttons", () => {
    render(<ExtensivePlayExperience slug="entry-deterrence" />);
    fireEvent.click(screen.getByRole("button", { name: "In" }));
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(
      screen.getByText(/Choose to enter the market or stay out\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Out" })).toBeInTheDocument();
  });

  it("changing the rival policy resets the current play", () => {
    render(<ExtensivePlayExperience slug="entry-deterrence" />);
    fireEvent.click(screen.getByRole("button", { name: "In" }));
    fireEvent.click(screen.getByRole("radio", { name: /Committed Incumbent/ }));
    expect(
      screen.getByText(/Choose to enter the market or stay out\./),
    ).toBeInTheDocument();
  });

  it("Out ends the session at the stay-out terminal (0, 2)", () => {
    render(<ExtensivePlayExperience slug="entry-deterrence" />);
    fireEvent.click(screen.getByRole("button", { name: "Out" }));
    expect(
      screen.getByText(/Outcome: Entrant 0, Incumbent 2/),
    ).toBeInTheDocument();
  });
});
