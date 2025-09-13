import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createNormalFormGame, type NormalFormGame } from "@/engine/game";
import {
  analyzeDominance,
  eliminateMixedDominatedStrategies,
  mixedDominanceRelations,
} from "@/engine/solve/dominance";
import {
  add,
  compare,
  formatRational,
  multiply,
  ZERO,
} from "@/engine/rational";

/**
 * The canonical example this phase exists for: Steady is safe against every
 * column and is beaten by no single rival strategy, yet an even split between
 * Push and Hold beats it against all three. Pure-strategy elimination reports
 * nothing here.
 */
const mixtureOnly: NormalFormGame = createNormalFormGame({
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

describe("mixed dominance over a normal-form game", () => {
  it("finds the row a mixture beats and no pure strategy does", () => {
    const analysis = analyzeDominance(mixtureOnly);

    expect(analysis.strict).toEqual([]);
    expect(analysis.strictTrace.steps).toEqual([]);

    const mixed = analysis.mixedStrict.filter(
      (relation) => relation.player === "row",
    );

    expect(mixed).toHaveLength(1);
    expect(mixed[0].dominated).toBe(2);
    expect(mixed[0].requiresMixing).toBe(true);
    expect(mixed[0].support).toEqual([0, 1]);
    expect(mixed[0].weights.map(formatRational)).toEqual(["1/2", "1/2", "0"]);
    expect(formatRational(mixed[0].margin)).toBe("1");
  });

  it("keeps the mixture weights aligned with full action indices", () => {
    // The certificate comes back over the candidate subset; a lift that lost
    // track of the excluded action would silently attribute weight to the wrong
    // strategy, and nothing else in the pipeline would notice.
    const relation = analyzeDominance(mixtureOnly).mixedStrict.find(
      (candidate) => candidate.player === "row",
    );

    expect(relation?.weights).toHaveLength(mixtureOnly.rowActions.length);
    expect(formatRational(relation!.weights[relation!.dominated])).toBe("0");
  });

  it("eliminates iteratively and reaches a smaller reduced game", () => {
    const trace = eliminateMixedDominatedStrategies(mixtureOnly, "strict");

    expect(trace.steps.map((step) => step.dominated)).toContain(2);
    expect(trace.remaining.row).not.toContain(2);
    expect(trace.steps[0].remainingBefore.row).toEqual([0, 1, 2]);
  });

  it("subsumes pure dominance on the Prisoner's Dilemma", () => {
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

    const analysis = analyzeDominance(pd);

    expect(analysis.strict).toHaveLength(2);
    expect(analysis.mixedStrict).toHaveLength(2);
    expect(
      analysis.mixedStrict.every((relation) => !relation.requiresMixing),
    ).toBe(true);
    expect(analysis.mixedStrictTrace.remaining).toEqual({
      row: [1],
      column: [1],
    });
  });

  it("adds nothing beyond pure dominance in 2×2 games", () => {
    // With one alternative per player the only available "mixture" is that
    // single strategy, so mixed dominance cannot outrun the pure test. This is
    // the formal reason the phase is scoped to 3×3 and larger.
    const payoff = fc.integer({ min: -4, max: 4 });

    fc.assert(
      fc.property(
        fc.array(payoff, { minLength: 8, maxLength: 8 }),
        (values) => {
          const game = createNormalFormGame({
            id: "random-2x2",
            title: "Random 2×2",
            rowActions: ["A", "B"],
            columnActions: ["X", "Y"],
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
          });

          const analysis = analyzeDominance(game);

          expect(
            analysis.mixedStrict.map((relation) => relation.dominated),
          ).toEqual(analysis.strict.map((relation) => relation.dominated));
          expect(
            analysis.mixedStrict.every((relation) => !relation.requiresMixing),
          ).toBe(true);
        },
      ),
      { numRuns: 120 },
    );
  });

  it("restricts the dominating mixture to the strategies still available", () => {
    // Push and Hold together beat Steady. Take Hold off the table and the
    // mixture has nothing left to work with, so Steady survives — which is the
    // property that makes iterated elimination meaningful rather than a
    // one-shot filter applied to the full game.
    const restricted = mixedDominanceRelations(mixtureOnly, "strict", {
      row: [0, 2],
      column: [0, 1, 2],
    });

    expect(restricted.filter((relation) => relation.player === "row")).toEqual(
      [],
    );
  });

  it("finds weak mixed dominance where strict mixed dominance fails", () => {
    // Wait ties Match and Undercut against the even split and loses against
    // Hedge, so the mixture never does worse and sometimes does better. Strict
    // dominance fails on the exact tie, which is the distinction the rational
    // arithmetic exists to preserve.
    const tied = createNormalFormGame({
      id: "weak-mixture",
      title: "Weak mixture dominance",
      rowActions: ["Push", "Hold", "Steady"],
      columnActions: ["Match", "Undercut", "Hedge"],
      payoffs: [
        [
          [6, 0],
          [2, 0],
          [5, 0],
        ],
        [
          [2, 0],
          [6, 0],
          [5, 0],
        ],
        [
          [4, 0],
          [4, 0],
          [4, 0],
        ],
      ],
    });

    const strict = mixedDominanceRelations(tied, "strict").filter(
      (relation) => relation.player === "row",
    );
    const weak = mixedDominanceRelations(tied, "weak").filter(
      (relation) => relation.player === "row",
    );

    expect(strict).toEqual([]);
    expect(weak).toHaveLength(1);
    expect(weak[0].dominated).toBe(2);
    expect(weak[0].requiresMixing).toBe(true);
    expect(formatRational(weak[0].margin)).toBe("0");
    expect(formatRational(weak[0].bestGain)).toBe("1");
  });

  it("returns mixtures that survive direct arithmetic re-checking, and never misses a pure dominator", () => {
    const payoff = fc.integer({ min: -3, max: 3 });

    fc.assert(
      fc.property(
        fc.array(
          fc.array(fc.tuple(payoff, payoff), { minLength: 3, maxLength: 3 }),
          { minLength: 3, maxLength: 3 },
        ),
        (payoffs) => {
          const game = createNormalFormGame({
            id: "random-3x3",
            title: "Random 3×3",
            rowActions: ["A", "B", "C"],
            columnActions: ["X", "Y", "Z"],
            payoffs,
          });

          const analysis = analyzeDominance(game);
          const key = (relation: { player: string; dominated: number }) =>
            `${relation.player}:${relation.dominated}`;
          const mixedKeys = new Set(analysis.mixedStrict.map(key));

          // Every pure result reappears in the mixed list, since a pure
          // dominator is a degenerate mixture.
          for (const relation of analysis.strict) {
            expect(mixedKeys.has(key(relation))).toBe(true);
          }

          // And every reported mixture really does beat its target, recomputed
          // straight from the payoff table.
          for (const relation of analysis.mixedStrict) {
            const opponentActions =
              relation.player === "row" ? game.columnActions : game.rowActions;
            const slot = relation.player === "row" ? 0 : 1;

            opponentActions.forEach((_, opponent) => {
              const cell = (action: number) =>
                relation.player === "row"
                  ? game.payoffs[action][opponent][slot]
                  : game.payoffs[opponent][action][slot];

              const mixedPayoff = relation.weights.reduce(
                (total, weight, action) =>
                  add(total, multiply(weight, cell(action))),
                ZERO,
              );

              expect(compare(mixedPayoff, cell(relation.dominated))).toBe(1);
            });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
