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

describe("V2-P7 mixture-only dominance in the drawer", () => {
  afterEach(() => {
    cleanup();
  });

  const mixtureOnly = createNormalFormGame({
    id: "mixture-only",
    title: "Mixture-only dominance",
    rowActions: ["Push", "Hold", "Steady"],
    columnActions: ["Match", "Undercut", "Wait"],
    payoffs: [
      [
        [6, 1],
        [0, 4],
        [3, 2],
      ],
      [
        [0, 4],
        [6, 1],
        [3, 2],
      ],
      [
        [2, 3],
        [2, 3],
        [2, 3],
      ],
    ],
  });

  const drawerFor = (game: ReturnType<typeof createNormalFormGame>) => (
    <AnalysisDrawer
      defaultOpen
      game={game}
      onParetoModeChange={() => undefined}
      opponentName="Rival"
      paretoMode={false}
      playerName="You"
      profiles={[]}
      showAllPanels
      title={game.title}
    />
  );

  it("names the mixture and its exact margin where pure elimination finds nothing", () => {
    render(drawerFor(mixtureOnly));

    expect(
      screen.getByText(
        /No strict-dominance elimination applies to this game\./,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        /is beaten by mixing Push 1\/2 and Hold 1\/2, which earns at least 1 more against every opposing action\./,
      ),
    ).toBeVisible();
  });

  it("stays silent on a 2×2 game, where mixing provably adds nothing", () => {
    const pd = createNormalFormGame({
      id: "pd",
      title: "Prisoner's Dilemma",
      rowActions: ["Cooperate", "Defect"],
      columnActions: ["Cooperate", "Defect"],
      payoffs: [
        [
          [3, 3],
          [0, 5],
        ],
        [
          [5, 0],
          [1, 1],
        ],
      ],
    });

    render(drawerFor(pd));

    expect(screen.queryByText(/is beaten by mixing/)).toBeNull();
  });
});
