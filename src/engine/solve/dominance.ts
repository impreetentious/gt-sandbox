import { compare, ZERO, type Rational } from "@/engine/rational";
import { payoffFor, type NormalFormGame, type Player } from "@/engine/game";
import {
  strictlyDominatedByMixture,
  weaklyDominatedByMixture,
  type MixtureCertificate,
} from "@/engine/lp/mixture-dominance";

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

/**
 * A strategy beaten by a *mixture* of the player's other strategies rather than
 * by any single one of them.
 */
export interface MixedDominanceRelation {
  readonly player: Player;
  readonly dominated: number;
  readonly kind: DominanceKind;
  /**
   * Weight on every action index of this player. Actions that were already
   * eliminated, and the dominated action itself, carry zero.
   */
  readonly weights: readonly Rational[];
  /** Action indices carrying positive weight. */
  readonly support: readonly number[];
  /** Worst-case gain of the mixture over the dominated action. */
  readonly margin: Rational;
  /** Best-case gain — what carries a weak-dominance claim. */
  readonly bestGain: Rational;
  /**
   * True when no single pure strategy dominates this action, so the mixture is
   * carrying the whole result. This is the case pure-strategy elimination
   * misses, and the only one worth showing a reader separately.
   */
  readonly requiresMixing: boolean;
}

export interface MixedEliminationStep extends MixedDominanceRelation {
  readonly remainingBefore: AvailableStrategies;
}

export interface MixedEliminationTrace {
  readonly steps: readonly MixedEliminationStep[];
  readonly remaining: AvailableStrategies;
}

export interface DominanceAnalysis {
  readonly strict: readonly DominanceRelation[];
  readonly weak: readonly DominanceRelation[];
  readonly strictTrace: EliminationTrace;
  readonly weakTrace: EliminationTrace;
  /**
   * Strict dominance allowing mixed dominators. A superset of `strict` — every
   * pure dominator is a degenerate mixture — so only the entries with
   * `requiresMixing` are new information.
   */
  readonly mixedStrict: readonly MixedDominanceRelation[];
  readonly mixedStrictTrace: MixedEliminationTrace;
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

function actionCount(game: NormalFormGame, player: Player): number {
  return player === "row" ? game.rowActions.length : game.columnActions.length;
}

/**
 * Finds every action beaten by a mixture over the player's remaining actions.
 *
 * The dominated action is excluded from its own dominating mixture. For strict
 * dominance including it changes nothing — any mixture containing the target
 * that beats it can be renormalized without it — but for weak dominance it can,
 * and the standard definition excludes it, so both cases follow the same rule
 * rather than diverging on a technicality.
 *
 * Ordering matters for reproducibility: rows before columns, and lowest action
 * index first, matching `dominanceRelations` so the two traces step in step.
 */
export function mixedDominanceRelations(
  game: NormalFormGame,
  kind: DominanceKind,
  available = initiallyAvailable(game),
): MixedDominanceRelation[] {
  const relations: MixedDominanceRelation[] = [];
  const decide =
    kind === "strict" ? strictlyDominatedByMixture : weaklyDominatedByMixture;

  for (const player of ["row", "column"] as const) {
    const actions = available[player];
    const opponentActions = available[player === "row" ? "column" : "row"];

    for (const dominated of actions) {
      const candidates = actions.filter((action) => action !== dominated);

      if (candidates.length === 0) {
        continue;
      }

      const verdict = decide(
        candidates.map((action) =>
          opponentActions.map((opponentAction) =>
            playerPayoff(game, player, action, opponentAction),
          ),
        ),
        opponentActions.map((opponentAction) =>
          playerPayoff(game, player, dominated, opponentAction),
        ),
      );

      if (verdict.kind !== "dominated") {
        continue;
      }

      relations.push(
        expand(game, player, dominated, kind, candidates, verdict.certificate),
      );
    }
  }

  return relations;
}

/** Lifts a certificate over the candidate subset back to full action indices. */
function expand(
  game: NormalFormGame,
  player: Player,
  dominated: number,
  kind: DominanceKind,
  candidates: readonly number[],
  certificate: MixtureCertificate,
): MixedDominanceRelation {
  const weights = Array.from({ length: actionCount(game, player) }, () => ZERO);

  candidates.forEach((action, index) => {
    weights[action] = certificate.weights[index];
  });

  const support = certificate.support.map((index) => candidates[index]);

  return {
    player,
    dominated,
    kind,
    weights,
    support,
    margin: certificate.margin,
    bestGain: certificate.bestGain,
    requiresMixing: support.length > 1,
  };
}

export function eliminateMixedDominatedStrategies(
  game: NormalFormGame,
  kind: DominanceKind,
): MixedEliminationTrace {
  let available = initiallyAvailable(game);
  const steps: MixedEliminationStep[] = [];

  while (true) {
    const relation = mixedDominanceRelations(game, kind, available)[0];

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
    mixedStrict: mixedDominanceRelations(game, "strict"),
    mixedStrictTrace: eliminateMixedDominatedStrategies(game, "strict"),
  };
}
