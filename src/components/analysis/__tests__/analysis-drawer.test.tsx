import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import { createNormalFormGame } from "@/engine/game";

describe("F4 analysis drawer degenerate disclosure", () => {
  afterEach(() => {
    cleanup();
  });

  it("discloses degeneracy instead of asserting completeness on the all-zeros 2×2", () => {
    const degenerate = createNormalFormGame({
      id: "all-zeros-2x2",
      title: "All zeros",
      rowActions: ["A", "B"],
      columnActions: ["A", "B"],
      payoffs: [
        [
          [0, 0],
          [0, 0],
        ],
        [
          [0, 0],
          [0, 0],
        ],
      ],
    });

    render(
      <AnalysisDrawer
        defaultOpen
        game={degenerate}
        onParetoModeChange={() => undefined}
        opponentName="Rival"
        paretoMode={false}
        playerName="You"
        profiles={[]}
        showAllPanels
        title="All zeros"
      />,
    );

    expect(
      screen.queryByText(
        /No additional mixed equilibrium is needed beyond those pure outcomes\./,
      ),
    ).toBeNull();
    expect(
      screen.getByText(
        /Equal-size support enumeration found no further mixed sample here\./,
      ),
    ).toBeVisible();
  });
});
