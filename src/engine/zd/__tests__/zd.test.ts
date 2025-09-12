import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  classifyZd,
  constructZdStrategy,
  createStageGame,
  equalizerStrategy,
  extortionateStrategy,
  generousStrategy,
  relationResidual,
  relationVector,
  stationaryOutcome,
  ALWAYS_COOPERATE,
  ALWAYS_DEFECT,
  CANONICAL_PD,
  TIT_FOR_TAT,
  type MemoryOneStrategy,
  type StageGame,
  type ZdConstruction,
} from "@/engine/zd";
import {
  add,
  compare,
  equals,
  formatRational,
  multiply,
  negate,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";

function feasible(construction: ZdConstruction) {
  if (construction.kind !== "feasible") {
    throw new Error(
      `Expected a feasible construction: ${construction.witness}`,
    );
  }
  return construction;
}

function show(strategy: MemoryOneStrategy): string[] {
  return strategy.map(formatRational);
}

/** An interior memory-one opponent — every probability strictly in (0, 1). */
function interior(
  p: number,
  q: number,
  r: number,
  s: number,
): MemoryOneStrategy {
  return [
    rational(BigInt(p), 12n),
    rational(BigInt(q), 12n),
    rational(BigInt(r), 12n),
    rational(BigInt(s), 12n),
  ];
}

describe("stage game", () => {
  it("requires T > S and R > P", () => {
    expect(() =>
      createStageGame({
        r: rational(3n),
        s: rational(5n),
        t: rational(5n),
        p: rational(1n),
      }),
    ).toThrow(RangeError);
    expect(() =>
      createStageGame({
        r: rational(1n),
        s: rational(0n),
        t: rational(5n),
        p: rational(1n),
      }),
    ).toThrow(RangeError);
  });

  it("does not insist on a Prisoner's Dilemma", () => {
    // A Stag Hunt satisfies T > S and R > P without T > R.
    expect(() =>
      createStageGame({
        r: rational(4n),
        s: rational(0n),
        t: rational(3n),
        p: rational(2n),
      }),
    ).not.toThrow();
  });
});

describe("extortionate strategies", () => {
  it("returns exactly Tit for Tat at χ = 1", () => {
    // The cleanest statement of what TFT is: the fair member of the extortion
    // family, enforcing sX = sY with no surplus to either side.
    const built = feasible(extortionateStrategy(CANONICAL_PD, rational(1n)));

    expect(show(built.strategy)).toEqual(show(TIT_FOR_TAT));
    expect(formatRational(built.phi.max)).toBe("1/5");
  });

  it("always defects after mutual defection, at every χ", () => {
    // p₄ = 0 falls out of the algebra: the extortion baseline is P itself.
    for (const chi of [1n, 2n, 3n, 7n]) {
      const built = feasible(extortionateStrategy(CANONICAL_PD, rational(chi)));
      expect(formatRational(built.strategy[3])).toBe("0");
    }
  });

  it("produces exact fractions for a χ that is itself a fraction", () => {
    // χ = 3/2 gives f = (−1, −7, 11/2, 0), so φ is capped at 1/7 by the CD
    // component and p₃ = 11/14 — a value with no finite decimal expansion.
    const built = feasible(
      extortionateStrategy(CANONICAL_PD, rational(3n, 2n)),
    );

    expect(show(built.strategy)).toEqual(["6/7", "0", "11/14", "0"]);
    expect(formatRational(built.phi.max)).toBe("1/7");
  });

  it("rejects an extortion factor below 1", () => {
    expect(() => extortionateStrategy(CANONICAL_PD, rational(1n, 2n))).toThrow(
      RangeError,
    );
  });

  it("rejects a φ outside the admissible interval", () => {
    expect(() =>
      extortionateStrategy(CANONICAL_PD, rational(2n), rational(1n)),
    ).toThrow(RangeError);
    expect(() =>
      extortionateStrategy(CANONICAL_PD, rational(2n), ZERO),
    ).toThrow(RangeError);
  });
});

describe("generous strategies", () => {
  it("never defects after mutual cooperation", () => {
    // p₁ = 1 is the generous signature, and it is what makes the family
    // evolutionarily robust where extortion is not.
    for (const chi of [1n, 2n, 5n]) {
      const built = feasible(generousStrategy(CANONICAL_PD, rational(chi)));
      expect(formatRational(built.strategy[0])).toBe("1");
    }
  });

  it("also collapses to Tit for Tat at χ = 1", () => {
    // Both baselines coincide when there is no surplus to divide, so the two
    // families meet at exactly one point.
    const built = feasible(generousStrategy(CANONICAL_PD, rational(1n)));
    expect(show(built.strategy)).toEqual(show(TIT_FOR_TAT));
  });

  it("differs from extortion as soon as χ leaves 1", () => {
    const extortion = feasible(
      extortionateStrategy(CANONICAL_PD, rational(2n)),
    );
    const generous = feasible(generousStrategy(CANONICAL_PD, rational(2n)));

    expect(show(extortion.strategy)).not.toEqual(show(generous.strategy));
    expect(formatRational(extortion.strategy[3])).toBe("0");
    expect(compare(generous.strategy[3], ZERO)).toBe(1);
  });
});

describe("equalizers", () => {
  it("pins the opponent's score anywhere between P and R", () => {
    const built = feasible(equalizerStrategy(CANONICAL_PD, rational(2n)));
    const outcome = stationaryOutcome(
      CANONICAL_PD,
      built.strategy,
      interior(5, 9, 2, 7),
    );

    expect(outcome).not.toBeNull();
    expect(formatRational(outcome!.opponentPayoff)).toBe("2");
  });

  it("holds that score against every opponent it meets", () => {
    const built = feasible(equalizerStrategy(CANONICAL_PD, rational(2n)));

    for (const opponent of [
      interior(1, 1, 1, 1),
      interior(11, 11, 11, 11),
      interior(3, 8, 5, 10),
      interior(9, 2, 6, 4),
    ]) {
      const outcome = stationaryOutcome(CANONICAL_PD, built.strategy, opponent);
      expect(outcome).not.toBeNull();
      expect(formatRational(outcome!.opponentPayoff)).toBe("2");
    }
  });

  it("cannot pin a score outside [P, R]", () => {
    // Asking for less than mutual defection or more than mutual cooperation
    // pushes a probability out of the unit cube; the failure names the state.
    const tooLow = equalizerStrategy(CANONICAL_PD, rational(0n));
    const tooHigh = equalizerStrategy(CANONICAL_PD, rational(4n));

    expect(tooLow.kind).toBe("infeasible");
    expect(tooHigh.kind).toBe("infeasible");
    if (tooHigh.kind === "infeasible") {
      expect(tooHigh.witness).toMatch(/CC|CD/);
    }
  });
});

describe("the enforced relation actually binds", () => {
  /**
   * The independent verification. `stationaryOutcome` never touches the
   * determinant identity — it builds the transition matrix and solves for the
   * stationary distribution directly — so agreement here tests the Press–Dyson
   * construction rather than restating it.
   */
  it("forces α·sX + β·sY + γ = 0 exactly, against every opponent tried", () => {
    const built = feasible(extortionateStrategy(CANONICAL_PD, rational(2n)));

    for (const opponent of [
      interior(1, 1, 1, 1),
      interior(11, 11, 11, 11),
      interior(6, 6, 6, 6),
      interior(2, 9, 4, 7),
      interior(10, 1, 8, 3),
      interior(5, 5, 11, 1),
    ]) {
      const outcome = stationaryOutcome(CANONICAL_PD, built.strategy, opponent);
      expect(outcome).not.toBeNull();
      expect(equals(relationResidual(built.relation, outcome!), ZERO)).toBe(
        true,
      );
    }
  });

  it("gives the extortioner χ times the opponent's surplus over P", () => {
    const chi = rational(3n);
    const built = feasible(extortionateStrategy(CANONICAL_PD, chi));
    const outcome = stationaryOutcome(
      CANONICAL_PD,
      built.strategy,
      interior(9, 3, 7, 2),
    )!;

    // (sX − P) = χ·(sY − P), written as an identity rather than a ratio so the
    // sY = P case does not divide by zero.
    const ownSurplus = subtract(outcome.ownPayoff, CANONICAL_PD.p);
    const theirSurplus = subtract(outcome.opponentPayoff, CANONICAL_PD.p);

    expect(equals(ownSurplus, multiply(chi, theirSurplus))).toBe(true);
    // And the surplus is real, so this is not the degenerate both-at-P case.
    expect(compare(theirSurplus, ZERO)).toBe(1);
    expect(compare(outcome.ownPayoff, outcome.opponentPayoff)).toBe(1);
  });

  it("holds across the whole feasible χ range and many opponents", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 40 }),
        fc.integer({ min: 1, max: 11 }),
        fc.integer({ min: 1, max: 11 }),
        fc.integer({ min: 1, max: 11 }),
        fc.integer({ min: 1, max: 11 }),
        (chiTenths, a, b, c, d) => {
          const built = extortionateStrategy(
            CANONICAL_PD,
            rational(BigInt(chiTenths), 10n),
          );
          if (built.kind !== "feasible") {
            return;
          }
          const outcome = stationaryOutcome(
            CANONICAL_PD,
            built.strategy,
            interior(a, b, c, d),
          );
          if (outcome === null) {
            return;
          }
          expect(equals(relationResidual(built.relation, outcome), ZERO)).toBe(
            true,
          );
        },
      ),
      { numRuns: 60 },
    );
  });

  it("binds in a non-PD stage game too", () => {
    const stagHunt: StageGame = createStageGame({
      r: rational(4n),
      s: rational(0n),
      t: rational(3n),
      p: rational(2n),
    });
    const built = feasible(generousStrategy(stagHunt, rational(2n)));
    const outcome = stationaryOutcome(
      stagHunt,
      built.strategy,
      interior(7, 4, 9, 2),
    )!;

    expect(equals(relationResidual(built.relation, outcome), ZERO)).toBe(true);
  });
});

