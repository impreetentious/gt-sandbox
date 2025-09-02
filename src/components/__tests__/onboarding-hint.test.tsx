import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OnboardingHint } from "@/components/onboarding-hint";

describe("first-visit onboarding hint", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("stores only the dismissal flag and stays hidden on the next render", async () => {
    const first = render(<OnboardingHint />);
    const dismiss = await screen.findByRole("button", { name: "Got it" });
    fireEvent.click(dismiss);

    expect(window.localStorage.getItem("seenOnboarding")).toBe("1");
    expect(
      screen.queryByRole("heading", {
        name: "Choose first. Open Analysis second.",
      }),
    ).not.toBeInTheDocument();

    first.unmount();
    render(<OnboardingHint />);
    expect(
      screen.queryByRole("heading", {
        name: "Choose first. Open Analysis second.",
      }),
    ).not.toBeInTheDocument();
  });
});
