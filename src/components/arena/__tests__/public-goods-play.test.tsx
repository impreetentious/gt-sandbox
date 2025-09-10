import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PublicGoodsExperience } from "@/components/arena/public-goods-play";

function setSlider(name: RegExp, value: number) {
  fireEvent.change(screen.getByRole("slider", { name }), {
    target: { value: String(value) },
  });
}

describe("public-goods surface", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens on the canonical 4-player, MPCR 2/5 configuration", () => {
    render(<PublicGoodsExperience />);
    expect(
      screen.getByRole("heading", {
        name: "Everyone gains if everyone gives. Nobody gains by giving.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Players/ })).toHaveValue("4");
    expect(
      screen.getByText(/Pick a number of tokens to contribute/),
    ).toBeInTheDocument();
  });

  it("contributing 0 against half contributors pays the exact free-ride payoff", () => {
    render(<PublicGoodsExperience />);
    // Default: N=4, MPCR=8/20=2/5, others contribute 5 each → pot 15.
    // π = (10 − 0) + (2/5)(15) = 10 + 6 = 16.
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    const narration = screen.getByTestId("pg-narration");
    expect(narration).toHaveTextContent(/the pot held 15/);
    expect(narration).toHaveTextContent(/You earned 16\./);
    // Contributors keep 5 and take (2/5)(15) = 6 → 11 each.
    expect(narration).toHaveTextContent(/Each other player earned 11\./);
  });

  it("contributing everything pays strictly less than free-riding", () => {
    render(<PublicGoodsExperience />);
    // Own 10, others 5×3 = 15 → pot 25. π = 0 + (2/5)(25) = 10.
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    const narration = screen.getByTestId("pg-narration");
    expect(narration).toHaveTextContent(/the pot held 25/);
    expect(narration).toHaveTextContent(/You earned 10\./);
    const counterfactual = screen.getByTestId("pg-counterfactual");
    // The 0-token counterfactual pays 16 > 10, so it must read "more".
    expect(counterfactual).toHaveTextContent(/Had you contributed 0 instead/);
    expect(counterfactual).toHaveTextContent(/more than you did/);
  });

  it("changing the group size resets the round", () => {
    render(<PublicGoodsExperience />);
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    setSlider(/Players/, 8);
    expect(
      screen.getByText(/Pick a number of tokens to contribute/),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Players/ })).toHaveValue("8");
  });

  it("switching to free riders empties the pot when you also free-ride", () => {
    render(<PublicGoodsExperience />);
    fireEvent.click(screen.getByRole("radio", { name: /Free riders/ }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    expect(screen.getByText(/the pot held 0/)).toBeInTheDocument();
  });

  it("play again clears the outcome", () => {
    render(<PublicGoodsExperience />);
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(
      screen.getByText(/Pick a number of tokens to contribute/),
    ).toBeInTheDocument();
  });
});

describe("public-goods analysis panel", () => {
  afterEach(() => {
    cleanup();
  });

  it("reports the dilemma window and the exact marginal returns", () => {
    render(<PublicGoodsExperience />);
    fireEvent.click(screen.getByText("Analysis / Public goods"));
    // MPCR 2/5, N=4 → private −3/5, social 3/5.
    expect(screen.getByText(/MPCR − 1 = -3\/5/)).toBeInTheDocument();
    expect(screen.getByText(/MPCR × N − 1 = 3\/5/)).toBeInTheDocument();
    expect(
      screen.getByText(/sits inside the dilemma window/),
    ).toBeInTheDocument();
  });

  it("drops the dilemma verdict when the MPCR leaves the window", () => {
    render(<PublicGoodsExperience />);
    // 20/20 = MPCR 1 → contributing is break-even, no dominance.
    setSlider(/Marginal per capita return/, 20);
    fireEvent.click(screen.getByText("Analysis / Public goods"));
    expect(
      screen.getByText(/sits outside the dilemma window/),
    ).toBeInTheDocument();
    expect(screen.getByText(/indifferent/)).toBeInTheDocument();
  });

  it("reveals the token-by-token sweep on demand", () => {
    render(<PublicGoodsExperience />);
    fireEvent.click(screen.getByText("Analysis / Public goods"));
    fireEvent.click(
      screen.getByRole("button", { name: "Show the exact sweep" }),
    );
    expect(
      screen.getByRole("table", {
        name: /Your payoff and total welfare at every contribution/,
      }),
    ).toBeInTheDocument();
  });
});
