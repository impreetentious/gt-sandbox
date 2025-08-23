import { compare, type Rational } from "@/engine/rational";
import {
  allProfiles,
  payoffFor,
  type NormalFormGame,
  type Player,
  type Profile,
} from "@/engine/game";

function playerActionCount(game: NormalFormGame, player: Player): number {
  return player === "row" ? game.rowActions.length : game.columnActions.length;
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

export function bestResponses(
  game: NormalFormGame,
  player: Player,
  opponentAction: number,
): number[] {
  const actions = Array.from(
    { length: playerActionCount(game, player) },
    (_, index) => index,
  );
  let bestPayoff: Rational | undefined;
  const responses: number[] = [];

  for (const action of actions) {
    const payoff = payoffAgainstAction(game, player, action, opponentAction);

    if (!bestPayoff || compare(payoff, bestPayoff) === 1) {
      bestPayoff = payoff;
      responses.splice(0, responses.length, action);
    } else if (compare(payoff, bestPayoff) === 0) {
      responses.push(action);
    }
  }

  return responses;
}

export function isBestResponse(
  game: NormalFormGame,
  player: Player,
  action: number,
  opponentAction: number,
): boolean {
  return bestResponses(game, player, opponentAction).includes(action);
}

export function pureNashEquilibria(game: NormalFormGame): Profile[] {
  return allProfiles(game).filter(
    (profile) =>
      isBestResponse(game, "row", profile.row, profile.column) &&
      isBestResponse(game, "column", profile.column, profile.row),
  );
}
