import {
  add,
  compare,
  divide,
  multiply,
  negate,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";
import {
  solveLinearProgram,
  type LinearConstraint,
  type LinearProgram,
} from "@/engine/lp/simplex";

/**
 * Dominance by mixed strategies, decided exactly.
 *
 * The gap this closes is real and is the reason it was worth an optimizer. In a
 * 2×2 game, mixed dominance adds nothing a pure comparison misses. From 3×3
 * upwards it does: a strategy can be beaten by a coin flip between two others
 * while losing to neither of them on its own. Pure-strategy elimination walks
 * straight past that, and a game-theory tool that quietly reports "no dominance
 * applies" there is giving a wrong answer, not a partial one.
 *
 * Pearce's lemma is the reason this matters beyond tidiness: in a two-player
 * game a strategy is strictly dominated by a mixture *exactly* when it is never
 * a best response to any belief about the opponent. So this test is the honest
 * definition of "no rational reason to ever play this", and the pure-strategy
 * test is only an approximation to it.
 *
 * This module takes a payoff table already reduced to the strategies still
 * under consideration; the game-facing wrapper lives in
 * `src/engine/solve/dominance.ts`.
 */

/** Rows are candidate dominating strategies, columns are opponent actions. */
export type PayoffTable = readonly (readonly Rational[])[];

export interface MixtureCertificate {
  /** Weight on each candidate row, in the order supplied. Sums to one. */
  readonly weights: readonly Rational[];
  /** Indices, into the supplied rows, carrying positive weight. */
  readonly support: readonly number[];
  /**
   * Smallest gain the mixture earns over the tested strategy across all
   * opponent actions. Strictly positive for strict dominance; zero for weak
   * dominance, where the improvement lives in `bestGain` instead.
   */
  readonly margin: Rational;
  /** Largest gain over the tested strategy. Positive for weak dominance. */
  readonly bestGain: Rational;
}

export type MixtureVerdict =
  | { readonly kind: "dominated"; readonly certificate: MixtureCertificate }
  | { readonly kind: "not-dominated" };

function gainTable(
  candidates: PayoffTable,
  target: readonly Rational[],
): Rational[][] {
  return candidates.map((row) =>
    row.map((value, column) => subtract(value, target[column])),
  );
}

function assertTable(candidates: PayoffTable, target: readonly Rational[]) {
  for (const row of candidates) {
    if (row.length !== target.length) {
      throw new RangeError(
        "Every candidate row needs one payoff per opponent action.",
      );
    }
  }

  if (target.length === 0) {
    throw new RangeError(
      "A dominance test needs at least one opponent action.",
    );
  }
}

function certificateFor(
  gains: readonly (readonly Rational[])[],
  weights: readonly Rational[],
): MixtureCertificate {
  const opponentActions = gains[0].length;
  const perAction = Array.from({ length: opponentActions }, (_, column) =>
    gains.reduce(
      (total, row, index) => add(total, multiply(weights[index], row[column])),
      ZERO,
    ),
  );

  return {
    weights,
    support: weights
      .map((weight, index) => ({ weight, index }))
      .filter((entry) => compare(entry.weight, ZERO) === 1)
      .map((entry) => entry.index),
    margin: perAction.reduce((least, value) =>
      compare(value, least) === -1 ? value : least,
    ),
    bestGain: perAction.reduce((most, value) =>
      compare(value, most) === 1 ? value : most,
    ),
  };
}

/**
 * Strict dominance by a mixture.
 *
 * The formulation deliberately avoids an explicit margin variable. Asking for
 * `Σᵢ zᵢ·(uᵢⱼ − u_targetⱼ) ≥ 1` with `z ≥ 0` and minimizing `Σ z` is feasible
 * precisely when some mixture strictly dominates: rescaling `y = z / Σz` turns
 * any feasible `z` into a mixture with margin `1/Σz > 0`, and any dominating
 * mixture with margin `δ` gives back a feasible `z = y/δ`. Minimizing `Σ z`
 * therefore *maximizes* the guaranteed margin, so the certificate returned is
 * the most convincing one available rather than merely the first found.
 *
 * Keeping every variable nonnegative and every constant strictly positive also
 * sidesteps the free-variable splitting a max-ε formulation would need.
 */
export function strictlyDominatedByMixture(
  candidates: PayoffTable,
  target: readonly Rational[],
): MixtureVerdict {
  assertTable(candidates, target);

  if (candidates.length === 0) {
    return { kind: "not-dominated" };
  }

  const gains = gainTable(candidates, target);
  const constraints: LinearConstraint[] = target.map((_, column) => ({
    coefficients: gains.map((row) => row[column]),
    relation: ">=",
    constant: ONE,
  }));
  const program: LinearProgram = {
    objective: gains.map(() => negate(ONE)),
    constraints,
  };

  const result = solveLinearProgram(program);

  if (result.kind !== "optimal") {
    // Unbounded cannot occur: the objective is −Σz with z ≥ 0, so it is bounded
    // above by zero. Infeasible is the interesting case and means no mixture
    // beats the target everywhere.
    return { kind: "not-dominated" };
  }

  // `total` is strictly positive whenever the program is feasible: there is at
  // least one constraint (`assertTable` rejects an empty opponent action set),
  // and `Σᵢ zᵢ·gainᵢⱼ ≥ 1` cannot hold with every `zᵢ` at zero. So the
  // normalization below never divides by zero, and a guard here would be dead
  // code rather than defence.
  const total = result.variables.reduce((sum, value) => add(sum, value), ZERO);

  return {
    kind: "dominated",
    certificate: certificateFor(
      gains,
      result.variables.map((value) => divide(value, total)),
    ),
  };
}

/**
 * Weak dominance by a mixture: never worse, and strictly better somewhere.
 *
 * Here the mixture constraint has to be explicit — `Σ y = 1` — because without
 * it the "never worse" constraints are satisfied by `y = 0` and the objective
 * would only measure scale. Maximizing the *total* gain across opponent actions
 * is what turns "strictly better somewhere" into a single scalar test: with
 * every per-action gain pinned at or above zero, a positive total can only come
 * from a positive entry.
 *
 * Unlike its strict counterpart, this relation is order-dependent under
 * iterated elimination, exactly as pure weak dominance is; callers are expected
 * to disclose that rather than present a unique reduction.
 */
export function weaklyDominatedByMixture(
  candidates: PayoffTable,
  target: readonly Rational[],
): MixtureVerdict {
  assertTable(candidates, target);

  if (candidates.length === 0) {
    return { kind: "not-dominated" };
  }

  const gains = gainTable(candidates, target);
  const constraints: LinearConstraint[] = target.map((_, column) => ({
    coefficients: gains.map((row) => row[column]),
    relation: ">=",
    constant: ZERO,
  }));

  constraints.push({
    coefficients: gains.map(() => ONE),
    relation: "=",
    constant: ONE,
  });

  const result = solveLinearProgram({
    objective: gains.map((row) =>
      row.reduce((sum, value) => add(sum, value), ZERO),
    ),
    constraints,
  });

  if (result.kind !== "optimal" || compare(result.value, ZERO) !== 1) {
    return { kind: "not-dominated" };
  }

  return {
    kind: "dominated",
    certificate: certificateFor(gains, result.variables),
  };
}