describe("classifying an arbitrary strategy", () => {
  it("recognises Tit for Tat and recovers the relation sX = sY", () => {
    const verdict = classifyZd(CANONICAL_PD, TIT_FOR_TAT);

    expect(verdict.kind).toBe("zero-determinant");
    if (verdict.kind === "zero-determinant") {
      // α = −β and γ = 0, in whatever normalisation elimination lands on.
      expect(formatRational(verdict.relation.gamma)).toBe("0");
      expect(
        equals(verdict.relation.alpha, negate(verdict.relation.beta)),
      ).toBe(true);
    }
  });

  it("recognises a strategy it built itself", () => {
    for (const chi of [2n, 3n, 5n]) {
      const built = feasible(extortionateStrategy(CANONICAL_PD, rational(chi)));
      expect(classifyZd(CANONICAL_PD, built.strategy).kind).toBe(
        "zero-determinant",
      );
    }
  });

  /**
   * The finding worth keeping. Always Defect is frequently described as a
   * limiting case of extortion, and it is not one: `p̃ = (−1, −1, 0, 0)` is not
   * in `span{SX, SY, 1}` for the canonical PD, and the χ → ∞ extortion limit
   * converges to (1/2, 0, 1/4, 0) rather than to (0, 0, 0, 0).
   */
  it("rejects Always Defect — it is not a zero-determinant strategy", () => {
    const verdict = classifyZd(CANONICAL_PD, ALWAYS_DEFECT);

    expect(verdict.kind).toBe("not-zero-determinant");
    if (verdict.kind === "not-zero-determinant") {
      expect(verdict.witness).toMatch(/inconsistent/);
    }
  });

  it("shows the χ → ∞ extortion limit is not Always Defect", () => {
    const far = feasible(extortionateStrategy(CANONICAL_PD, rational(10_000n)));

    // Converging on (1/2, 0, 1/4, 0), nowhere near all-zero.
    expect(compare(far.strategy[0], rational(49n, 100n))).toBe(1);
    expect(compare(far.strategy[2], rational(24n, 100n))).toBe(1);
    expect(formatRational(far.strategy[1])).toBe("0");
    expect(formatRational(far.strategy[3])).toBe("0");
  });

  it("rejects Always Cooperate for the same structural reason", () => {
    expect(classifyZd(CANONICAL_PD, ALWAYS_COOPERATE).kind).toBe(
      "not-zero-determinant",
    );
  });

  it("reports the vacuous relation rather than calling it zero-determinant", () => {
    // p̃ = 0 means p = (1, 1, 0, 0) — cooperate iff you cooperated last round,
    // regardless of the opponent. It satisfies 0 = 0 and constrains nothing.
    const verdict = classifyZd(CANONICAL_PD, [
      rational(1n),
      rational(1n),
      ZERO,
      ZERO,
    ]);

    expect(verdict.kind).toBe("not-zero-determinant");
    if (verdict.kind === "not-zero-determinant") {
      expect(verdict.witness).toMatch(/0 = 0|trivial/);
    }
  });

  it("round-trips: every constructed strategy classifies back to its relation", () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 60 }), (chiTenths) => {
        const built = extortionateStrategy(
          CANONICAL_PD,
          rational(BigInt(chiTenths), 10n),
        );
        if (built.kind !== "feasible") {
          return;
        }
        const verdict = classifyZd(CANONICAL_PD, built.strategy);
        expect(verdict.kind).toBe("zero-determinant");
        if (verdict.kind === "zero-determinant") {
          // Recovered up to scale: α₁β₂ = β₁α₂ exactly.
          const original = built.relation;
          const found = verdict.relation;
          expect(
            equals(
              multiply(original.alpha, found.beta),
              multiply(original.beta, found.alpha),
            ),
          ).toBe(true);
        }
      }),
      { numRuns: 40 },
    );
  });
});

