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
    expect(
      screen.queryByRole("button", { name: "In" }),
    ).not.toBeInTheDocument();
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

  it("play again resets the session and re-enables the buttons", () => {
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

describe("extensive-form play surface — ultimatum", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the proposer prompt and the eleven offer buttons", () => {
    render(<ExtensivePlayExperience slug="ultimatum" />);
    expect(
      screen.getByRole("heading", { name: "Ultimatum" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Offer any integer share from 0 to 10/),
    ).toBeInTheDocument();
    for (let offer = 0; offer <= 10; offer += 1) {
      expect(
        screen.getByRole("button", { name: String(offer) }),
      ).toBeInTheDocument();
    }
  });

  it("offering 1 to the payoff-maximising responder yields (9, 1)", () => {
    render(<ExtensivePlayExperience slug="ultimatum" />);
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    expect(
      screen.getByText(/Outcome: Proposer 9, Responder 1/),
    ).toBeInTheDocument();
  });

  it("offering 0 against the payoff-maximising responder is rejected at (0, 0)", () => {
    render(<ExtensivePlayExperience slug="ultimatum" />);
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    expect(
      screen.getByText(/Outcome: Proposer 0, Responder 0/),
    ).toBeInTheDocument();
  });

  it("offering 4 to the fair-share responder is rejected", () => {
    render(<ExtensivePlayExperience slug="ultimatum" />);
    fireEvent.click(
      screen.getByRole("radio", { name: /Fair-Share Responder/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(
      screen.getByText(/Outcome: Proposer 0, Responder 0/),
    ).toBeInTheDocument();
  });
});

describe("extensive-form play surface — centipede", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the initial take-or-pass prompt and both actions", () => {
    render(<ExtensivePlayExperience slug="centipede" />);
    expect(
      screen.getByRole("heading", { name: "Centipede" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Take now to end the game with \(1, 1\)/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument();
  });

  it("Take at node-1 ends the game with (1, 1)", () => {
    render(<ExtensivePlayExperience slug="centipede" />);
    fireEvent.click(screen.getByRole("button", { name: "Take" }));
    expect(
      screen.getByText(/Outcome: Player 1 1, Player 2 1/),
    ).toBeInTheDocument();
  });

  it("passing against the SPNE-taker gives Player 2 the Take at node-2 for (0, 3)", () => {
    render(<ExtensivePlayExperience slug="centipede" />);
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(
      screen.getByText(/Outcome: Player 1 0, Player 2 3/),
    ).toBeInTheDocument();
  });

  it("passing repeatedly against the always-pass rival reaches the (4, 4) long game", () => {
    render(<ExtensivePlayExperience slug="centipede" />);
    fireEvent.click(
      screen.getByRole("radio", { name: /Always-Pass Player 2/ }),
    );
    // Node 1 (user) Pass → Node 2 (rival, always Pass) → Node 3 (user) Pass →
    // Node 4 (rival, always Pass) → term-pass-4 with payoffs (4, 4).
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(
      screen.getByText(/Outcome: Player 1 4, Player 2 4/),
    ).toBeInTheDocument();
  });
});
