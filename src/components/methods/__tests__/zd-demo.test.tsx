import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ZeroDeterminantDemo } from "@/components/methods/zd-demo";

function setChi(value: number) {
  fireEvent.change(screen.getByRole("slider", { name: /Factor/ }), {
    target: { value: String(value) },
  });
}

function rowValues(testId: string): string[] {
  return Array.from(
    screen.getByTestId(testId).querySelectorAll("tbody td"),
  ).map((cell) => cell.textContent ?? "");
}

describe("zero-determinant demo", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens on extortion at χ = 2", () => {
    render(<ZeroDeterminantDemo />);

    expect(screen.getByLabelText("Family")).toHaveValue("extortionate");
    expect(screen.getByRole("slider", { name: /Factor/ })).toHaveValue("20");
  });

  it("recovers Tit for Tat exactly at χ = 1, in both families", () => {
    render(<ZeroDeterminantDemo />);

    setChi(10);
    expect(rowValues("zd-strategy")).toEqual(["1", "0", "1", "0"]);
    expect(screen.getByTestId("zd-tft")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Family"), {
      target: { value: "generous" },
    });
    expect(rowValues("zd-strategy")).toEqual(["1", "0", "1", "0"]);
    expect(screen.getByTestId("zd-tft")).toBeInTheDocument();
  });

  it("stops calling it Tit for Tat as soon as χ leaves 1", () => {
    render(<ZeroDeterminantDemo />);

    setChi(11);
    expect(screen.queryByTestId("zd-tft")).not.toBeInTheDocument();
  });

  it("always defects after mutual defection under extortion", () => {
    render(<ZeroDeterminantDemo />);

    for (const chi of [20, 35, 60]) {
      setChi(chi);
      expect(rowValues("zd-strategy")[3]).toBe("0");
    }
  });

  it("never defects after mutual cooperation under generosity", () => {
    render(<ZeroDeterminantDemo />);
    fireEvent.change(screen.getByLabelText("Family"), {
      target: { value: "generous" },
    });

    for (const chi of [20, 35, 60]) {
      setChi(chi);
      expect(rowValues("zd-strategy")[0]).toBe("1");
    }
  });

  it("shows the enforced relation holding exactly against a fixed opponent", () => {
    render(<ZeroDeterminantDemo />);

    // The residual is computed from a directly solved stationary distribution,
    // so an exact 0 is a check on the construction rather than a restatement.
    for (const chi of [10, 20, 33, 60]) {
      setChi(chi);
      expect(screen.getByTestId("zd-residual")).toHaveTextContent(/^0$/);
    }
  });

  it("keeps the payoffs as exact fractions", () => {
    render(<ZeroDeterminantDemo />);
    setChi(37);

    // Nothing here should have been rounded into a decimal.
    const outcome = screen.getByTestId("zd-outcome");
    expect(outcome.textContent).not.toMatch(/\d\.\d/);
    expect(outcome.textContent).toMatch(/\d+\/\d+/);
  });

  it("gives the extortioner the larger share of the surplus", () => {
    render(<ZeroDeterminantDemo />);
    setChi(30);

    const [own, theirs] = rowValues("zd-outcome");
    const value = (fraction: string) => {
      const [n, d] = fraction.split("/");
      return Number(n) / Number(d ?? 1);
    };
    expect(value(own)).toBeGreaterThan(value(theirs));
  });

  it("states plainly that Always Defect is not a ZD strategy", () => {
    render(<ZeroDeterminantDemo />);

    fireEvent.click(screen.getByText("What Always Defect is not"));
    expect(screen.getByTestId("zd-alld")).toHaveTextContent(/inconsistent/);
  });
});