describe("infeasible constructions", () => {
  it("names the state that cannot be satisfied", () => {
    const construction = constructZdStrategy(CANONICAL_PD, {
      alpha: rational(1n),
      beta: rational(1n),
      gamma: ZERO,
    });

    expect(construction.kind).toBe("infeasible");
    if (construction.kind === "infeasible") {
      expect(construction.witness).toMatch(/CC|CD|DC|DD/);
    }
  });

  it("refuses the identically-zero relation", () => {
    const construction = constructZdStrategy(CANONICAL_PD, {
      alpha: ZERO,
      beta: ZERO,
      gamma: ZERO,
    });

    expect(construction.kind).toBe("infeasible");
    if (construction.kind === "infeasible") {
      expect(construction.witness).toMatch(/vacuously|constrains nothing/);
    }
  });
});

describe("stationary distribution", () => {
  it("puts a pair of interior players on a normalised distribution", () => {
    const outcome = stationaryOutcome(
      CANONICAL_PD,
      interior(6, 6, 6, 6),
      interior(6, 6, 6, 6),
    )!;

    // Coin-flippers on both sides: each of the four states a quarter of the
    // time, and both average (R + S + T + P) / 4 = 9/4.
    expect(outcome.distribution.map(formatRational)).toEqual([
      "1/4",
      "1/4",
      "1/4",
      "1/4",
    ]);
    expect(formatRational(outcome.ownPayoff)).toBe("9/4");
    expect(formatRational(outcome.opponentPayoff)).toBe("9/4");
  });

  it("is symmetric under swapping the two players", () => {
    const x = interior(9, 2, 7, 3);
    const y = interior(4, 8, 1, 10);

    const forward = stationaryOutcome(CANONICAL_PD, x, y)!;
    const backward = stationaryOutcome(CANONICAL_PD, y, x)!;

    expect(formatRational(forward.ownPayoff)).toBe(
      formatRational(backward.opponentPayoff),
    );
    expect(formatRational(forward.opponentPayoff)).toBe(
      formatRational(backward.ownPayoff),
    );
  });

  it("keeps exactness where floating point would not", () => {
    // Denominators here run well past what a double represents; the check is
    // that the distribution still sums to exactly one.
    const outcome = stationaryOutcome(
      CANONICAL_PD,
      interior(1, 11, 1, 11),
      interior(11, 1, 11, 1),
    )!;

    const total = outcome.distribution.reduce(
      (sum: Rational, value) => add(sum, value),
      ZERO,
    );
    expect(formatRational(total)).toBe("1");
  });

  it("declines a chain with no unique stationary distribution", () => {
    // Two Tit-for-Tat players started anywhere never mix; the chain is not
    // irreducible, and a single vector cannot describe the time average.
    expect(
      stationaryOutcome(CANONICAL_PD, TIT_FOR_TAT, TIT_FOR_TAT),
    ).toBeNull();
  });
});

describe("relation vector", () => {
  it("is the linear combination it claims to be", () => {
    const vector = relationVector(CANONICAL_PD, {
      alpha: rational(1n),
      beta: rational(-2n),
      gamma: rational(1n),
    });

    // SX = (3, 0, 5, 1), SY = (3, 5, 0, 1), so f = SX − 2·SY + 1.
    expect(vector.map(formatRational)).toEqual(["-2", "-9", "6", "0"]);
  });
});
