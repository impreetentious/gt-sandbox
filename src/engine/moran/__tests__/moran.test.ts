import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  classifySelection,
  createMoranConfig,
  expectedPayoffs,
  fitnessAt,
  fixationCurve,
  fixationOfSingleMutantA,
  fixationOfSingleMutantB,
  fixationProbability,
  neutralFixation,
  transitionRatio,
  type MoranConfig,
} from "@/engine/moran";
import {
  add,
  compare,
  divide,
  equals,
  formatRational,
  multiply,
  rational,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";

function payoffs(a: number, b: number, c: number, d: number) {
  return {
    a: rational(BigInt(a)),
    b: rational(BigInt(b)),
    c: rational(BigInt(c)),
    d: rational(BigInt(d)),
  };
}

/** Prisoner's Dilemma with A = Cooperate, B = Defect. */
function prisonersDilemma(populationSize: number, w: [bigint, bigint]) {
  return createMoranConfig({
    populationSize,
    payoffs: payoffs(3, 0, 5, 1),
    selectionIntensity: rational(w[0], w[1]),
  });
}

describe("Moran config validation", () => {
  it("rejects populations below two", () => {
    expect(() =>
      createMoranConfig({
        populationSize: 1,
        payoffs: payoffs(1, 1, 1, 1),
        selectionIntensity: rational(1n, 10n),
      }),
    ).toThrow(/populationSize/);
  });

  it("rejects a selection intensity outside (0, 1]", () => {
    for (const w of [rational(0n), rational(-1n, 2n), rational(3n, 2n)]) {
      expect(() =>
        createMoranConfig({
          populationSize: 10,
          payoffs: payoffs(1, 1, 1, 1),
          selectionIntensity: w,
        }),
      ).toThrow(/selectionIntensity/);
    }
  });

  it("rejects a configuration whose fitness goes non-positive", () => {
    // Strong selection on a deeply negative payoff drives 1 − w + w·π below zero.
    expect(() =>
      createMoranConfig({
        populationSize: 6,
        payoffs: payoffs(-20, -20, -20, -20),
        selectionIntensity: ONE,
      }),
    ).toThrow(/non-positive/);
  });

  it("rejects out-of-range states and non-interior transition ratios", () => {
    const config = prisonersDilemma(8, [1n, 10n]);
    expect(() => fixationProbability(config, -1)).toThrow(/State must be/);
    expect(() => fixationProbability(config, 9)).toThrow(/State must be/);
    expect(() => transitionRatio(config, 0)).toThrow(/interior/);
    expect(() => transitionRatio(config, 8)).toThrow(/interior/);
  });
});

describe("expected payoffs exclude self-interaction", () => {
  it("averages over the other N−1 individuals", () => {
    const config = createMoranConfig({
      populationSize: 5,
      payoffs: payoffs(4, 0, 3, 2),
      selectionIntensity: rational(1n, 2n),
    });
    // i = 2 A's in a population of 5. An A meets 1 other A and 3 B's:
    // π_A = (4·1 + 0·3)/4 = 1. A B meets 2 A's and 2 other B's:
    // π_B = (3·2 + 2·2)/4 = 10/4 = 5/2.
    const { payoffA, payoffB } = expectedPayoffs(config, 2);
    expect(formatRational(payoffA)).toBe("1");
    expect(formatRational(payoffB)).toBe("5/2");
  });

  it("maps payoff to fitness as 1 − w + w·π", () => {
    const config = createMoranConfig({
      populationSize: 5,
      payoffs: payoffs(4, 0, 3, 2),
      selectionIntensity: rational(1n, 2n),
    });
    // f_A = 1/2 + (1/2)(1) = 1. f_B = 1/2 + (1/2)(5/2) = 7/4.
    const { fitnessA, fitnessB } = fitnessAt(config, 2);
    expect(formatRational(fitnessA)).toBe("1");
    expect(formatRational(fitnessB)).toBe("7/4");
    // γ = f_B / f_A = 7/4.
    expect(formatRational(transitionRatio(config, 2))).toBe("7/4");
  });
});

describe("fixation probability", () => {
  it("absorbs at both boundaries", () => {
    const config = prisonersDilemma(10, [1n, 10n]);
    expect(equals(fixationProbability(config, 0), ZERO)).toBe(true);
    expect(equals(fixationProbability(config, 10), ONE)).toBe(true);
  });

  it("returns exactly 1/N in a neutral game, for every N", () => {
    for (const populationSize of [2, 3, 5, 12, 40]) {
      const config = createMoranConfig({
        populationSize,
        payoffs: payoffs(1, 1, 1, 1),
        selectionIntensity: rational(1n, 3n),
      });
      expect(formatRational(fixationOfSingleMutantA(config))).toBe(
        `1/${populationSize}`,
      );
      expect(
        equals(fixationOfSingleMutantA(config), neutralFixation(config)),
      ).toBe(true);
    }
  });

  it("returns i/N across the whole curve in a neutral game", () => {
    const config = createMoranConfig({
      populationSize: 8,
      payoffs: payoffs(2, 2, 2, 2),
      selectionIntensity: rational(1n, 4n),
    });
    for (const row of fixationCurve(config)) {
      expect(
        equals(row.fixation, divide(rational(BigInt(row.state)), rational(8n))),
      ).toBe(true);
    }
  });

  it("rises monotonically with the number of initial mutants", () => {
    const config = prisonersDilemma(12, [1n, 10n]);
    const curve = fixationCurve(config);
    for (let index = 1; index < curve.length; index += 1) {
      expect(compare(curve[index].fixation, curve[index - 1].fixation)).toBe(1);
    }
  });

  it("puts a lone cooperator in a Prisoner's Dilemma below the neutral benchmark", () => {
    const config = prisonersDilemma(20, [1n, 10n]);
    const verdict = classifySelection(config);
    expect(verdict.favoursA).toBe(false);
    expect(verdict.favoursB).toBe(true);
    expect(verdict.aInvadesMoreEasily).toBe(false);
    expect(compare(verdict.fixationA, verdict.neutral)).toBe(-1);
    expect(compare(verdict.fixationB, verdict.neutral)).toBe(1);
  });

  it("stays exact where floating point would underflow to zero", () => {
    // 80 individuals under full selection: the denominator is a sum of products
    // of up to 79 ratios each well above 1. In doubles this overflows and the
    // quotient collapses to 0; as a rational it stays strictly positive.
    const config = createMoranConfig({
      populationSize: 80,
      payoffs: payoffs(3, 0, 5, 1),
      selectionIntensity: rational(9n, 10n),
    });
    const rho = fixationOfSingleMutantA(config);
    expect(compare(rho, ZERO)).toBe(1);
    expect(compare(rho, neutralFixation(config))).toBe(-1);
    expect(rho.numerator).toBeGreaterThan(0n);
  });

  it("mirrors the game correctly when scoring a B mutant", () => {
    // In a game symmetric under relabelling, both mutants must fix alike.
    const config = createMoranConfig({
      populationSize: 9,
      payoffs: payoffs(3, 1, 1, 3),
      selectionIntensity: rational(1n, 5n),
    });
    expect(
      equals(fixationOfSingleMutantA(config), fixationOfSingleMutantB(config)),
    ).toBe(true);
  });
});

// ---- Independent verifier: solve the absorbing Markov chain directly ------

/**
 * Builds the raw birth-death transition probabilities without the algebraic
 * cancellation the engine relies on, then solves the resulting tridiagonal
 * system by exact Gaussian elimination. This reaches the same numbers by a
 * completely different route, so it tests the cancellation itself.
 */
function fixationByLinearSolve(
  config: MoranConfig,
  initialA: number,
): Rational {
  const n = config.populationSize;
  if (initialA === 0) return ZERO;
  if (initialA === n) return ONE;

  const size = n - 1; // unknowns ρ_1 … ρ_{n−1}
  const matrix: Rational[][] = [];
  const rhs: Rational[] = [];

  for (let i = 1; i <= size; i += 1) {
    const { fitnessA, fitnessB } = fitnessAt(config, i);
    const totalFitness = add(
      multiply(rational(BigInt(i)), fitnessA),
      multiply(rational(BigInt(n - i)), fitnessB),
    );
    const birthA = divide(
      multiply(rational(BigInt(i)), fitnessA),
      totalFitness,
    );
    const birthB = divide(
      multiply(rational(BigInt(n - i)), fitnessB),
      totalFitness,
    );
    const up = multiply(
      birthA,
      divide(rational(BigInt(n - i)), rational(BigInt(n))),
    );
    const down = multiply(
      birthB,
      divide(rational(BigInt(i)), rational(BigInt(n))),
    );

    const row: Rational[] = Array.from({ length: size }, () => ZERO);
    row[i - 1] = add(up, down);
    if (i - 2 >= 0) row[i - 2] = subtract(ZERO, down);
    if (i < size) row[i] = subtract(ZERO, up);
    matrix.push(row);
    // ρ_0 = 0 contributes nothing; ρ_n = 1 moves `up` to the right-hand side.
    rhs.push(i === size ? up : ZERO);
  }

  // Exact Gaussian elimination with partial pivoting on non-zero entries.
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    while (pivot < size && equals(matrix[pivot][column], ZERO)) pivot += 1;
    if (pivot === size) throw new Error("singular system");
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    [rhs[column], rhs[pivot]] = [rhs[pivot], rhs[column]];

    const pivotValue = matrix[column][column];
    for (let row = 0; row < size; row += 1) {
      if (row === column || equals(matrix[row][column], ZERO)) continue;
      const factor = divide(matrix[row][column], pivotValue);
      for (let col = column; col < size; col += 1) {
        matrix[row][col] = subtract(
          matrix[row][col],
          multiply(factor, matrix[column][col]),
        );
      }
      rhs[row] = subtract(rhs[row], multiply(factor, rhs[column]));
    }
  }

  return divide(rhs[initialA - 1], matrix[initialA - 1][initialA - 1]);
}

