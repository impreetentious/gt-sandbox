import {
  add,
  compare,
  divide,
  isZero,
  multiply,
  ONE,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";
import { payoffFor, type NormalFormGame } from "@/engine/game";
import type { MixedNashEquilibrium } from "@/engine/solve/mixed";

function payoff(
  game: NormalFormGame,
  row: number,
  column: number,
  player: "row" | "column",
): Rational {
  return payoffFor(game, { row, column }, player);
}

function isProbability(value: Rational): boolean {
  return compare(value, ZERO) === 1 && compare(value, ONE) === -1;
}

function complement(value: Rational): Rational {
  return subtract(ONE, value);
}

/**
 * Closed-form, full-support 2×2 mixed equilibrium. This is deliberately
 * separate from support enumeration so the two paths can cross-check.
 */
export function twoByTwoMixedEquilibrium(
  game: NormalFormGame,
): MixedNashEquilibrium | null {
  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    throw new RangeError("The closed-form solver requires a 2×2 game.");
  }

  const columnDenominator = add(
    subtract(payoff(game, 0, 0, "column"), payoff(game, 1, 0, "column")),
    subtract(payoff(game, 1, 1, "column"), payoff(game, 0, 1, "column")),
  );
  const rowDenominator = add(
    subtract(payoff(game, 0, 0, "row"), payoff(game, 0, 1, "row")),
    subtract(payoff(game, 1, 1, "row"), payoff(game, 1, 0, "row")),
  );

  if (isZero(columnDenominator) || isZero(rowDenominator)) {
    return null;
  }

  const rowFirstProbability = divide(
    subtract(payoff(game, 1, 1, "column"), payoff(game, 1, 0, "column")),
    columnDenominator,
  );
  const columnFirstProbability = divide(
    subtract(payoff(game, 1, 1, "row"), payoff(game, 0, 1, "row")),
    rowDenominator,
  );

  if (
    !isProbability(rowFirstProbability) ||
    !isProbability(columnFirstProbability)
  ) {
    return null;
  }

  const rowSecondProbability = complement(rowFirstProbability);
  const columnSecondProbability = complement(columnFirstProbability);

  return {
    row: {
      probabilities: [rowFirstProbability, rowSecondProbability],
      support: [0, 1],
    },
    column: {
      probabilities: [columnFirstProbability, columnSecondProbability],
      support: [0, 1],
    },
    rowPayoff: add(
      multiply(columnFirstProbability, payoff(game, 0, 0, "row")),
      multiply(columnSecondProbability, payoff(game, 0, 1, "row")),
    ),
    columnPayoff: add(
      multiply(rowFirstProbability, payoff(game, 0, 0, "column")),
      multiply(rowSecondProbability, payoff(game, 1, 0, "column")),
    ),
  };
}
