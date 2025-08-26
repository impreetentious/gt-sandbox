import {
  payoffFor,
  type NormalFormGame,
  type Player,
  type Profile,
} from "@/engine/game";
import {
  add,
  compare,
  divide,
  equals,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";
import type { MixedNashEquilibrium, MixedStrategy } from "@/engine/solve/mixed";

export interface ActionMix {
  readonly counts: readonly number[];
  readonly probabilities: readonly Rational[];
  readonly observations: number;
}

export interface FixedActionHindsight {
  readonly actualPayoff: Rational;
  readonly bestFixedPayoff: Rational;
  readonly gain: Rational;
  readonly bestActions: readonly number[];
}

export interface MixVersusNash {
  readonly empirical: ActionMix;
  readonly nash: readonly Rational[];
  readonly matchesNash: boolean;
}

function actionCount(game: NormalFormGame, player: Player): number {
  return player === "row" ? game.rowActions.length : game.columnActions.length;
}

function actionAt(profile: Profile, player: Player): number {
  return player === "row" ? profile.row : profile.column;
}

function opponentActionAt(profile: Profile, player: Player): number {
  return player === "row" ? profile.column : profile.row;
}

function payoffAgainstAction(
  game: NormalFormGame,
  player: Player,
  action: number,
  opponentAction: number,
): Rational {
  return payoffFor(
    game,
    player === "row"
      ? { row: action, column: opponentAction }
      : { row: opponentAction, column: action },
    player,
  );
}

/** Returns the exact empirical action mix from a realized profile sequence. */
export function empiricalActionMix(
  game: NormalFormGame,
  player: Player,
  profiles: readonly Profile[],
): ActionMix {
  const counts = Array.from({ length: actionCount(game, player) }, () => 0);

  for (const profile of profiles) {
    counts[actionAt(profile, player)] += 1;
  }

  const observations = profiles.length;

  return {
    counts,
    probabilities: counts.map((count) =>
      observations === 0
        ? ZERO
        : divide(
            { numerator: BigInt(count), denominator: 1n },
            { numerator: BigInt(observations), denominator: 1n },
          ),
    ),
    observations,
  };
}

/**
 * Compares actual play with the best fixed action against the opponent's
 * realized sequence. `gain` is deliberately signed: adaptive play can beat
 * every fixed action.
 */
export function fixedActionHindsight(
  game: NormalFormGame,
  player: Player,
  profiles: readonly Profile[],
): FixedActionHindsight {
  let actualPayoff = ZERO;

  for (const profile of profiles) {
    actualPayoff = add(actualPayoff, payoffFor(game, profile, player));
  }

  const fixedTotals = Array.from(
    { length: actionCount(game, player) },
    (_, action) =>
      profiles.reduce(
        (total, profile) =>
          add(
            total,
            payoffAgainstAction(
              game,
              player,
              action,
              opponentActionAt(profile, player),
            ),
          ),
        ZERO,
      ),
  );
  const bestFixedPayoff = fixedTotals.reduce(
    (best, total) => (compare(total, best) === 1 ? total : best),
    fixedTotals[0] ?? ZERO,
  );

  return {
    actualPayoff,
    bestFixedPayoff,
    gain: subtract(bestFixedPayoff, actualPayoff),
    bestActions: fixedTotals.flatMap((total, action) =>
      equals(total, bestFixedPayoff) ? [action] : [],
    ),
  };
}

/** Keeps the empirical mix and an exact Nash target together for presentation. */
export function mixVersusNash(
  game: NormalFormGame,
  player: Player,
  profiles: readonly Profile[],
  equilibrium: MixedNashEquilibrium,
): MixVersusNash {
  const empirical = empiricalActionMix(game, player, profiles);
  const target: MixedStrategy =
    player === "row" ? equilibrium.row : equilibrium.column;

  return {
    empirical,
    nash: target.probabilities,
    matchesNash: empirical.probabilities.every((probability, action) =>
      equals(probability, target.probabilities[action]),
    ),
  };
}