describe("cross-check against a direct Markov-chain solve", () => {
  it("matches the closed form on a Prisoner's Dilemma", () => {
    const config = prisonersDilemma(7, [1n, 4n]);
    for (let state = 0; state <= 7; state += 1) {
      expect(
        equals(
          fixationProbability(config, state),
          fixationByLinearSolve(config, state),
        ),
      ).toBe(true);
    }
  });

  it("matches the closed form on a Hawk–Dove game", () => {
    const config = createMoranConfig({
      populationSize: 6,
      payoffs: payoffs(-1, 2, 0, 1),
      selectionIntensity: rational(1n, 2n),
    });
    for (let state = 0; state <= 6; state += 1) {
      expect(
        equals(
          fixationProbability(config, state),
          fixationByLinearSolve(config, state),
        ),
      ).toBe(true);
    }
  });

  it("matches on randomly generated games", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 7 }),
        fc.array(fc.integer({ min: 0, max: 6 }), {
          minLength: 4,
          maxLength: 4,
        }),
        // w ≤ 9/10 keeps 1 − w + w·π strictly positive even at a zero payoff.
        fc.integer({ min: 1, max: 9 }),
        (populationSize, [a, b, c, d], wNumerator) => {
          const config = createMoranConfig({
            populationSize,
            payoffs: payoffs(a, b, c, d),
            selectionIntensity: rational(BigInt(wNumerator), 10n),
          });
          for (let state = 1; state < populationSize; state += 1) {
            expect(
              equals(
                fixationProbability(config, state),
                fixationByLinearSolve(config, state),
              ),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
