import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpatialExperience } from "@/components/evolve/spatial-experience";

function setSlider(name: RegExp, value: number) {
  fireEvent.change(screen.getByRole("slider", { name }), {
    target: { value: String(value) },
  });
}

function selectOption(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("spatial evolution surface", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens on the coexistence scenario at generation 0", () => {
    render(<SpatialExperience />);

    expect(
      screen.getByRole("heading", {
        name: "Cooperation survives because it can cluster.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toHaveValue("coexistence");
    expect(screen.getByRole("slider", { name: /Temptation/ })).toHaveValue(
      "16",
    );
    // One defector in a 21 × 21 field.
    expect(screen.getByTestId("spatial-share")).toHaveTextContent("440/441");
  });

  it("steps forward and back through the run", () => {
    render(<SpatialExperience />);

    fireEvent.click(screen.getByRole("button", { name: "Step forward" }));
    expect(
      screen.getByRole("heading", { name: "Generation 1" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("spatial-share")).toHaveTextContent("48/49");

    fireEvent.click(screen.getByRole("button", { name: "Step back" }));
    expect(screen.getByTestId("spatial-share")).toHaveTextContent("440/441");
  });

  it("disables the transport at both ends instead of wrapping", () => {
    render(<SpatialExperience />);

    expect(screen.getByRole("button", { name: "Step back" })).toBeDisabled();

    setSlider(/Generation/, 40);
    expect(screen.getByRole("button", { name: "Step forward" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Step back" })).toBeEnabled();
  });

  it("scrubs to an arbitrary generation with the keyboard-operable slider", () => {
    render(<SpatialExperience />);

    setSlider(/Generation/, 20);
    expect(
      screen.getByRole("heading", { name: "Generation 20" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("spatial-share")).toHaveTextContent("260/441");
  });

  it("reports that the coexistence run never settles", () => {
    render(<SpatialExperience />);

    expect(screen.getByTestId("spatial-termination")).toHaveTextContent(
      /Still moving after 40 generations/,
    );
  });

  it("reports the fixed point and its generation on the recovery preset", () => {
    render(<SpatialExperience />);
    selectOption("Scenario", "recovery");

    expect(screen.getByTestId("spatial-termination")).toHaveTextContent(
      "The lattice stopped changing at generation 10.",
    );
    // The preset carries a whole configuration, not just the payoff.
    expect(screen.getByLabelText("Opening")).toHaveValue("seeded");
    expect(screen.getByRole("slider", { name: /Temptation/ })).toHaveValue(
      "12",
    );
  });

  it("shows the collapse preset reaching zero cooperators", () => {
    render(<SpatialExperience />);
    selectOption("Scenario", "collapse");
    setSlider(/Generation/, 26);

    expect(screen.getByTestId("spatial-share")).toHaveTextContent("0");
  });

  it("resets to generation 0 when the model changes underneath", () => {
    render(<SpatialExperience />);

    setSlider(/Generation/, 15);
    expect(
      screen.getByRole("heading", { name: "Generation 15" }),
    ).toBeInTheDocument();

    // A different neighbourhood is a different run; holding the old generation
    // index would silently show a frame from a lattice that no longer exists.
    selectOption("Neighbourhood", "von-neumann");
    expect(
      screen.getByRole("heading", { name: "Generation 0" }),
    ).toBeInTheDocument();
  });

  it("draws one cell per lattice site and rewires on a size change", () => {
    const { container } = render(<SpatialExperience />);

    expect(container.querySelectorAll(".spatial__cell")).toHaveLength(441);
    setSlider(/Lattice/, 9);
    expect(container.querySelectorAll(".spatial__cell")).toHaveLength(81);
  });

  it("offers the run as a data table in a focusable scroll container", () => {
    const { container } = render(<SpatialExperience />);

    fireEvent.click(
      screen.getByText("View the run as an accessible data table"),
    );
    expect(
      screen.getByRole("table", {
        name: /Exact cooperator share at every generation/,
      }),
    ).toBeInTheDocument();
    // axe's scrollable-region-focusable: the container must take focus.
    expect(container.querySelector(".spatial__table-scroll")).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
