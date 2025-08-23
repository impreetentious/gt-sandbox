import { compare } from "@/engine/rational";
import { payoffFor, type NormalFormGame, type Player } from "@/engine/game";

export type DominanceKind = "strict" | "weak";

export interface AvailableStrategies {
  readonly row: readonly number[];
  readonly column: readonly number[];
}

export interface DominanceRelation {
  readonly player: Player;
  readonly dominated: number;
  readonly dominator: number;
  readonly kind: DominanceKind;
}

export interface EliminationStep extends DominanceRelation {
  readonly remainingBefore: AvailableStrategies;
}

export interface EliminationTrace {
  readonly steps: readonly EliminationStep[];
  readonly remaining: AvailableStrategies;
}

export interface DominanceAnalysis {
  readonly strict: readonly DominanceRelation[];
  readonly weak: readonly DominanceRelation[];
  readonly strictTrace: EliminationTrace;
  readonly weakTrace: EliminationTrace;
}

function initiallyAvailable(game: NormalFormGame): AvailableStrategies {
  return {
    row: Array.from({ length: game.rowActions.length }, (_, index) => index),
    column: Array.from(
      { length: game.columnActions.length },
      (_, index) => index,
    ),
  };
}

function playerPayoff(
  game: NormalFormGame,
  player: Player,
  action: number,
  opponentAction: number,
) {
  return payoffFor(
    game,
    player === "row"
      ? { row: action, column: opponentAction }
      : { row: opponentAction, column: action },
    player,
  );
}

function dominates(
  game: NormalFormGame,
  player: Player,
  dominator: number,
  dominated: number,
  available: AvailableStrategies,
  kind: DominanceKind,
): boolean {
  const opponentActions = available[player === "row" ? "column" : "row"];
  let strictlyBetterSomewhere = false;

  for (const opponentAction of opponentActions) {
    const comparison = compare(
      playerPayoff(game, player, dominator, opponentAction),
      playerPayoff(game, player, dominated, opponentAction),
    );

    if (comparison === -1 || (kind === "strict" && comparison === 0)) {
      return false;
    }

    if (comparison === 1) {
      strictlyBetterSomewhere = true;
    }
  }

  return kind === "strict" || strictlyBetterSomewhere;
}

export function dominanceRelations(
  game: NormalFormGame,
  kind: DominanceKind,
  available = initiallyAvailable(game),
): DominanceRelation[] {
  const relations: DominanceRelation[] = [];

  for (const player of ["row", "column"] as const) {
    const actions = available[player];

    for (const dominated of actions) {
      for (const dominator of actions) {
        if (
          dominator !== dominated &&
          dominates(game, player, dominator, dominated, available, kind)
        ) {
          relations.push({ player, dominated, dominator, kind });
        }
      }
    }
  }

  return relations;
}

function copyAvailable(available: AvailableStrategies): AvailableStrategies {
  return { row: [...available.row], column: [...available.column] };
}

export function eliminateDominatedStrategies(
  game: NormalFormGame,
  kind: DominanceKind,
): EliminationTrace {
  let available = initiallyAvailable(game);
  const steps: EliminationStep[] = [];

  while (true) {
    const relation = dominanceRelations(game, kind, available)[0];

    if (!relation) {
      return { steps, remaining: available };
    }

    steps.push({ ...relation, remainingBefore: copyAvailable(available) });
    available = {
      ...available,
      [relation.player]: available[relation.player].filter(
        (action) => action !== relation.dominated,
      ),
    };
  }
}

export function analyzeDominance(game: NormalFormGame): DominanceAnalysis {
  return {
    strict: dominanceRelations(game, "strict"),
    weak: dominanceRelations(game, "weak"),
    strictTrace: eliminateDominatedStrategies(game, "strict"),
    weakTrace: eliminateDominatedStrategies(game, "weak"),
  };
}
