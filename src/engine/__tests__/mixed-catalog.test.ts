import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { catalog } from "@/engine/catalog";
import { createNormalFormGame } from "@/engine/game";
import { formatRational, ONE, ZERO } from "@/engine/rational";
import {
  degeneracyWitness,
  isDegenerate,
  mixedNashEquilibria,
  type MixedNashEquilibrium,
} from "@/engine/solve/mixed";
import { twoByTwoMixedEquilibrium } from "@/engine/solve/twoByTwo";
import { verifyMixedEquilibrium } from "@/engine/verify";

function formatEquilibrium(equilibrium: MixedNashEquilibrium) {
  return {
    row: equilibrium.row.probabilities.map(formatRational),
    column: equilibrium.column.probabilities.map(formatRational),
  };
}

function nonPureEquilibria(game: (typeof catalog)[number]["game"]) {
  return mixedNashEquilibria(game).filter(
    (equilibrium) =>
      equilibrium.row.support.length > 1 ||
      equilibrium.column.support.length > 1,
  );
}

describe("P3 mixed-equilibrium catalog oracles", () => {
  for (const entry of catalog) {
    it(`${entry.game.title}: exact mixed equilibria and nondegeneracy`, () => {
      const equilibria = mixedNashEquilibria(entry.game);
      const mixed = nonPureEquilibria(entry.game);

      expect(mixed.map(formatEquilibrium)).toEqual(entry.oracle.mixedNash);
      expect(equilibria).toHaveLength(
        entry.oracle.pureNash.length + entry.oracle.mixedNash.length,
      );
      expect(isDegenerate(entry.game)).toBe(entry.oracle.degenerate);
      expect(
        equilibria.every(
          (equilibrium) =>
            verifyMixedEquilibrium(entry.game, equilibrium).isNashEquilibrium,
        ),
      ).toBe(true);
    });
  }
});

describe("mixed-equilibrium cross-checks", () => {
  it("keeps a non-best-response action below a formal degeneracy witness tie", () => {
    const game = createNormalFormGame({
      id: "three-column-degenerate",
      title: "Three column degenerate",
      rowActions: ["A", "B", "C"],
      columnActions: ["X", "Y", "Z"],
      payoffs: [
        [
          [0, 1],
          [0, 1],
          [0, 0],
        ],
        [
          [1, 0],
          [1, 0],
          [1, 0],
        ],
        [
          [2, 0],
          [2, 0],
          [2, 0],
        ],
      ],
    });

    expect(degeneracyWitness(game)).toEqual({
      player: "row",
      S: [0],
      B: [0, 1],
      x: [ONE, ZERO, ZERO],
    });
  });

  it("matches support enumeration across random nondegenerate 2×2 games", () => {
    const arbitraryGame = fc
      .array(fc.integer({ min: -9, max: 9 }), {
        minLength: 8,
        maxLength: 8,
      })
      .map((values) =>
        createNormalFormGame({
          id: `two-by-two-${values.join("-")}`,
          title: "Random 2×2",
          rowActions: ["R0", "R1"],
          columnActions: ["C0", "C1"],
          payoffs: [
            [
              [values[0], values[1]],
              [values[2], values[3]],
            ],
            [
              [values[4], values[5]],
              [values[6], values[7]],
            ],
          ],
        }),
      );

    fc.assert(
      fc.property(arbitraryGame, (game) => {
        if (isDegenerate(game)) {
          return;
        }

        const enumerated = nonPureEquilibria(game).map(formatEquilibrium);
        const closedForm = twoByTwoMixedEquilibrium(game);

        expect(closedForm ? [formatEquilibrium(closedForm)] : []).toEqual(
          enumerated,
        );
      }),
    );
  });
});
