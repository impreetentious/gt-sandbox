import { describe, expect, it } from "vitest";
import { createNormalFormGame } from "@/engine/game";
import { formatRational, ONE, rational, ZERO } from "@/engine/rational";
import {
  analyzeMixedEquilibria,
  degeneracyWitness,
  isDegenerate,
  mixedNashEquilibria,
  type MixedNashEquilibrium,
} from "@/engine/solve/mixed";
import { twoByTwoMixedEquilibrium } from "@/engine/solve/twoByTwo";
import { verifyMixedEquilibrium } from "@/engine/verify";

function matchingPennies() {
  return createNormalFormGame({
    id: "matching-pennies",
    title: "Matching Pennies",
    rowActions: ["Heads", "Tails"],
    columnActions: ["Heads", "Tails"],
    payoffs: [
      [
        [1, -1],
        [-1, 1],
      ],
      [
        [-1, 1],
        [1, -1],
      ],
    ],
  });
}

describe("exact mixed-equilibrium solver and verifier", () => {
  it("solves and independently verifies Matching Pennies", () => {
    const game = matchingPennies();
    const equilibrium = mixedNashEquilibria(game)[0];

    expect(equilibrium.row.probabilities.map(formatRational)).toEqual([
      "1/2",
      "1/2",
    ]);
    expect(equilibrium.column.probabilities.map(formatRational)).toEqual([
      "1/2",
      "1/2",
    ]);
    expect(verifyMixedEquilibrium(game, equilibrium).isNashEquilibrium).toBe(
      true,
    );
    expect(twoByTwoMixedEquilibrium(game)).toEqual(equilibrium);
    expect(analyzeMixedEquilibria(game)).toEqual({
      equilibria: [equilibrium],
      degeneracyWitness: null,
    });
  });

  it("finds formal degeneracy witnesses without treating raw payoff ties as the test", () => {
    const rowDegenerate = createNormalFormGame({
      id: "row-degenerate",
      title: "Row degenerate",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [0, 1],
          [0, 1],
        ],
        [
          [1, 0],
          [1, 0],
        ],
      ],
    });
    const columnDegenerate = createNormalFormGame({
      id: "column-degenerate",
      title: "Column degenerate",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
      payoffs: [
        [
          [1, 0],
          [0, 1],
        ],
        [
          [1, 0],
          [0, 1],
        ],
      ],
    });

    expect(degeneracyWitness(rowDegenerate)).toEqual({
      player: "row",
      S: [0],
      B: [0, 1],
      x: [ONE, ZERO],
    });
    expect(degeneracyWitness(columnDegenerate)).toEqual({
      player: "column",
      S: [0],
      B: [0, 1],
      x: [ONE, ZERO],
    });
    expect(isDegenerate(matchingPennies())).toBe(false);
  });

  it("rejects invalid strategies and profitable deviations", () => {
    const game = matchingPennies();
    const equilibrium = mixedNashEquilibria(game)[0];
    const invalidLength: MixedNashEquilibrium = {
      ...equilibrium,
      row: { probabilities: [ONE], support: [0] },
    };
    const invalidProbability: MixedNashEquilibrium = {
      ...equilibrium,
      row: { probabilities: [rational(-1n), rational(2n)], support: [0, 1] },
    };
    const profitableDeviation: MixedNashEquilibrium = {
      row: { probabilities: [ONE, ZERO], support: [0] },
      column: { probabilities: [ONE, ZERO], support: [0] },
      rowPayoff: rational(1n),
      columnPayoff: rational(-1n),
    };

    expect(verifyMixedEquilibrium(game, invalidLength).rowStrategyValid).toBe(
      false,
    );
    expect(
      verifyMixedEquilibrium(game, invalidProbability).rowStrategyValid,
    ).toBe(false);
    expect(
      verifyMixedEquilibrium(game, profitableDeviation).isNashEquilibrium,
    ).toBe(false);
  });

  it("rejects singular and out-of-range closed-form inputs", () => {
    const singular = createNormalFormGame({
      id: "singular",
      title: "Singular",
      rowActions: ["A", "B"],
      columnActions: ["X", "Y"],
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
    const threeByTwo = createNormalFormGame({
      id: "three-by-two",
      title: "Three by two",
      rowActions: ["A", "B", "C"],
      columnActions: ["X", "Y"],
      payoffs: Array.from({ length: 3 }, () => [
        [0, 0],
        [0, 0],
      ]),
    });
    const outOfRange = createNormalFormGame({
      id: "dominant-action",
      title: "Dominant action",
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

    expect(twoByTwoMixedEquilibrium(singular)).toBeNull();
    expect(twoByTwoMixedEquilibrium(outOfRange)).toBeNull();
    expect(() => twoByTwoMixedEquilibrium(threeByTwo)).toThrow(RangeError);
  });

  it("enforces the 4×4 bound and logs bounded enumeration timing", () => {
    const fiveByTwo = createNormalFormGame({
      id: "five-by-two",
      title: "Five by two",
      rowActions: ["A", "B", "C", "D", "E"],
      columnActions: ["X", "Y"],
      payoffs: Array.from({ length: 5 }, () => [
        [0, 0],
        [0, 0],
      ]),
    });
    const timingGame = createNormalFormGame({
      id: "timing-four-by-four",
      title: "Timing four by four",
      rowActions: ["A", "B", "C", "D"],
      columnActions: ["W", "X", "Y", "Z"],
      payoffs: Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, column) => [
          row * 7 + column * 3,
          row * 5 + column * 11,
        ]),
      ),
    });

    expect(() => mixedNashEquilibria(fiveByTwo)).toThrow(RangeError);

    const startedAt = performance.now();
    mixedNashEquilibria(timingGame);
    const elapsedMilliseconds = performance.now() - startedAt;
    console.info(
      `4×4 exact support enumeration: ${elapsedMilliseconds.toFixed(3)} ms`,
    );
    expect(elapsedMilliseconds).toBeLessThan(16);
  });
});
