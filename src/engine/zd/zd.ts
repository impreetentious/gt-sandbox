import {
  add,
  compare,
  divide,
  equals,
  multiply,
  negate,
  rational,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Zero-determinant strategies for the Iterated Prisoner's Dilemma
 * (Press & Dyson 2012).
 *
 * The result is genuinely startling and worth stating plainly: a player using
 * only the last round can unilaterally *impose a linear equation* relating the
 * two players' long-run average payoffs, and the opponent cannot escape it no
 * matter how clever or how long their memory is. Not a bound on their own
 * score — a constraint on the pair.
 *
 * The mechanism is a determinant identity. For memory-one players the
 * stationary distribution of the four-state chain can be written so that any
 * dot product `π · f` equals a 4×4 determinant whose last column is `f`. Pick
 * `f = α·SX + β·SY + γ·1` and arrange for X's strategy to *be* that vector, and
 * two columns coincide, so the determinant — and therefore
 * `α·sX + β·sY + γ` — is exactly zero. Hence "zero-determinant".
 *
 * Everything here is exact rational arithmetic. That is not decoration: the
 * admissible range for the scale factor φ is an intersection of four
 * inequalities that frequently touch at their endpoints, and the boundary cases
 * (TFT at χ = 1, and the equality that decides whether a given strategy is ZD
 * at all) are exact equalities that floating point would decide by rounding.
 *
 * State order throughout is X's view of the previous round: CC, CD, DC, DD,
 * with X's own action written first.
 */

/** Payoffs of the stage game, in the usual T > R > P > S naming. */
export interface StageGame {
  /** Reward — both cooperate. */
  readonly r: Rational;
  /** Sucker — you cooperate, they defect. */
  readonly s: Rational;
  /** Temptation — you defect, they cooperate. */
  readonly t: Rational;
  /** Punishment — both defect. */
  readonly p: Rational;
}

/**
 * Probability of cooperating after each of the four outcomes, indexed
 * CC, CD, DC, DD from this player's own point of view.
 */
export type MemoryOneStrategy = readonly [
  Rational,
  Rational,
  Rational,
  Rational,
];

export const TIT_FOR_TAT: MemoryOneStrategy = [ONE, ZERO, ONE, ZERO];
export const ALWAYS_DEFECT: MemoryOneStrategy = [ZERO, ZERO, ZERO, ZERO];
export const ALWAYS_COOPERATE: MemoryOneStrategy = [ONE, ONE, ONE, ONE];

/** Maps X's state index to the index the same round has in Y's own frame. */
const OPPONENT_VIEW = [0, 2, 1, 3] as const;

export function createStageGame(game: StageGame): StageGame {
  // The ZD construction itself only needs T > S and R > P — it does not require
  // a Prisoner's Dilemma. Checking the two it does need keeps the φ interval
  // and the extortion baseline meaningful without over-constraining callers who
  // want to explore a Stag Hunt or a Chicken game.
  if (compare(game.t, game.s) !== 1) {
    throw new RangeError("A stage game needs T > S.");
  }
  if (compare(game.r, game.p) !== 1) {
    throw new RangeError("A stage game needs R > P.");
  }
  return game;
}

/** The canonical Prisoner's Dilemma used throughout the product. */
export const CANONICAL_PD: StageGame = createStageGame({
  r: rational(3n),
  s: rational(0n),
  t: rational(5n),
  p: rational(1n),
});

/** X's payoff in each of the four states: (R, S, T, P). */
export function ownPayoffVector(game: StageGame): readonly Rational[] {
  return [game.r, game.s, game.t, game.p];
}

/**
 * Y's payoff in each of X's four states: (R, T, S, P). The middle two swap
 * because CD means X cooperated and Y defected, which pays Y the temptation.
 */
export function opponentPayoffVector(game: StageGame): readonly Rational[] {
  return [game.r, game.t, game.s, game.p];
}

/**
 * The linear relation a ZD player enforces: `α·sX + β·sY + γ = 0`, where sX and
 * sY are the two long-run average payoffs.
 */
export interface EnforcedRelation {
  readonly alpha: Rational;
  readonly beta: Rational;
  readonly gamma: Rational;
}

function scaleVector(
  vector: readonly Rational[],
  factor: Rational,
): readonly Rational[] {
  return vector.map((value) => multiply(value, factor));
}

function addVectors(
  left: readonly Rational[],
  right: readonly Rational[],
): readonly Rational[] {
  return left.map((value, index) => add(value, right[index]));
}

/**
 * `f = α·SX + β·SY + γ·1` — the vector a ZD strategy's `p̃` must be proportional
 * to. This is the whole content of the Press–Dyson construction; everything
 * else in this module is feasibility bookkeeping around it.
 */
export function relationVector(
  game: StageGame,
  relation: EnforcedRelation,
): readonly Rational[] {
  return addVectors(
    addVectors(
      scaleVector(ownPayoffVector(game), relation.alpha),
      scaleVector(opponentPayoffVector(game), relation.beta),
    ),
    [relation.gamma, relation.gamma, relation.gamma, relation.gamma],
  );
}

export interface PhiInterval {
  /** Largest admissible φ; φ ranges over (0, max]. */
  readonly max: Rational;
}

export type ZdConstruction =
  | {
      readonly kind: "feasible";
      readonly phi: PhiInterval;
      readonly strategy: MemoryOneStrategy;
      readonly relation: EnforcedRelation;
    }
  | {
      readonly kind: "infeasible";
      readonly relation: EnforcedRelation;
      /** Which of the four probabilities cannot be placed in [0, 1], and why. */
      readonly witness: string;
    };

const STATE_LABEL = ["CC", "CD", "DC", "DD"] as const;

/**
 * Turns an enforced relation into an actual strategy, or explains why no
 * strategy enforces it.
 *
 * `p̃ = (p1−1, p2−1, p3, p4) = φ·f` has to land inside the unit cube, so the
 * first two components of `f` must be ≤ 0 and the last two ≥ 0. When that holds
 * the binding component sets φ's ceiling; when it fails no φ rescues it, and
 * the offending state is named rather than silently clamped.
 */
export function constructZdStrategy(
  game: StageGame,
  relation: EnforcedRelation,
  phi?: Rational,
): ZdConstruction {
  const f = relationVector(game, relation);

  for (const index of [0, 1] as const) {
    if (compare(f[index], ZERO) === 1) {
      return {
        kind: "infeasible",
        relation,
        witness: `After ${STATE_LABEL[index]} the relation demands a cooperation probability above 1, so no scale factor places it in [0, 1].`,
      };
    }
  }
  for (const index of [2, 3] as const) {
    if (compare(f[index], ZERO) === -1) {
      return {
        kind: "infeasible",
        relation,
        witness: `After ${STATE_LABEL[index]} the relation demands a negative cooperation probability, so no scale factor places it in [0, 1].`,
      };
    }
  }

  let ceiling: Rational | null = null;
  for (const value of f) {
    if (equals(value, ZERO)) {
      continue;
    }
    const bound = divide(
      ONE,
      compare(value, ZERO) === -1 ? negate(value) : value,
    );
    if (ceiling === null || compare(bound, ceiling) === -1) {
      ceiling = bound;
    }
  }

  if (ceiling === null) {
    return {
      kind: "infeasible",
      relation,
      witness:
        "The relation is identically zero, which every strategy satisfies vacuously; it constrains nothing.",
    };
  }

  const chosen = phi ?? ceiling;
  if (compare(chosen, ZERO) !== 1 || compare(chosen, ceiling) === 1) {
    throw new RangeError(
      `phi must lie in (0, ${ceiling.numerator}/${ceiling.denominator}].`,
    );
  }

  const tilde = f.map((value) => multiply(value, chosen));

  return {
    kind: "feasible",
    phi: { max: ceiling },
    relation,
    strategy: [add(ONE, tilde[0]), add(ONE, tilde[1]), tilde[2], tilde[3]],
  };
}

/**
 * Extortionate ZD: enforces `sX − P = χ·(sY − P)`, so every unit the opponent
 * earns above the mutual-defection baseline hands the extortioner χ units.
 *
 * χ = 1 is the fair boundary. At the canonical PD it returns exactly Tit for
 * Tat — which is the cleanest available statement of what TFT is: the
 * χ = 1 member of the extortion family, enforcing sX = sY.
 */
export function extortionateStrategy(
  game: StageGame,
  chi: Rational,
  phi?: Rational,
): ZdConstruction {
  if (compare(chi, ONE) === -1) {
    throw new RangeError("The extortion factor χ must be at least 1.");
  }
  return constructZdStrategy(
    game,
    {
      alpha: ONE,
      beta: negate(chi),
      gamma: multiply(game.p, subtract(chi, ONE)),
    },
    phi,
  );
}

/**
 * Generous ZD (Stewart & Plotkin 2013): the same construction with the baseline
 * moved from mutual defection to mutual cooperation, enforcing
 * `sX − R = χ·(sY − R)`.
 *
 * The sign flips where it matters. Because both players sit *below* R, taking χ
 * of the opponent's shortfall means the generous player absorbs more of any
 * loss than it inflicts. Its signature is p₁ = 1: it never defects after mutual
 * cooperation.
 */
export function generousStrategy(
  game: StageGame,
  chi: Rational,
  phi?: Rational,
): ZdConstruction {
  if (compare(chi, ONE) === -1) {
    throw new RangeError("The generosity factor χ must be at least 1.");
  }
  return constructZdStrategy(
    game,
    {
      alpha: ONE,
      beta: negate(chi),
      gamma: multiply(game.r, subtract(chi, ONE)),
    },
    phi,
  );
}

/**
 * Equalizer: α = 0, so the relation fixes the *opponent's* score at `target`
 * regardless of what they do. The player sets its opponent's payoff and has no
 * say over its own.
 *
 * Written as `−sY + target = 0` rather than `sY − target = 0`. The two are the
 * same relation, but only the first has the sign pattern `constructZdStrategy`
 * needs — `f`'s first two components must be ≤ 0 and its last two ≥ 0 — and
 * with that orientation feasibility works out to exactly `target ∈ [P, R]`,
 * which is the honest range: an equalizer cannot pin its opponent below mutual
 * defection or above mutual cooperation.
 */
export function equalizerStrategy(
  game: StageGame,
  target: Rational,
  phi?: Rational,
): ZdConstruction {
  return constructZdStrategy(
    game,
    { alpha: ZERO, beta: negate(ONE), gamma: target },
    phi,
  );
}

export type ZdVerdict =
  | { readonly kind: "zero-determinant"; readonly relation: EnforcedRelation }
  | {
      readonly kind: "not-zero-determinant";
      /** The exact inconsistency that rules it out. */
      readonly witness: string;
    };

interface ExactSolution {
  readonly solution: readonly Rational[];
  /**
   * False when some unknown is a free variable, i.e. the system has infinitely
   * many solutions and `solution` is merely one of them (free variables set to
   * zero). Callers that need *the* answer rather than *an* answer must check
   * this — a stationary distribution over a reducible chain is exactly that
   * case, and it is not detectable from the returned vector alone.
   */
  readonly unique: boolean;
}

/**
 * Exact Gaussian elimination on an augmented matrix over the rationals.
 * Returns null when the system is inconsistent.
 */
function solveExact(
  rows: readonly (readonly Rational[])[],
  unknowns: number,
): ExactSolution | null {
  const matrix = rows.map((row) => [...row]);
  const pivotColumns: number[] = [];
  let pivotRow = 0;

  for (
    let column = 0;
    column < unknowns && pivotRow < matrix.length;
    column++
  ) {
    let selected = -1;
    for (let row = pivotRow; row < matrix.length; row++) {
      if (!equals(matrix[row][column], ZERO)) {
        selected = row;
        break;
      }
    }
    if (selected === -1) {
      continue;
    }

    [matrix[pivotRow], matrix[selected]] = [matrix[selected], matrix[pivotRow]];
    const pivot = matrix[pivotRow][column];
    for (let c = column; c <= unknowns; c++) {
      matrix[pivotRow][c] = divide(matrix[pivotRow][c], pivot);
    }
    for (let row = 0; row < matrix.length; row++) {
      if (row === pivotRow) {
        continue;
      }
      const factor = matrix[row][column];
      if (equals(factor, ZERO)) {
        continue;
      }
      for (let c = column; c <= unknowns; c++) {
        matrix[row][c] = subtract(
          matrix[row][c],
          multiply(factor, matrix[pivotRow][c]),
        );
      }
    }
    pivotColumns.push(column);
    pivotRow++;
  }

  // A row of all-zero coefficients with a non-zero constant is inconsistent.
  for (let row = pivotRow; row < matrix.length; row++) {
    if (!equals(matrix[row][unknowns], ZERO)) {
      return null;
    }
  }

  const solution = Array.from({ length: unknowns }, () => ZERO);
  pivotColumns.forEach((column, index) => {
    solution[column] = matrix[index][unknowns];
  });
  return { solution, unique: pivotColumns.length === unknowns };
}

/**
 * Decides whether a given memory-one strategy is zero-determinant, and if so
 * recovers the relation it enforces.
 *
 * This is the honest direction of the question, and it is the one that stops
 * the module from over-claiming. `p̃` is a 4-vector while `span{SX, SY, 1}` is
 * generically only 3-dimensional, so *most* memory-one strategies are not ZD —
 * including Always Defect, despite it being reachable as a limit of extortion.
 * Rather than assert that, the check solves the 4×3 system exactly and reports
 * the inconsistency when there is one.
 */
export function classifyZd(
  game: StageGame,
  strategy: MemoryOneStrategy,
): ZdVerdict {
  const tilde = [
    subtract(strategy[0], ONE),
    subtract(strategy[1], ONE),
    strategy[2],
    strategy[3],
  ];
  const sx = ownPayoffVector(game);
  const sy = opponentPayoffVector(game);

  const rows = tilde.map((value, index) => [sx[index], sy[index], ONE, value]);
  const solved = solveExact(rows, 3);

  if (solved === null) {
    return {
      kind: "not-zero-determinant",
      witness:
        "No (α, β, γ) reproduces this strategy's p̃ from SX, SY and 1 — the four required equations are inconsistent, so the strategy lies outside the three-dimensional zero-determinant family.",
    };
  }

  const [alpha, beta, gamma] = solved.solution;

  if (equals(alpha, ZERO) && equals(beta, ZERO) && equals(gamma, ZERO)) {
    return {
      kind: "not-zero-determinant",
      witness:
        "The only solution is the trivial relation 0 = 0, which every pair of payoffs satisfies; the strategy enforces nothing.",
    };
  }

  // A non-unique solution means SX, SY and 1 are linearly dependent — a
  // degenerate stage game where the family collapses. The strategy is still
  // zero-determinant; the relation simply is not pinned down, and reporting one
  // representative of the family is the correct answer.
  return {
    kind: "zero-determinant",
    relation: { alpha, beta, gamma },
  };
}

export interface StationaryOutcome {
  /** Long-run probability of each state, in CC, CD, DC, DD order. */
  readonly distribution: readonly Rational[];
  readonly ownPayoff: Rational;
  readonly opponentPayoff: Rational;
}

/**
 * Exact long-run payoffs for two memory-one players — the independent verifier.
 *
 * It builds the 4×4 transition matrix from the two strategies and solves
 * `πM = π` with `Σπ = 1` by exact elimination. Nothing here uses the
 * determinant identity, so confirming that a constructed ZD strategy really
 * does force `α·sX + β·sY + γ = 0` against arbitrary opponents tests the
 * construction rather than restating it.
 *
 * Requires an aperiodic, irreducible chain — pass opponents with every
 * probability strictly inside (0, 1). Deterministic opponents such as TFT can
 * make the chain periodic, where a unique stationary distribution need not
 * describe the time average; `null` is returned rather than a wrong number.
 */
export function stationaryOutcome(
  game: StageGame,
  own: MemoryOneStrategy,
  opponent: MemoryOneStrategy,
): StationaryOutcome | null {
  const transition: Rational[][] = [];

  for (let state = 0; state < 4; state++) {
    const pCooperate = own[state];
    const qCooperate = opponent[OPPONENT_VIEW[state]];
    const pDefect = subtract(ONE, pCooperate);
    const qDefect = subtract(ONE, qCooperate);

    transition.push([
      multiply(pCooperate, qCooperate),
      multiply(pCooperate, qDefect),
      multiply(pDefect, qCooperate),
      multiply(pDefect, qDefect),
    ]);
  }

  // (Mᵀ − I)π = 0 stacked with Σπ = 1; four unknowns, five equations, and the
  // redundancy among them is exactly what makes the system solvable.
  const rows: Rational[][] = [];
  for (let column = 0; column < 4; column++) {
    const row: Rational[] = [];
    for (let state = 0; state < 4; state++) {
      row.push(
        subtract(transition[state][column], state === column ? ONE : ZERO),
      );
    }
    row.push(ZERO);
    rows.push(row);
  }
  rows.push([ONE, ONE, ONE, ONE, ONE]);

  const solved = solveExact(rows, 4);
  // A free variable means the chain is reducible — Tit for Tat against itself
  // is the standard example, with CC and DD both absorbing. Elimination would
  // happily return one of the many stationary vectors, and that vector looks
  // perfectly normal: non-negative and summing to one. Only the rank tells the
  // truth, so this is checked here rather than inferred from the answer.
  if (solved === null || !solved.unique) {
    return null;
  }

  const distribution = solved.solution;
  if (distribution.some((value) => compare(value, ZERO) === -1)) {
    return null;
  }

  const sx = ownPayoffVector(game);
  const sy = opponentPayoffVector(game);

  return {
    distribution,
    ownPayoff: distribution.reduce(
      (sum, weight, index) => add(sum, multiply(weight, sx[index])),
      ZERO,
    ),
    opponentPayoff: distribution.reduce(
      (sum, weight, index) => add(sum, multiply(weight, sy[index])),
      ZERO,
    ),
  };
}

/** Residual of the enforced relation — exactly zero when it holds. */
export function relationResidual(
  relation: EnforcedRelation,
  outcome: StationaryOutcome,
): Rational {
  return add(
    add(
      multiply(relation.alpha, outcome.ownPayoff),
      multiply(relation.beta, outcome.opponentPayoff),
    ),
    relation.gamma,
  );
}
