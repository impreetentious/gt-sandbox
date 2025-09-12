import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  strictlyDominatedByMixture,
  weaklyDominatedByMixture,
  type MixtureVerdict,
  type PayoffTable,
} from "@/engine/lp";
import {
  add,
  compare,
  divide,
  formatRational,
  multiply,
  rational,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";

function r(value: number, denominator = 1): Rational {
  return rational(BigInt(value), BigInt(denominator));
}

function table(...rows: number[][]): PayoffTable {
  return rows.map((values) => values.map((value) => r(value)));
}

function dominated(verdict: MixtureVerdict) {
  if (verdict.kind !== "dominated") {
    throw new Error("Expected the strategy to be dominated.");
  }
  return verdict.certificate;
}

/** Direct arithmetic re-check that a returned mixture really does dominate. */
function actualGains(
  candidates: PayoffTable,
  target: readonly Rational[],
  weights: readonly Rational[],
): Rational[] {
  return target.map((value, column) =>
    subtract(
      candidates.reduce(
        (total, row, index) =>
          add(total, multiply(weights[index], row[column])),
        ZERO,
      ),
      value,
    ),
  );
}

function sum(values: readonly Rational[]): Rational {
  return values.reduce((total, value) => add(total, value), ZERO);
}

/**
 * Independent verifier for the two-candidate case.
 *
 * With exactly two candidate rows the dominating mixture is a single number
 * `λ ∈ [0, 1]`, so the whole question collapses to intersecting intervals: each
 * opponent action `j` demands `λ·(a_j − b_j) + b_j > t_j`, a linear inequality
 * in one variable whose solution set is a half-line computed by exact division.
 * Intersect them and ask whether anything survives inside [0, 1].
 *
 * That shares no machinery with the simplex — no tableau, no pivoting, no
 * phase one — so when the two agree across a randomized sweep it is evidence
 * about the LP rather than a restatement of it.
 */
function strictlyDominatedByPair(
  candidates: PayoffTable,
  target: readonly Rational[],
): boolean {
  const [first, second] = candidates;
  let low = ZERO;
  let high = ONE;
  let lowOpen = false;
  let highOpen = false;

  for (let column = 0; column < target.length; column++) {
    // slope·λ + intercept > 0, where slope = a − b and intercept = b − t.
    const slope = subtract(first[column], second[column]);
    const intercept = subtract(second[column], target[column]);

    if (compare(slope, ZERO) === 0) {
      if (compare(intercept, ZERO) !== 1) {
        return false;
      }
      continue;
    }

    const bound = divide(
      subtract(ZERO, intercept),
      slope,
    ); /* λ = −intercept/slope */

    if (compare(slope, ZERO) === 1) {
      if (compare(bound, low) === 1) {
        low = bound;
        lowOpen = true;
      } else if (compare(bound, low) === 0) {
        lowOpen = true;
      }
    } else {
      if (compare(bound, high) === -1) {
        high = bound;
        highOpen = true;
      } else if (compare(bound, high) === 0) {
        highOpen = true;
      }
    }
  }

  const width = compare(low, high);

  if (width === 1) {
    return false;
  }

  // A single surviving point only counts when neither side excluded it.
  return width === -1 || (!lowOpen && !highOpen);
}

describe("dominance by mixtures", () => {
  it("finds the canonical 3×3 strategy beaten only by a mixture", () => {
    // The textbook shape: Top wins big on the left, Middle wins big in the
    // centre, and Bottom is safe everywhere. No pure strategy beats Bottom —
    // Top loses in the centre, Middle loses on the left — but an even split
    // between them earns 3 against every column against Bottom's 2.
    const candidates = table([6, 0, 3], [0, 6, 3]);
    const target = [r(2), r(2), r(2)];

    const certificate = dominated(
      strictlyDominatedByMixture(candidates, target),
    );

    expect(certificate.weights.map(formatRational)).toEqual(["1/2", "1/2"]);
    expect(certificate.support).toEqual([0, 1]);
    expect(formatRational(certificate.margin)).toBe("1");

    // And neither candidate manages it alone, which is the entire point.
    for (const row of candidates) {
      expect(strictlyDominatedByMixture([row], target).kind).toBe(
        "not-dominated",
      );
    }
  });

  it("returns the mixture with the largest guaranteed margin", () => {
    // Against (2, 2, 2) the even split is not merely feasible, it is optimal:
    // any tilt towards Top loses ground in the centre and vice versa, so the
    // worst-case gain of 1 is the best any mixture can promise.
    const certificate = dominated(
      strictlyDominatedByMixture(table([6, 0, 3], [0, 6, 3]), [
        r(2),
        r(2),
        r(2),
      ]),
    );

    for (const shift of [r(1, 4), r(3, 4), r(1, 10)]) {
      const weights = [shift, subtract(ONE, shift)];
      const worst = actualGains(
        table([6, 0, 3], [0, 6, 3]),
        [r(2), r(2), r(2)],
        weights,
      ).reduce((least, value) =>
        compare(value, least) === -1 ? value : least,
      );

      expect(compare(certificate.margin, worst)).not.toBe(-1);
    }
  });

  it("keeps exact fractions where the optimal mixture is not a round number", () => {
    const certificate = dominated(
      strictlyDominatedByMixture(table([9, 0], [0, 3]), [r(2), r(2)]),
    );

    expect(formatRational(sum(certificate.weights))).toBe("1");
    expect(compare(certificate.margin, ZERO)).toBe(1);
    expect(
      actualGains(
        table([9, 0], [0, 3]),
        [r(2), r(2)],
        certificate.weights,
      ).every((gain) => compare(gain, ZERO) === 1),
    ).toBe(true);
  });

  it("reports a strategy no mixture beats", () => {
    // Bottom now earns 4 against the third column, which neither candidate can
    // reach at any weighting.
    expect(
      strictlyDominatedByMixture(table([6, 0, 3], [0, 6, 3]), [
        r(2),
        r(2),
        r(4),
      ]).kind,
    ).toBe("not-dominated");
  });

  it("separates weak dominance from strict dominance on an exact tie", () => {
    // The only mixture that never loses is the exact half-and-half split: the
    // first column needs λ ≥ 1/2 and the second needs λ ≤ 1/2. It ties in both
    // and wins in the third, so the strategy is weakly but not strictly
    // dominated, and the whole distinction rests on a single point of the
    // feasible set. Floating point would decide that point by tolerance.
    const candidates = table([6, 2, 5], [2, 6, 5]);
    const target = [r(4), r(4), r(4)];

    expect(strictlyDominatedByMixture(candidates, target).kind).toBe(
      "not-dominated",
    );

    const certificate = dominated(weaklyDominatedByMixture(candidates, target));
    const gains = actualGains(candidates, target, certificate.weights);

    expect(gains.every((gain) => compare(gain, ZERO) !== -1)).toBe(true);
    expect(gains.some((gain) => compare(gain, ZERO) === 1)).toBe(true);
    expect(compare(certificate.bestGain, ZERO)).toBe(1);
    expect(formatRational(certificate.margin)).toBe("0");
    expect(certificate.weights.map(formatRational)).toEqual(["1/2", "1/2"]);
  });

  it("does not call an exactly matched strategy weakly dominated", () => {
    // A duplicate row ties everywhere. Never worse, but never better either —
    // reporting that as dominance is the classic off-by-one in the definition.
    expect(
      weaklyDominatedByMixture(table([3, 1], [3, 1]), [r(3), r(1)]).kind,
    ).toBe("not-dominated");
  });

  it("recognizes a pure dominator as a degenerate mixture", () => {
    const certificate = dominated(
      strictlyDominatedByMixture(table([5, 5], [0, 0]), [r(1), r(1)]),
    );

    expect(certificate.support).toEqual([0]);
    expect(certificate.weights.map(formatRational)).toEqual(["1", "0"]);
  });

  it("treats an empty candidate set as no dominance", () => {
    expect(strictlyDominatedByMixture([], [r(1)]).kind).toBe("not-dominated");
    expect(weaklyDominatedByMixture([], [r(1)]).kind).toBe("not-dominated");
  });

  it("rejects ragged tables and empty opponent action sets", () => {
    expect(() => strictlyDominatedByMixture(table([1, 2]), [r(1)])).toThrow(
      RangeError,
    );
    expect(() => strictlyDominatedByMixture([], [])).toThrow(RangeError);
  });

  it("agrees with the two-strategy interval verifier across random games", () => {
    const payoff = fc.integer({ min: -5, max: 5 });

    fc.assert(
      fc.property(
        fc.array(payoff, { minLength: 3, maxLength: 3 }),
        fc.array(payoff, { minLength: 3, maxLength: 3 }),
        fc.array(payoff, { minLength: 3, maxLength: 3 }),
        (first, second, target) => {
          const candidates = table(first, second);
          const targetRow = target.map((value) => r(value));

          const bySimplex =
            strictlyDominatedByMixture(candidates, targetRow).kind ===
            "dominated";
          const byInterval = strictlyDominatedByPair(candidates, targetRow);

          expect(bySimplex).toBe(byInterval);
        },
      ),
      { numRuns: 400 },
    );
  });

  it("returns a mixture that survives direct arithmetic re-checking", () => {
    const payoff = fc.integer({ min: -6, max: 6 });

    fc.assert(
      fc.property(
        fc.array(fc.array(payoff, { minLength: 4, maxLength: 4 }), {
          minLength: 2,
          maxLength: 3,
        }),
        fc.array(payoff, { minLength: 4, maxLength: 4 }),
        (rows, target) => {
          const candidates = table(...rows);
          const targetRow = target.map((value) => r(value));
          const verdict = strictlyDominatedByMixture(candidates, targetRow);

          if (verdict.kind !== "dominated") {
            return;
          }

          const { weights, margin } = verdict.certificate;

          expect(formatRational(sum(weights))).toBe("1");
          expect(weights.every((weight) => compare(weight, ZERO) !== -1)).toBe(
            true,
          );

          const gains = actualGains(candidates, targetRow, weights);
          expect(gains.every((gain) => compare(gain, ZERO) === 1)).toBe(true);
          expect(gains.every((gain) => compare(gain, margin) !== -1)).toBe(
            true,
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  it("makes strict dominance imply weak dominance", () => {
    const payoff = fc.integer({ min: -4, max: 4 });

    fc.assert(
      fc.property(
        fc.array(fc.array(payoff, { minLength: 3, maxLength: 3 }), {
          minLength: 2,
          maxLength: 3,
        }),
        fc.array(payoff, { minLength: 3, maxLength: 3 }),
        (rows, target) => {
          const candidates = table(...rows);
          const targetRow = target.map((value) => r(value));

          if (
            strictlyDominatedByMixture(candidates, targetRow).kind ===
            "dominated"
          ) {
            expect(weaklyDominatedByMixture(candidates, targetRow).kind).toBe(
              "dominated",
            );
          }
        },
      ),
      { numRuns: 250 },
    );
  });
});
