import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  satisfiesProgram,
  solveLinearProgram,
  type LinearConstraint,
  type LinearProgram,
  type LpResult,
} from "@/engine/lp";
import {
  add,
  compare,
  divide,
  equals,
  formatRational,
  multiply,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";

function r(value: number, denominator = 1): Rational {
  return rational(BigInt(value), BigInt(denominator));
}

function row(...values: number[]): Rational[] {
  return values.map((value) => r(value));
}

function objectiveAt(
  program: LinearProgram,
  candidate: readonly Rational[],
): Rational {
  return program.objective.reduce(
    (total, coefficient, index) =>
      add(total, multiply(coefficient, candidate[index])),
    ZERO,
  );
}

/**
 * Independent verifier: vertex enumeration.
 *
 * The fundamental theorem of linear programming says a bounded optimum is
 * attained at a basic feasible solution — a point where enough constraints hold
 * with equality to pin every variable down. This solver finds the optimum by
 * enumerating every such candidate directly and solving the resulting square
 * system by exact Gaussian elimination. It never pivots, never computes a
 * reduced cost, and knows nothing about Bland's rule, so agreement with the
 * simplex is real evidence rather than a restatement.
 *
 * It is exponential and only usable on the small programs in these tests, which
 * is exactly why the simplex exists in the first place.
 */
function solveByVertexEnumeration(program: LinearProgram): LpResult {
  const variables = program.objective.length;

  // Every constraint may be tight, and every variable may sit at its own zero
  // bound. A basic solution chooses `variables` of those to hold with equality.
  const equations: { coefficients: readonly Rational[]; constant: Rational }[] =
    [
      ...program.constraints.map((constraint) => ({
        coefficients: constraint.coefficients,
        constant: constraint.constant,
      })),
      ...Array.from({ length: variables }, (_, index) => ({
        coefficients: Array.from({ length: variables }, (_, other) =>
          other === index ? r(1) : ZERO,
        ),
        constant: ZERO,
      })),
    ];

  let best: { value: Rational; variables: readonly Rational[] } | null = null;
  let feasibleFound = false;

  for (const choice of combinations(equations.length, variables)) {
    const solution = solveSquare(
      choice.map((index) => equations[index].coefficients),
      choice.map((index) => equations[index].constant),
    );

    if (solution === null || !satisfiesProgram(program, solution)) {
      continue;
    }

    feasibleFound = true;
    const value = objectiveAt(program, solution);

    if (best === null || compare(value, best.value) === 1) {
      best = { value, variables: solution };
    }
  }

  if (!feasibleFound) {
    return { kind: "infeasible" };
  }

  // An unbounded program still has vertices; it is unbounded when some feasible
  // ray improves the objective. Rather than enumerate rays, these tests only
  // compare against the simplex on programs whose feasible region is bounded by
  // construction, and this guard documents that restriction.
  return best === null
    ? { kind: "infeasible" }
    : { kind: "optimal", value: best.value, variables: best.variables };
}

function* combinations(total: number, choose: number): Generator<number[]> {
  const indices: number[] = [];

  function* walk(start: number): Generator<number[]> {
    if (indices.length === choose) {
      yield [...indices];
      return;
    }

    for (let index = start; index < total; index++) {
      indices.push(index);
      yield* walk(index + 1);
      indices.pop();
    }
  }

  yield* walk(0);
}

/** Exact Gaussian elimination; null when the system is singular or unsolvable. */
function solveSquare(
  coefficients: readonly (readonly Rational[])[],
  constants: readonly Rational[],
): Rational[] | null {
  const size = constants.length;
  const matrix = coefficients.map((line, index) => [
    ...line,
    constants[index],
  ]) as Rational[][];

  for (let column = 0; column < size; column++) {
    let selected = -1;

    for (let candidate = column; candidate < size; candidate++) {
      if (!equals(matrix[candidate][column], ZERO)) {
        selected = candidate;
        break;
      }
    }

    if (selected === -1) {
      return null;
    }

    [matrix[column], matrix[selected]] = [matrix[selected], matrix[column]];

    const pivot = matrix[column][column];
    for (let index = column; index <= size; index++) {
      matrix[column][index] = divide(matrix[column][index], pivot);
    }

    for (let other = 0; other < size; other++) {
      if (other === column || equals(matrix[other][column], ZERO)) {
        continue;
      }

      const factor = matrix[other][column];
      for (let index = column; index <= size; index++) {
        matrix[other][index] = subtract(
          matrix[other][index],
          multiply(factor, matrix[column][index]),
        );
      }
    }
  }

  return matrix.map((line) => line[size]);
}

function optimal(result: LpResult) {
  if (result.kind !== "optimal") {
    throw new Error(`Expected an optimal solution, got ${result.kind}.`);
  }
  return result;
}

describe("exact simplex", () => {
  it("solves a textbook maximization", () => {
    // max 3x + 5y  s.t. x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18 — optimum 36 at (2, 6).
    const program: LinearProgram = {
      objective: row(3, 5),
      constraints: [
        { coefficients: row(1, 0), relation: "<=", constant: r(4) },
        { coefficients: row(0, 2), relation: "<=", constant: r(12) },
        { coefficients: row(3, 2), relation: "<=", constant: r(18) },
      ],
    };

    const result = optimal(solveLinearProgram(program));

    expect(formatRational(result.value)).toBe("36");
    expect(result.variables.map(formatRational)).toEqual(["2", "6"]);
  });

  it("returns exact fractions where the optimum is not integral", () => {
    const program: LinearProgram = {
      objective: row(1, 1),
      constraints: [
        { coefficients: row(2, 3), relation: "<=", constant: r(7) },
        { coefficients: row(3, 2), relation: "<=", constant: r(7) },
      ],
    };

    const result = optimal(solveLinearProgram(program));

    expect(result.variables.map(formatRational)).toEqual(["7/5", "7/5"]);
    expect(formatRational(result.value)).toBe("14/5");
  });

  it("handles greater-than and equality constraints through phase one", () => {
    // min 2x + 3y with x + y = 10, x ≥ 3 — written as a maximization of −2x−3y.
    const program: LinearProgram = {
      objective: row(-2, -3),
      constraints: [
        { coefficients: row(1, 1), relation: "=", constant: r(10) },
        { coefficients: row(1, 0), relation: ">=", constant: r(3) },
      ],
    };

    const result = optimal(solveLinearProgram(program));

    expect(result.variables.map(formatRational)).toEqual(["10", "0"]);
    expect(formatRational(result.value)).toBe("-20");
  });

  it("normalizes constraints stated with a negative constant, in every relation", () => {
    // `−x ≥ −5` is `x ≤ 5`: the flip turns a phase-one problem into a plain
    // slack row, so getting the direction wrong here would silently loosen or
    // tighten the feasible region rather than fail loudly.
    const flippedToLessThan = optimal(
      solveLinearProgram({
        objective: row(1),
        constraints: [
          { coefficients: row(-1), relation: ">=", constant: r(-5) },
        ],
      }),
    );
    expect(formatRational(flippedToLessThan.value)).toBe("5");

    // `−x ≤ −5` is `x ≥ 5`, which does need phase one.
    const flippedToGreaterThan = optimal(
      solveLinearProgram({
        objective: row(-1),
        constraints: [
          { coefficients: row(-1), relation: "<=", constant: r(-5) },
        ],
      }),
    );
    expect(formatRational(flippedToGreaterThan.value)).toBe("-5");

    // An equality keeps its relation and only changes sign.
    const flippedEquality = optimal(
      solveLinearProgram({
        objective: row(1, 0),
        constraints: [
          { coefficients: row(-1, -2), relation: "=", constant: r(-6) },
        ],
      }),
    );
    expect(formatRational(flippedEquality.value)).toBe("6");
  });

  it("reports contradictory constraints as infeasible", () => {
    const program: LinearProgram = {
      objective: row(1, 1),
      constraints: [
        { coefficients: row(1, 1), relation: "<=", constant: r(1) },
        { coefficients: row(1, 1), relation: ">=", constant: r(3) },
      ],
    };

    expect(solveLinearProgram(program).kind).toBe("infeasible");
  });

  it("reports an unbounded objective rather than a wrong number", () => {
    const program: LinearProgram = {
      objective: row(1, 1),
      constraints: [
        { coefficients: row(1, -1), relation: "<=", constant: r(2) },
      ],
    };

    expect(solveLinearProgram(program).kind).toBe("unbounded");
  });

  it("treats a program with no constraints honestly in both directions", () => {
    expect(
      solveLinearProgram({ objective: row(1), constraints: [] }).kind,
    ).toBe("unbounded");

    const bounded = optimal(
      solveLinearProgram({ objective: row(-1, 0), constraints: [] }),
    );
    expect(formatRational(bounded.value)).toBe("0");
    expect(bounded.variables.map(formatRational)).toEqual(["0", "0"]);
  });

  it("drops a redundant constraint instead of failing on it", () => {
    // The third row is the sum of the first two, so phase one leaves an
    // artificial variable basic at zero on a row that cannot be pivoted out.
    const program: LinearProgram = {
      objective: row(1, 1, 1),
      constraints: [
        { coefficients: row(1, 1, 0), relation: "=", constant: r(4) },
        { coefficients: row(0, 1, 1), relation: "=", constant: r(6) },
        { coefficients: row(1, 2, 1), relation: "=", constant: r(10) },
      ],
    };

    const result = optimal(solveLinearProgram(program));

    expect(formatRational(result.value)).toBe("10");
    expect(satisfiesProgram(program, result.variables)).toBe(true);
  });

  it("terminates on a degenerate program that cycles under a naive pivot rule", () => {
    // Beale's classic cycling example. Under the largest-coefficient rule it
    // returns to its starting basis after six pivots and loops forever; the
    // whole feasible region starts degenerate, with two constraints tight at
    // the origin. Bland's rule terminates, and the answer is cross-checked
    // against vertex enumeration rather than a remembered constant.
    const program: LinearProgram = {
      objective: [r(3, 4), r(-20), r(1, 2), r(-6)],
      constraints: [
        {
          coefficients: [r(1, 4), r(-8), r(-1), r(9)],
          relation: "<=",
          constant: ZERO,
        },
        {
          coefficients: [r(1, 2), r(-12), r(-1, 2), r(3)],
          relation: "<=",
          constant: ZERO,
        },
        {
          coefficients: [ZERO, ZERO, r(1), ZERO],
          relation: "<=",
          constant: r(1),
        },
      ],
    };

    const result = optimal(solveLinearProgram(program));
    const independent = optimal(solveByVertexEnumeration(program));

    expect(formatRational(result.value)).toBe("5/4");
    expect(equals(result.value, independent.value)).toBe(true);
    expect(satisfiesProgram(program, result.variables)).toBe(true);
  });

  it("rejects malformed programs", () => {
    expect(() =>
      solveLinearProgram({ objective: [], constraints: [] }),
    ).toThrow(RangeError);
    expect(() =>
      solveLinearProgram({
        objective: row(1, 1),
        constraints: [{ coefficients: row(1), relation: "<=", constant: r(1) }],
      }),
    ).toThrow(RangeError);
  });

  it("agrees with vertex enumeration on random bounded programs", () => {
    const smallRational = fc
      .integer({ min: -4, max: 4 })
      .map((value) => r(value));

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            coefficients: fc.array(smallRational, {
              minLength: 3,
              maxLength: 3,
            }),
            constant: fc.integer({ min: 0, max: 8 }).map((value) => r(value)),
          }),
          { minLength: 1, maxLength: 4 },
        ),
        fc.array(smallRational, { minLength: 3, maxLength: 3 }),
        (rawConstraints, objective) => {
          const constraints: LinearConstraint[] = rawConstraints.map(
            (constraint) => ({ ...constraint, relation: "<=" as const }),
          );

          // Box the region so the comparison is against a bounded optimum; the
          // enumerator finds vertices, not improving rays.
          for (let index = 0; index < 3; index++) {
            constraints.push({
              coefficients: Array.from({ length: 3 }, (_, other) =>
                other === index ? r(1) : ZERO,
              ),
              relation: "<=",
              constant: r(10),
            });
          }

          const program: LinearProgram = { objective, constraints };
          const bySimplex = solveLinearProgram(program);
          const byEnumeration = solveByVertexEnumeration(program);

          expect(bySimplex.kind).toBe(byEnumeration.kind);

          if (
            bySimplex.kind === "optimal" &&
            byEnumeration.kind === "optimal"
          ) {
            expect(satisfiesProgram(program, bySimplex.variables)).toBe(true);
            expect(equals(bySimplex.value, byEnumeration.value)).toBe(true);
          }
        },
      ),
      { numRuns: 120 },
    );
  });

  it("agrees with vertex enumeration when equalities are present", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -3, max: 3 }), {
          minLength: 3,
          maxLength: 3,
        }),
        fc.integer({ min: 1, max: 6 }),
        (objective, budget) => {
          const program: LinearProgram = {
            objective: objective.map((value) => r(value)),
            constraints: [
              {
                coefficients: row(1, 1, 1),
                relation: "=",
                constant: r(budget),
              },
              { coefficients: row(2, 1, 0), relation: "<=", constant: r(8) },
            ],
          };

          const bySimplex = solveLinearProgram(program);
          const byEnumeration = solveByVertexEnumeration(program);

          expect(bySimplex.kind).toBe(byEnumeration.kind);

          if (
            bySimplex.kind === "optimal" &&
            byEnumeration.kind === "optimal"
          ) {
            expect(satisfiesProgram(program, bySimplex.variables)).toBe(true);
            expect(equals(bySimplex.value, byEnumeration.value)).toBe(true);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("stays exact where floating point would not", () => {
    // 1/3 + 1/3 + 1/3 is exactly 1 here, so the equality binds and the optimum
    // is attained. In binary floating point the sum misses by an ulp and the
    // constraint is decided by whatever tolerance the solver happens to use.
    const third = r(1, 3);
    const program: LinearProgram = {
      objective: row(1, 0, 0),
      constraints: [
        {
          coefficients: [third, third, third],
          relation: "=",
          constant: r(1),
        },
      ],
    };

    const result = optimal(solveLinearProgram(program));

    expect(formatRational(result.value)).toBe("3");
    expect(result.variables.map(formatRational)).toEqual(["3", "0", "0"]);
  });

  it("checks candidate solutions against every relation", () => {
    const program: LinearProgram = {
      objective: row(1, 1),
      constraints: [
        { coefficients: row(1, 0), relation: "<=", constant: r(2) },
        { coefficients: row(0, 1), relation: ">=", constant: r(1) },
        { coefficients: row(1, 1), relation: "=", constant: r(3) },
      ],
    };

    expect(satisfiesProgram(program, row(2, 1))).toBe(true);
    expect(satisfiesProgram(program, row(3, 0))).toBe(false);
    expect(satisfiesProgram(program, row(-1, 4))).toBe(false);
    expect(satisfiesProgram(program, row(2, 2))).toBe(false);
    expect(satisfiesProgram(program, [r(5, 2), r(1, 2)])).toBe(false);
  });
});
