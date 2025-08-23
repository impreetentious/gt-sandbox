import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { catalog } from "@/engine/catalog";
import {
  allProfiles,
  createNormalFormGame,
  isZeroSum,
  profileKey,
} from "@/engine/game";
import { pureNashEquilibria } from "@/engine/solve/pure";
import { verifyPureProfile } from "@/engine/verify";

function keys(profiles: readonly { row: number; column: number }[]): string[] {
  return profiles.map(profileKey);
}

describe("catalog pure-equilibrium oracles", () => {
  for (const entry of catalog) {
    it(`${entry.game.title}: pure equilibria and zero-sum status`, () => {
      expect(keys(pureNashEquilibria(entry.game))).toEqual(
        keys(entry.oracle.pureNash),
      );
      expect(isZeroSum(entry.game)).toBe(entry.oracle.zeroSum);

      for (let row = 0; row < entry.game.rowActions.length; row += 1) {
        for (
          let column = 0;
          column < entry.game.columnActions.length;
          column += 1
        ) {
          const profile = { row, column };
          expect(verifyPureProfile(entry.game, profile).isNashEquilibrium).toBe(
            keys(entry.oracle.pureNash).includes(profileKey(profile)),
          );
        }
      }
    });
  }
});

describe("pure-solver soundness", () => {
  it("matches the independent deviation verifier on random 2×2–4×4 games", () => {
    const arbitraryGame = fc
      .tuple(fc.integer({ min: 2, max: 4 }), fc.integer({ min: 2, max: 4 }))
      .chain(([rowCount, columnCount]) =>
        fc
          .array(fc.integer({ min: -9, max: 9 }), {
            minLength: rowCount * columnCount * 2,
            maxLength: rowCount * columnCount * 2,
          })
          .map((values) => {
            let cursor = 0;
            return createNormalFormGame({
              id: `random-${rowCount}-${columnCount}`,
              title: "Random game",
              rowActions: Array.from(
                { length: rowCount },
                (_, index) => `R${index}`,
              ),
              columnActions: Array.from(
                { length: columnCount },
                (_, index) => `C${index}`,
              ),
              payoffs: Array.from({ length: rowCount }, () =>
                Array.from({ length: columnCount }, () => {
                  const payoff = [values[cursor], values[cursor + 1]] as const;
                  cursor += 2;
                  return payoff;
                }),
              ),
            });
          }),
      );

    fc.assert(
      fc.property(arbitraryGame, (game) => {
        const solverOutput = pureNashEquilibria(game);
        const independentlyVerified = allProfiles(game).filter(
          (profile) => verifyPureProfile(game, profile).isNashEquilibrium,
        );

        expect(keys(solverOutput)).toEqual(keys(independentlyVerified));
        expect(
          solverOutput.every(
            (profile) => verifyPureProfile(game, profile).isNashEquilibrium,
          ),
        ).toBe(true);
      }),
    );
  });
});
