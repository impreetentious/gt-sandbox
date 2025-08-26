import {
  oneShotGameContent,
  type OneShotPlayableSlug,
} from "@/content/one-shot-games";
import { catalogBySlug } from "@/engine/catalog";
import { payoffAt } from "@/engine/game";
import {
  decideOneShotOpponentAction,
  type BinaryAction,
  type OneShotOpponentPolicy,
} from "@/engine/repeated/policies";
import { add, type Rational, ZERO } from "@/engine/rational";

const DEFAULT_ONE_SHOT_SESSION_SEED = 0x5035_0001;

export type OneShotSessionStatus = "playing" | "resolving" | "complete";
export type OneShotFocusTarget = "choice-0" | "choice-1" | "play-again";

export interface OneShotRound {
  readonly number: number;
  readonly playerAction: BinaryAction;
  readonly opponentAction: BinaryAction;
  readonly predictedPlayerAction?: BinaryAction;
  readonly playerPayoff: Rational;
  readonly opponentPayoff: Rational;
}

export interface OneShotSessionState {
  readonly slug: OneShotPlayableSlug;
  readonly persona: OneShotOpponentPolicy;
  readonly seed: number;
  readonly status: OneShotSessionStatus;
  readonly rounds: readonly OneShotRound[];
  readonly pendingRound: OneShotRound | null;
  readonly playerScore: Rational;
  readonly opponentScore: Rational;
  readonly focusTarget: OneShotFocusTarget;
}

export type OneShotSessionAction =
  | { readonly type: "select-persona"; readonly persona: OneShotOpponentPolicy }
  | { readonly type: "submit-choice"; readonly action: BinaryAction }
  | { readonly type: "commit-outcome" }
  | { readonly type: "play-again" };

export function createOneShotSession(
  slug: OneShotPlayableSlug,
  persona = oneShotGameContent[slug].personas[0].id,
  seed = DEFAULT_ONE_SHOT_SESSION_SEED,
): OneShotSessionState {
  return {
    slug,
    persona,
    seed,
    status: "playing",
    rounds: [],
    pendingRound: null,
    playerScore: ZERO,
    opponentScore: ZERO,
    focusTarget: "choice-0",
  };
}

export function nextOneShotSessionSeed(seed: number): number {
  return (seed + 0x9e37_79b9) >>> 0;
}

function isPersonaForGame(
  slug: OneShotPlayableSlug,
  persona: OneShotOpponentPolicy,
): boolean {
  return oneShotGameContent[slug].personas.some(
    (candidate) => candidate.id === persona,
  );
}

function stageRound(
  state: OneShotSessionState,
  playerAction: BinaryAction,
): OneShotRound {
  const game = catalogBySlug[state.slug].game;
  const decision = decideOneShotOpponentAction({
    policy: state.persona,
    game,
    playerActions: state.rounds.map((round) => round.playerAction),
    seed: state.seed,
    round: state.rounds.length,
  });
  const [playerPayoff, opponentPayoff] = payoffAt(game, {
    row: playerAction,
    column: decision.action,
  });

  return {
    number: state.rounds.length + 1,
    playerAction,
    opponentAction: decision.action,
    predictedPlayerAction: decision.predictedPlayerAction,
    playerPayoff,
    opponentPayoff,
  };
}

/** A reducer-shared semantic session loop for all P5 one-shot games. */
export function reduceOneShotSession(
  state: OneShotSessionState,
  action: OneShotSessionAction,
): OneShotSessionState {
  switch (action.type) {
    case "select-persona":
      if (
        state.status !== "playing" ||
        state.rounds.length !== 0 ||
        !isPersonaForGame(state.slug, action.persona)
      ) {
        return state;
      }

      return { ...state, persona: action.persona };

    case "submit-choice":
      if (state.status !== "playing") {
        return state;
      }

      return {
        ...state,
        status: "resolving",
        pendingRound: stageRound(state, action.action),
        focusTarget: action.action === 0 ? "choice-0" : "choice-1",
      };

    case "commit-outcome": {
      const round = state.pendingRound;

      if (state.status !== "resolving" || !round) {
        return state;
      }

      const rounds = [...state.rounds, round];
      const isComplete =
        rounds.length === oneShotGameContent[state.slug].roundLimit;

      return {
        ...state,
        status: isComplete ? "complete" : "playing",
        rounds,
        pendingRound: null,
        playerScore: add(state.playerScore, round.playerPayoff),
        opponentScore: add(state.opponentScore, round.opponentPayoff),
        focusTarget: isComplete
          ? "play-again"
          : round.playerAction === 0
            ? "choice-0"
            : "choice-1",
      };
    }

    case "play-again":
      return state.status === "complete"
        ? createOneShotSession(
            state.slug,
            state.persona,
            nextOneShotSessionSeed(state.seed),
          )
        : state;
  }
}
