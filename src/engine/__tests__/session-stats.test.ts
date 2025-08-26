import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pd } from "@/engine/catalog/pd";
import { pennies } from "@/engine/catalog/pennies";
import type { Profile } from "@/engine/game";
import { add, equals, rational } from "@/engine/rational";
import {
  empiricalActionMix,
  fixedActionHindsight,
  mixVersusNash,
} from "@/engine/session-stats";
import { mixedNashEquilibria } from "@/engine/solve/mixed";

const profiles = fc.array(
  fc.record({ row: fc.constantFrom(0, 1), column: fc.constantFrom(0, 1) }),
  { maxLength: 40 },
);

describe("session-analysis statistics", () => {
  it("keeps the signed hindsight identity exact", () => {
    fc.assert(
      fc.property(profiles, (sequence) => {
        const hindsight = fixedActionHindsight(pd.game, "row", sequence);

        expect(
          equals(
            add(hindsight.actualPayoff, hindsight.gain),
            hindsight.bestFixedPayoff,
          ),
        ).toBe(true);
        expect(equals(hindsight.gain, rational(0n))).toBe(
          equals(hindsight.actualPayoff, hindsight.bestFixedPayoff),
        );
      }),
    );
  });

  it("recognizes when adaptive play beats every fixed action", () => {
    const matchingSequence: Profile[] = [
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ];
    const hindsight = fixedActionHindsight(
      pennies.game,
      "row",
      matchingSequence,
    );

    expect(hindsight.gain).toEqual(rational(-2n));
    expect(hindsight.actualPayoff).toEqual(rational(2n));
    expect(hindsight.bestFixedPayoff).toEqual(rational(0n));
  });

  it("retains exact empirical and Nash mixes without rounding", () => {
    const equilibrium = mixedNashEquilibria(pd.game)[0];
    const sequence: Profile[] = [
      { row: 1, column: 1 },
      { row: 1, column: 1 },
      { row: 1, column: 1 },
    ];
    const empirical = empiricalActionMix(pd.game, "row", sequence);
    const comparison = mixVersusNash(pd.game, "row", sequence, equilibrium);

    expect(empirical.probabilities).toEqual([rational(0n), rational(1n)]);
    expect(comparison.matchesNash).toBe(true);
  });

  it("handles empty histories and column-player comparisons exactly", () => {
    const equilibrium = mixedNashEquilibria(pennies.game)[0];
    const sequence: Profile[] = [
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ];

    expect(empiricalActionMix(pd.game, "column", []).probabilities).toEqual([
      rational(0n),
      rational(0n),
    ]);
    expect(fixedActionHindsight(pennies.game, "column", sequence).gain).toEqual(
      rational(2n),
    );
    expect(
      mixVersusNash(pennies.game, "column", sequence, equilibrium).nash,
    ).toEqual([rational(1n, 2n), rational(1n, 2n)]);
  });
});
