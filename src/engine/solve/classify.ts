import { compare } from "@/engine/rational";
import { payoffFor, type NormalFormGame, type Profile } from "@/engine/game";
import { pureNashEquilibria } from "@/engine/solve/pure";
import { strictlyParetoDominates } from "@/engine/solve/pareto";

export type StrategicStructure =
  | "dominance"
  | "dilemma"
  | "coordination (assurance)"
  | "battle"
  | "anti-coordination"
  | "cycle"
  | "degenerate";

function assertTwoByTwo(game: NormalFormGame): void {
  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    throw new RangeError(
      "The strategic-structure classifier requires a 2×2 game.",
    );
  }
}

function hasBestResponseTie(game: NormalFormGame): boolean {
  for (const column of [0, 1]) {
    if (
      compare(
        payoffFor(game, { row: 0, column }, "row"),
        payoffFor(game, { row: 1, column }, "row"),
      ) === 0
    ) {
      return true;
    }
  }

  for (const row of [0, 1]) {
    if (
      compare(
        payoffFor(game, { row, column: 0 }, "column"),
        payoffFor(game, { row, column: 1 }, "column"),
      ) === 0
    ) {
      return true;
    }
  }

  return false;
}

function isOffDiagonalPair(first: Profile, second: Profile): boolean {
  return first.row !== first.column && second.row !== second.column;
}

function equilibriumIsStrictlyDominated(
  game: NormalFormGame,
  equilibrium: Profile,
): boolean {
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      if (strictlyParetoDominates(game, equilibrium, { row, column })) {
        return true;
      }
    }
  }

  return false;
}

/** Classifies the strict ordinal best-response structure of a 2×2 game. */
export function classifyTwoByTwo(game: NormalFormGame): StrategicStructure {
  assertTwoByTwo(game);

  if (hasBestResponseTie(game)) {
    return "degenerate";
  }

  const equilibria = pureNashEquilibria(game);

  if (equilibria.length === 0) {
    return "cycle";
  }

  if (equilibria.length === 1) {
    return equilibriumIsStrictlyDominated(game, equilibria[0])
      ? "dilemma"
      : "dominance";
  }

  const [first, second] = equilibria;

  if (isOffDiagonalPair(first, second)) {
    return "anti-coordination";
  }

  const rowPreference = compare(
    payoffFor(game, first, "row"),
    payoffFor(game, second, "row"),
  );
  const columnPreference = compare(
    payoffFor(game, first, "column"),
    payoffFor(game, second, "column"),
  );

  if (rowPreference === 0 || columnPreference === 0) {
    return "degenerate";
  }

  return rowPreference === columnPreference
    ? "coordination (assurance)"
    : "battle";
}
