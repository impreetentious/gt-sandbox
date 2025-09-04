import {
  allProfiles,
  payoffFor,
  type NormalFormGame,
  type Profile,
} from "@/engine/game";
import {
  add,
  compare,
  divide,
  multiply,
  ONE,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Exact folk-theorem analysis for a two-player game. Everything here is closed
 * form in rationals: the feasible payoff hull, each player's minimax (security)
 * value, and the discount-factor threshold at which grim-trigger sustains a
 * designated cooperative outcome by reverting to the stage Nash punishment.
 *
 * The threshold uses the one-shot-deviation principle. For player i, cooperation
 * is sustainable iff
 *   R_i / (1 - δ)  ≥  D_i + δ · P_i / (1 - δ)
 * which rearranges to δ ≥ (D_i − R_i) / (D_i − P_i), where R_i is the
 * cooperative payoff, D_i the best one-shot deviation against the cooperative
 * opponent action, and P_i the punishment (reversion) payoff.
 */
export interface PayoffPoint {
  readonly row: Rational;
  readonly column: Rational;
}

export type DeltaThreshold =
  | { readonly kind: "always" }
  | { readonly kind: "threshold"; readonly value: Rational }
  | { readonly kind: "never"; readonly reason: string };

export interface FolkTheoremAnalysis {
  readonly cooperativeProfile: Profile;
  readonly punishmentProfile: Profile;
  readonly cooperativePayoff: PayoffPoint;
  readonly punishmentPayoff: PayoffPoint;
  readonly rowMinimax: Rational;
  readonly columnMinimax: Rational;
  /** Convex-hull vertices of the pure-outcome payoff set, counter-clockwise. */
  readonly feasibleHull: readonly PayoffPoint[];
  readonly cooperativeIsIndividuallyRational: boolean;
  readonly rowThreshold: DeltaThreshold;
  readonly columnThreshold: DeltaThreshold;
  /** The binding threshold across both players. */
  readonly threshold: DeltaThreshold;
}

export interface FolkTheoremConfig {
  /** Action index each player treats as "cooperate". */
  readonly cooperate: Profile;
  /** Action index each player reverts to as punishment (defaults to the other). */
  readonly punish?: Profile;
}

function assertTwoPlayerBinary(game: NormalFormGame): void {
  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    throw new RangeError("Folk-theorem analysis requires a 2×2 game.");
  }
}

function maxRational(values: readonly Rational[]): Rational {
  return values.reduce((best, value) =>
    compare(value, best) === 1 ? value : best,
  );
}

function minRational(values: readonly Rational[]): Rational {
  return values.reduce((best, value) =>
    compare(value, best) === -1 ? value : best,
  );
}

/**
 * The value of a 2×2 matrix game to the maximizer, allowing mixed strategies:
 * `[[a, b], [c, d]]` with the maximizer choosing a row and the minimizer a
 * column. This is the exact mixed-strategy minimax (security) value — the
 * quantity the folk theorem uses to bound the individually-rational region.
 */
function matrixGameValue(
  a: Rational,
  b: Rational,
  c: Rational,
  d: Rational,
): Rational {
  const maximin = maxRational([minRational([a, b]), minRational([c, d])]);
  const minimax = minRational([maxRational([a, c]), maxRational([b, d])]);
  if (compare(maximin, minimax) === 0) {
    return maximin; // pure saddle point
  }
  // Fully mixed value: (a·d − b·c) / (a − b − c + d).
  const denominator = add(subtract(subtract(a, b), c), d);
  return divide(subtract(multiply(a, d), multiply(b, c)), denominator);
}

/** Row's mixed-strategy security value over its own payoffs. */
function rowMinimaxValue(game: NormalFormGame): Rational {
  return matrixGameValue(
    payoffFor(game, { row: 0, column: 0 }, "row"),
    payoffFor(game, { row: 0, column: 1 }, "row"),
    payoffFor(game, { row: 1, column: 0 }, "row"),
    payoffFor(game, { row: 1, column: 1 }, "row"),
  );
}

/** Column's mixed-strategy security value; column is the maximizer here. */
function columnMinimaxValue(game: NormalFormGame): Rational {
  return matrixGameValue(
    payoffFor(game, { row: 0, column: 0 }, "column"),
    payoffFor(game, { row: 1, column: 0 }, "column"),
    payoffFor(game, { row: 0, column: 1 }, "column"),
    payoffFor(game, { row: 1, column: 1 }, "column"),
  );
}

