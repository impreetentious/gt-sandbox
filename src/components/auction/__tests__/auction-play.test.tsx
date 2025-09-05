import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuctionPlayExperience } from "@/components/auction/auction-play";

afterEach(cleanup);

describe("auction play experience", () => {
  it("proves second-price truthfulness in the reveal", () => {
    render(<AuctionPlayExperience format="second-price" />);
    expect(
      screen.getByText(/Why truthful bidding is dominant/),
    ).toBeInTheDocument();
    expect(screen.getByText(/weakly dominant/)).toBeInTheDocument();
  });

  it("plays a bidding round and reveals the outcome", () => {
    render(<AuctionPlayExperience format="second-price" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit bid" }));
    expect(screen.getByTestId("auction-result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next round|Finish/ }));
    // A second observation is drawn for the next round.
    expect(screen.getByTestId("auction-observation")).toBeInTheDocument();
  });

  it("shows the winner's-curse table for the common-value format", () => {
    render(<AuctionPlayExperience format="common-value" />);
    expect(screen.getAllByText(/winner's curse/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Bidding your own signal loses money/),
    ).toBeInTheDocument();
  });

  it("surfaces the shading benchmark for the first-price format", () => {
    render(<AuctionPlayExperience format="first-price" />);
    expect(screen.getByText(/Why shade your bid/)).toBeInTheDocument();
  });
});
