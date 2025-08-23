import { compare } from "@/engine/rational";
import { payoffFor, type NormalFormGame, type Profile } from "@/engine/game";

export interface PureProfileVerification {
  readonly profile: Profile;
  readonly rowBestResponse: boolean;
  readonly columnBestResponse: boolean;
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