/** Exact 2D convex hull (monotone chain) over rational payoff points. */
function convexHull(points: readonly PayoffPoint[]): PayoffPoint[] {
  const unique: PayoffPoint[] = [];
  for (const point of points) {
    if (
      !unique.some(
        (existing) =>
          compare(existing.row, point.row) === 0 &&
          compare(existing.column, point.column) === 0,
      )
    ) {
      unique.push(point);
    }
  }

  if (unique.length <= 2) {
    return unique;
  }

  const sorted = [...unique].sort((a, b) => {
    const byRow = compare(a.row, b.row);
    return byRow !== 0 ? byRow : compare(a.column, b.column);
  });

  const turn = (o: PayoffPoint, a: PayoffPoint, b: PayoffPoint): number => {
    const product = subtract(
      multiply(subtract(a.row, o.row), subtract(b.column, o.column)),
      multiply(subtract(a.column, o.column), subtract(b.row, o.row)),
    );
    return compare(product, ZERO);
  };

  const build = (pts: readonly PayoffPoint[]): PayoffPoint[] => {
    const chain: PayoffPoint[] = [];
    for (const point of pts) {
      while (
        chain.length >= 2 &&
        turn(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
      ) {
        chain.pop();
      }
      chain.push(point);
    }
    chain.pop();
    return chain;
  };

  const lower = build(sorted);
  const upper = build([...sorted].reverse());
  return [...lower, ...upper];
}

function thresholdForPlayer(
  cooperate: Rational,
  bestDeviation: Rational,
  punishment: Rational,
): DeltaThreshold {
  // If cooperation weakly beats the best deviation, it is a stage best response;
  // sustainable at any discount factor.
  if (compare(bestDeviation, cooperate) <= 0) {
    return { kind: "always" };
  }
  // Deviation is tempting. Punishment must be strictly below the deviation.
  if (compare(punishment, bestDeviation) >= 0) {
    return {
      kind: "never",
      reason: "The punishment payoff is not below the deviation payoff.",
    };
  }
  const value = divide(
    subtract(bestDeviation, cooperate),
    subtract(bestDeviation, punishment),
  );
  // δ must be a probability < 1; a threshold at or above 1 is unreachable.
  if (compare(value, ONE) >= 0) {
    return {
      kind: "never",
      reason:
        "Cooperation cannot be sustained for any discount factor below 1.",
    };
  }
  return { kind: "threshold", value };
}

function combineThresholds(
  row: DeltaThreshold,
  column: DeltaThreshold,
): DeltaThreshold {
  if (row.kind === "never" || column.kind === "never") {
    return row.kind === "never" ? row : column;
  }
  if (row.kind === "always") {
    return column;
  }
  if (column.kind === "always") {
    return row;
  }
  return compare(row.value, column.value) >= 0 ? row : column;
}

export function analyzeFolkTheorem(
  game: NormalFormGame,
  config: FolkTheoremConfig,
): FolkTheoremAnalysis {
  assertTwoPlayerBinary(game);

  const cooperativeProfile = config.cooperate;
  const punishmentProfile: Profile = config.punish ?? {
    row: cooperativeProfile.row === 0 ? 1 : 0,
    column: cooperativeProfile.column === 0 ? 1 : 0,
  };

  const cooperativePayoff: PayoffPoint = {
    row: payoffFor(game, cooperativeProfile, "row"),
    column: payoffFor(game, cooperativeProfile, "column"),
  };
  const punishmentPayoff: PayoffPoint = {
    row: payoffFor(game, punishmentProfile, "row"),
    column: payoffFor(game, punishmentProfile, "column"),
  };

  const rowMinimax = rowMinimaxValue(game);
  const columnMinimax = columnMinimaxValue(game);

  const feasibleHull = convexHull(
    allProfiles(game).map((profile) => ({
      row: payoffFor(game, profile, "row"),
      column: payoffFor(game, profile, "column"),
    })),
  );

  // Best one-shot deviation for each player, holding the opponent at cooperate.
  const rowBestDeviation = maxRational(
    game.rowActions.map((_row, row) =>
      payoffFor(game, { row, column: cooperativeProfile.column }, "row"),
    ),
  );
  const columnBestDeviation = maxRational(
    game.columnActions.map((_column, column) =>
      payoffFor(game, { row: cooperativeProfile.row, column }, "column"),
    ),
  );

  // The folk-theorem punishment floor is each player's minimax (security)
  // value — the harshest level an opponent can credibly hold them to, and the
  // same quantity that bounds the individually-rational region. For the PD this
  // coincides with mutual defection; for Chicken it is stricter than (and more
  // honest than) reverting to the non-credible mutual-Straight corner.
  const rowThreshold = thresholdForPlayer(
    cooperativePayoff.row,
    rowBestDeviation,
    rowMinimax,
  );
  const columnThreshold = thresholdForPlayer(
    cooperativePayoff.column,
    columnBestDeviation,
    columnMinimax,
  );

  const cooperativeIsIndividuallyRational =
    compare(cooperativePayoff.row, rowMinimax) >= 0 &&
    compare(cooperativePayoff.column, columnMinimax) >= 0;

  return {
    cooperativeProfile,
    punishmentProfile,
    cooperativePayoff,
    punishmentPayoff,
    rowMinimax,
    columnMinimax,
    feasibleHull,
    cooperativeIsIndividuallyRational,
    rowThreshold,
    columnThreshold,
    threshold: combineThresholds(rowThreshold, columnThreshold),
  };
}
