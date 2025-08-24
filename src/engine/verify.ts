import {
  add,
  compare,
  isZero,
  multiply,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";
import {
  payoffFor,
  type NormalFormGame,
  type Player,
  type Profile,
} from "@/engine/game";
import type { MixedNashEquilibrium, MixedStrategy } from "@/engine/solve/mixed";

export interface PureProfileVerification {
  readonly profile: Profile;
  readonly rowBestResponse: boolean;
  readonly columnBestResponse: boolean;
  readonly isNashEquilibrium: boolean;
}

export interface MixedEquilibriumVerification {
  readonly rowStrategyValid: boolean;
  readonly columnStrategyValid: boolean;
  readonly rowBestResponds: boolean;
  readonly columnBestResponds: boolean;
  readonly isNashEquilibrium: boolean;
}

function rowHasProfitableDeviation(
  game: NormalFormGame,
  profile: Profile,
): boolean {
  const current = payoffFor(game, profile, "row");

  for (let row = 0; row < game.rowActions.length; row += 1) {
    if (
      compare(
        payoffFor(game, { row, column: profile.column }, "row"),
        current,
      ) === 1
    ) {
      return true;
    }
  }

  return false;
}

function columnHasProfitableDeviation(
  game: NormalFormGame,
  profile: Profile,
): boolean {
  const current = payoffFor(game, profile, "column");

  for (let column = 0; column < game.columnActions.length; column += 1) {
    if (
      compare(
        payoffFor(game, { row: profile.row, column }, "column"),
        current,
      ) === 1
    ) {
      return true;
    }
  }

  return false;
}

/** An independent, deviation-based check for a claimed pure equilibrium. */
export function verifyPureProfile(
  game: NormalFormGame,
  profile: Profile,
): PureProfileVerification {
  const rowBestResponse = !rowHasProfitableDeviation(game, profile);
  const columnBestResponse = !columnHasProfitableDeviation(game, profile);

  return {
    profile,
    rowBestResponse,
    columnBestResponse,
    isNashEquilibrium: rowBestResponse && columnBestResponse,
  };
}

function expectedPayoffAgainstMix(
  game: NormalFormGame,
  player: Player,
  action: number,
  opponentProbabilities: readonly Rational[],
): Rational {
  let total = ZERO;

  for (
    let opponentAction = 0;
    opponentAction < opponentProbabilities.length;
    opponentAction += 1
  ) {
    const profile =
      player === "row"
        ? { row: action, column: opponentAction }
        : { row: opponentAction, column: action };
    total = add(
      total,
      multiply(
        payoffFor(game, profile, player),
        opponentProbabilities[opponentAction],
      ),
    );
  }

  return total;
}

function hasValidProbabilities(
  strategy: MixedStrategy,
  actionCount: number,
): boolean {
  if (strategy.probabilities.length !== actionCount) {
    return false;
  }

  const total = strategy.probabilities.reduce(
    (sum, probability) => add(sum, probability),
    ZERO,
  );
  return (
    compare(total, ONE) === 0 &&
    strategy.probabilities.every(
      (probability) => compare(probability, ZERO) !== -1,
    )
  );
}

function bestRespondsToMix(
  game: NormalFormGame,
  player: Player,
  ownStrategy: MixedStrategy,
  opponentStrategy: MixedStrategy,
): boolean {
  const payoffs = ownStrategy.probabilities.map((_, action) =>
    expectedPayoffAgainstMix(
      game,
      player,
      action,
      opponentStrategy.probabilities,
    ),
  );
  const bestPayoff = payoffs.reduce(
    (best, payoff) => (compare(payoff, best) === 1 ? payoff : best),
    payoffs[0],
  );

  return ownStrategy.probabilities.every((probability, action) =>
    isZero(probability)
      ? compare(payoffs[action], bestPayoff) !== 1
      : compare(payoffs[action], bestPayoff) === 0,
  );
}

/** An independent expected-payoff check for a claimed mixed equilibrium. */
export function verifyMixedEquilibrium(
  game: NormalFormGame,
  equilibrium: MixedNashEquilibrium,
): MixedEquilibriumVerification {
  const rowStrategyValid = hasValidProbabilities(
    equilibrium.row,
    game.rowActions.length,
  );
  const columnStrategyValid = hasValidProbabilities(
    equilibrium.column,
    game.columnActions.length,
  );
  const rowBestResponds =
    rowStrategyValid &&
    columnStrategyValid &&
    bestRespondsToMix(game, "row", equilibrium.row, equilibrium.column);
  const columnBestResponds =
    rowStrategyValid &&
    columnStrategyValid &&
    bestRespondsToMix(game, "column", equilibrium.column, equilibrium.row);

  return {
    rowStrategyValid,
    columnStrategyValid,
    rowBestResponds,
    columnBestResponds,
    isNashEquilibrium: rowBestResponds && columnBestResponds,
  };
}
