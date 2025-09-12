import {
  add,
  compare,
  divide,
  equals,
  multiply,
  negate,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * A two-phase simplex method over exact rationals.
 *
 * The reason this module exists is narrow and worth stating: deciding whether a
 * pure strategy is dominated by a *mixture* is a linear program, and for 3×3 and
 * larger games there is no closed form to fall back on. Everything else in the
 * engine could be written as algebra; this one genuinely needs an optimizer.
 *
 * Exactness is not decoration here either. Simplex decides which constraints
 * bind by comparing numbers to zero, and dominance questions are full of
 * *exact* ties — a strategy that ties its rival everywhere is weakly but not
 * strictly dominated, and the difference is the entire pedagogical point. In
 * floating point that distinction is a tolerance parameter. Over rationals it is
 * a fact.
 *
 * Degeneracy is handled by **Bland's rule** rather than by the usual
 * largest-coefficient heuristic. Dominance LPs are degenerate constantly — ties
 * in payoffs put several basic variables at zero at once — and the textbook
 * pivot rule can cycle forever on exactly those problems. Bland's rule is slower
 * in the worst case and provably terminates, which is the correct trade for
 * problems this small.
 */

export type ConstraintRelation = "<=" | ">=" | "=";

export interface LinearConstraint {
  /** One coefficient per structural variable, in variable order. */
  readonly coefficients: readonly Rational[];
  readonly relation: ConstraintRelation;
  readonly constant: Rational;
}

/**
 * Maximize `objective · x` subject to the constraints, with every structural
 * variable implicitly bounded below by zero. Free variables are not supported;
 * callers that need one split it into a difference of two nonnegative
 * variables, which is exactly what the dominance formulations avoid having to
 * do.
 */
export interface LinearProgram {
  readonly objective: readonly Rational[];
  readonly constraints: readonly LinearConstraint[];
}

export type LpResult =
  | {
      readonly kind: "optimal";
      readonly value: Rational;
      readonly variables: readonly Rational[];
    }
  | { readonly kind: "infeasible" }
  | { readonly kind: "unbounded" };

interface Tableau {
  /** Each row is `[...coefficients, rhs]`; `rhs` is the last entry. */
  readonly rows: Rational[][];
  /** Column index of the basic variable in each row. */
  readonly basis: number[];
  readonly columns: number;
}

function assertProgram(program: LinearProgram): number {
  const variables = program.objective.length;

  if (variables === 0) {
    throw new RangeError("A linear program needs at least one variable.");
  }

  for (const constraint of program.constraints) {
    if (constraint.coefficients.length !== variables) {
      throw new RangeError(
        `Every constraint needs ${variables} coefficients to match the objective.`,
      );
    }
  }

  return variables;
}

function flip(relation: ConstraintRelation): ConstraintRelation {
  if (relation === "<=") {
    return ">=";
  }
  if (relation === ">=") {
    return "<=";
  }
  return "=";
}

interface NormalizedConstraint {
  readonly coefficients: readonly Rational[];
  readonly relation: ConstraintRelation;
  readonly constant: Rational;
}

/**
 * Rewrites every constraint to have a nonnegative right-hand side, so that the
 * slack/artificial starting basis is feasible by construction.
 */
function normalize(
  constraints: readonly LinearConstraint[],
): NormalizedConstraint[] {
  return constraints.map((constraint) => {
    if (compare(constraint.constant, ZERO) !== -1) {
      return constraint;
    }

    return {
      coefficients: constraint.coefficients.map(negate),
      relation: flip(constraint.relation),
      constant: negate(constraint.constant),
    };
  });
}

interface BuiltTableau {
  readonly tableau: Tableau;
  readonly firstArtificial: number;
  readonly artificialCount: number;
}

function build(
  constraints: readonly NormalizedConstraint[],
  variables: number,
): BuiltTableau {
  const slackCount = constraints.filter(
    (constraint) => constraint.relation !== "=",
  ).length;
  const artificialCount = constraints.filter(
    (constraint) => constraint.relation !== "<=",
  ).length;
  const firstSlack = variables;
  const firstArtificial = firstSlack + slackCount;
  const columns = firstArtificial + artificialCount;

  const rows: Rational[][] = [];
  const basis: number[] = [];
  let slackCursor = firstSlack;
  let artificialCursor = firstArtificial;

  for (const constraint of constraints) {
    const row = Array.from({ length: columns + 1 }, () => ZERO);

    constraint.coefficients.forEach((coefficient, index) => {
      row[index] = coefficient;
    });
    row[columns] = constraint.constant;

    if (constraint.relation !== "=") {
      // `<=` takes a slack variable that can enter the basis directly; `>=`
      // takes a surplus, which cannot, so it needs an artificial alongside it.
      row[slackCursor] = constraint.relation === "<=" ? ONE : negate(ONE);
      if (constraint.relation === "<=") {
        basis.push(slackCursor);
      }
      slackCursor++;
    }

    if (constraint.relation !== "<=") {
      row[artificialCursor] = ONE;
      basis.push(artificialCursor);
      artificialCursor++;
    }

    rows.push(row);
  }

  return {
    tableau: { rows, basis, columns },
    firstArtificial,
    artificialCount,
  };
}

/**
 * Reduced costs, recomputed from the cost vector and the current tableau rather
 * than carried along and updated in place.
 *
 * Maintaining an objective row incrementally is the usual presentation and is
 * one pivot-sign slip away from silently wrong answers. These programs have a
 * handful of variables, so recomputing `c_j − Σ c_B(i)·T[i][j]` every iteration
 * costs nothing measurable and removes a whole class of bug.
 */
function reducedCosts(
  tableau: Tableau,
  costs: readonly Rational[],
): Rational[] {
  return Array.from({ length: tableau.columns }, (_, column) => {
    let value = costs[column];

    tableau.basis.forEach((basicColumn, row) => {
      value = subtract(
        value,
        multiply(costs[basicColumn], tableau.rows[row][column]),
      );
    });

    return value;
  });
}

function pivot(tableau: Tableau, row: number, column: number): void {
  const pivotValue = tableau.rows[row][column];

  for (let index = 0; index <= tableau.columns; index++) {
    tableau.rows[row][index] = divide(tableau.rows[row][index], pivotValue);
  }

  for (let other = 0; other < tableau.rows.length; other++) {
    if (other === row) {
      continue;
    }

    const factor = tableau.rows[other][column];

    if (equals(factor, ZERO)) {
      continue;
    }

    for (let index = 0; index <= tableau.columns; index++) {
      tableau.rows[other][index] = subtract(
        tableau.rows[other][index],
        multiply(factor, tableau.rows[row][index]),
      );
    }
  }

  tableau.basis[row] = column;
}

type PhaseOutcome = "optimal" | "unbounded";

/**
 * Simplex iterations under Bland's rule: the entering variable is the
 * lowest-indexed one with a positive reduced cost, and ties in the minimum
 * ratio test are broken towards the lowest-indexed basic variable. Together
 * those two choices make cycling impossible, which is the only reason this
 * loop is allowed to be unbounded.
 */
function iterate(tableau: Tableau, costs: readonly Rational[]): PhaseOutcome {
  while (true) {
    const reduced = reducedCosts(tableau, costs);
    let entering = -1;

    for (let column = 0; column < tableau.columns; column++) {
      if (compare(reduced[column], ZERO) === 1) {
        entering = column;
        break;
      }
    }

    if (entering === -1) {
      return "optimal";
    }

    let leaving = -1;
    let bestRatio: Rational | null = null;

    for (let row = 0; row < tableau.rows.length; row++) {
      const coefficient = tableau.rows[row][entering];

      if (compare(coefficient, ZERO) !== 1) {
        continue;
      }

      const ratio = divide(tableau.rows[row][tableau.columns], coefficient);
      const comparison = bestRatio === null ? -1 : compare(ratio, bestRatio);

      if (
        comparison === -1 ||
        (comparison === 0 && tableau.basis[row] < tableau.basis[leaving])
      ) {
        bestRatio = ratio;
        leaving = row;
      }
    }

    if (leaving === -1) {
      return "unbounded";
    }

    pivot(tableau, leaving, entering);
  }
}

/**
 * Removes artificial variables from the basis once phase one has driven them to
 * zero. A row that cannot be pivoted out is linearly dependent on the others —
 * a redundant constraint, not an error — and is dropped.
 */
function expelArtificials(tableau: Tableau, firstArtificial: number): Tableau {
  const rows = tableau.rows;
  const basis = tableau.basis;
  const keep: number[] = [];

  for (let row = 0; row < rows.length; row++) {
    if (basis[row] < firstArtificial) {
      keep.push(row);
      continue;
    }

    let replacement = -1;

    for (let column = 0; column < firstArtificial; column++) {
      if (!equals(rows[row][column], ZERO)) {
        replacement = column;
        break;
      }
    }

    if (replacement === -1) {
      continue;
    }

    pivot(tableau, row, replacement);
    keep.push(row);
  }

  return {
    rows: keep.map((row) => [
      ...rows[row].slice(0, firstArtificial),
      rows[row][tableau.columns],
    ]),
    basis: keep.map((row) => basis[row]),
    columns: firstArtificial,
  };
}

/**
 * Solves a linear program exactly.
 *
 * Phase one minimizes the total artificial weight to find a basic feasible
 * solution; a positive residual there means the constraints contradict each
 * other. Phase two then optimizes the caller's objective from that vertex.
 */
export function solveLinearProgram(program: LinearProgram): LpResult {
  const variables = assertProgram(program);

  if (program.constraints.length === 0) {
    // With no constraints, any positive objective coefficient runs away.
    return program.objective.some((value) => compare(value, ZERO) === 1)
      ? { kind: "unbounded" }
      : {
          kind: "optimal",
          value: ZERO,
          variables: Array.from({ length: variables }, () => ZERO),
        };
  }

  const built = build(normalize(program.constraints), variables);
  let tableau = built.tableau;

  if (built.artificialCount > 0) {
    const phaseOneCosts = Array.from(
      { length: tableau.columns },
      (_, column) => (column >= built.firstArtificial ? negate(ONE) : ZERO),
    );

    iterate(tableau, phaseOneCosts);

    const residual = tableau.basis.reduce(
      (total, basicColumn, row) =>
        basicColumn >= built.firstArtificial
          ? add(total, tableau.rows[row][tableau.columns])
          : total,
      ZERO,
    );

    if (!equals(residual, ZERO)) {
      return { kind: "infeasible" };
    }

    tableau = expelArtificials(tableau, built.firstArtificial);
  }

  const phaseTwoCosts = Array.from({ length: tableau.columns }, (_, column) =>
    column < variables ? program.objective[column] : ZERO,
  );

  if (iterate(tableau, phaseTwoCosts) === "unbounded") {
    return { kind: "unbounded" };
  }

  const solution = Array.from({ length: variables }, () => ZERO);

  tableau.basis.forEach((basicColumn, row) => {
    if (basicColumn < variables) {
      solution[basicColumn] = tableau.rows[row][tableau.columns];
    }
  });

  return {
    kind: "optimal",
    value: solution.reduce(
      (total, value, index) =>
        add(total, multiply(value, program.objective[index])),
      ZERO,
    ),
    variables: solution,
  };
}

/** True when `x` satisfies every constraint and is nonnegative. */
export function satisfiesProgram(
  program: LinearProgram,
  candidate: readonly Rational[],
): boolean {
  if (candidate.some((value) => compare(value, ZERO) === -1)) {
    return false;
  }

  return program.constraints.every((constraint) => {
    const left = constraint.coefficients.reduce(
      (total, coefficient, index) =>
        add(total, multiply(coefficient, candidate[index])),
      ZERO,
    );
    const comparison = compare(left, constraint.constant);

    if (constraint.relation === "<=") {
      return comparison !== 1;
    }
    if (constraint.relation === ">=") {
      return comparison !== -1;
    }
    return comparison === 0;
  });
}
