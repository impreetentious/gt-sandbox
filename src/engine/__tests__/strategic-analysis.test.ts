import { describe, expect, it } from "vitest";
import { catalog } from "@/engine/catalog";
import { createNormalFormGame, profileKey } from "@/engine/game";
import { classifyTwoByTwo } from "@/engine/solve/classify";
import {
  analyzeDominance,
  dominanceRelations,
  eliminateDominatedStrategies,
} from "@/engine/solve/dominance";
import {
  paretoDominates,
  paretoEfficientProfiles,
  strictlyParetoDominates,
} from "@/engine/solve/pareto";
import { bestResponses, isBestResponse } from "@/engine/solve/pure";
import { analyzeEquilibriumSelection } from "@/engine/solve/riskDominance";

function keys(profiles: readonly { row: number; column: number }[]): string[] {
  return profiles.map(profileKey);
}

function dominatedByPlayer(
  relations: readonly { player: "row" | "column"; dominated: number }[],
) {
  return {
    row: relations
      .filter((relation) => relation.player === "row")
      .map((relation) => relation.dominated)
      .sort(),
    column: relations
      .filter((relation) => relation.player === "column")
      .map((relation) => relation.dominated)
      .sort(),
  };
}

describe("P1 strategic-analysis catalog oracles", () => {
  for (const entry of catalog) {
    it(`${entry.game.title}: dominance, Pareto, equilibrium selection, and structure`, () => {
      const dominance = analyzeDominance(entry.game);
      const selection = analyzeEquilibriumSelection(entry.game);

      expect(dominatedByPlayer(dominance.strict)).toEqual(
        entry.oracle.strictlyDominated,
      );
      expect(keys(paretoEfficientProfiles(entry.game))).toEqual(
        keys(entry.oracle.paretoEfficient),
      );
      expect(classifyTwoByTwo(entry.game)).toBe(entry.oracle.classification);
      expect(selection.riskDominance).toEqual(entry.oracle.riskDominance);
      expect(selection.payoffDominance).toEqual(entry.oracle.payoffDominance);
    });
  }

  it("records the Prisoner's Dilemma strict-elimination sequence", () => {
    const trace = eliminateDominatedStrategies(catalog[0].game, "strict");

    expect(
      trace.steps.map(({ player, dominated, dominator }) => ({
        player,
        dominated,
        dominator,
      })),
    ).toEqual([
      { player: "row", dominated: 0, dominator: 1 },
      { player: "column", dominated: 0, dominator: 1 },
    ]);
    expect(trace.remaining).toEqual({ row: [1], column: [1] });
  });

  it("keeps weak dominance distinct from strict dominance", () => {
    const game = createNormalFormGame({
      id: "weak",
      title: "Weak dominance",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [1, 1],
          [1, 1],
        ],
        [
          [1, 1],
          [0, 0],
        ],
      ],
    });

    expect(dominanceRelations(game, "strict")).toEqual([]);
    expect(dominatedByPlayer(dominanceRelations(game, "weak"))).toEqual({
      row: [1],
      column: [1],
    });
    expect(eliminateDominatedStrategies(game, "weak").steps).toHaveLength(1);
  });

  it("exposes exact best responses and Pareto comparisons", () => {
    const pd = catalog[0].game;

    expect(bestResponses(pd, "row", 0)).toEqual([1]);
    expect(bestResponses(catalog[4].game, "row", 0)).toEqual([0]);
    expect(bestResponses(catalog[4].game, "row", 1)).toEqual([1]);
    expect(isBestResponse(pd, "row", 1, 0)).toBe(true);
    expect(isBestResponse(pd, "row", 0, 0)).toBe(false);
    expect(
      paretoDominates(pd, { row: 1, column: 1 }, { row: 0, column: 0 }),
    ).toBe(true);
    expect(
      strictlyParetoDominates(pd, { row: 1, column: 1 }, { row: 0, column: 0 }),
    ).toBe(true);
    expect(
      strictlyParetoDominates(pd, { row: 0, column: 1 }, { row: 0, column: 0 }),
    ).toBe(false);
  });
});

describe("2×2 classifier table", () => {
  it("covers the dominance and degenerate boundaries", () => {
    const dominance = createNormalFormGame({
      id: "dominance",
      title: "Dominance",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [2, 2],
          [2, 0],
        ],
        [
          [0, 2],
          [0, 0],
        ],
      ],
    });
    const tie = createNormalFormGame({
      id: "tie",
      title: "Tie",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [1, 1],
          [1, 0],
        ],
        [
          [1, 0],
          [0, 1],
        ],
      ],
    });
    const columnTie = createNormalFormGame({
      id: "column-tie",
      title: "Column tie",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [2, 1],
          [0, 1],
        ],
        [
          [0, 0],
          [1, 2],
        ],
      ],
    });
    const equilibriumPayoffTie = createNormalFormGame({
      id: "equilibrium-payoff-tie",
      title: "Equilibrium payoff tie",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [1, 1],
          [0, 0],
        ],
        [
          [0, 0],
          [1, 2],
        ],
      ],
    });

    expect(classifyTwoByTwo(dominance)).toBe("dominance");
    expect(classifyTwoByTwo(tie)).toBe("degenerate");
    expect(classifyTwoByTwo(columnTie)).toBe("degenerate");
    expect(classifyTwoByTwo(equilibriumPayoffTie)).toBe("degenerate");
    expect(bestResponses(columnTie, "column", 0)).toEqual([0, 1]);
    expect(() =>
      classifyTwoByTwo(
        createNormalFormGame({
          id: "three-by-two",
          title: "Three by two",
          rowActions: ["A", "B", "C"],
          columnActions: ["X", "Y"],
          payoffs: [
            [
              [1, 1],
              [0, 0],
            ],
            [
              [0, 0],
              [1, 1],
            ],
            [
              [0, 0],
              [0, 0],
            ],
          ],
        }),
      ),
    ).toThrow(RangeError);
  });
});

describe("equilibrium selection", () => {
  it("separates payoff dominance from risk dominance", () => {
    const reversedStag = createNormalFormGame({
      id: "reversed-stag",
      title: "Reversed Stag",
      rowActions: ["Low", "High"],
      columnActions: ["Low", "High"],
      payoffs: [
        [
          [4, 4],
          [4, 0],
        ],
        [
          [0, 4],
          [5, 5],
        ],
      ],
    });

    const selection = analyzeEquilibriumSelection(reversedStag);
    expect(selection.payoffDominance).toEqual({
      kind: "equilibrium",
      profile: { row: 1, column: 1 },
    });
    expect(selection.riskDominance).toEqual({
      kind: "equilibrium",
      profile: { row: 0, column: 0 },
    });
  });
});
