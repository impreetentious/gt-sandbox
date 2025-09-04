import { pd } from "@/engine/catalog/pd";
import { payoffAt } from "@/engine/game";
import {
  decidePdOpponentAction,
  type BinaryAction,
  type PdOpponentPolicy,
} from "@/engine/repeated/policies";
import { add, type Rational, ZERO } from "@/engine/rational";

export const PD_SESSION_ROUNDS = 10;

const DEFAULT_PD_SESSION_SEED = 0x5044_0001;

export type PdAction = BinaryAction;
export type PdPersonaId = PdOpponentPolicy;
export type PdSessionStatus = "playing" | "resolving" | "complete";
export type PdFocusTarget = "choice-0" | "choice-1" | "play-again";

export interface PdRound {
  readonly number: number;
  readonly playerAction: PdAction;
  readonly opponentAction: PdAction;
  readonly playerPayoff: Rational;
  readonly opponentPayoff: Rational;
}

export interface PdSessionState {
  readonly persona: PdPersonaId;
  readonly seed: number;
  readonly status: PdSessionStatus;
  readonly rounds: readonly PdRound[];
  readonly pendingRound: PdRound | null;
  readonly playerScore: Rational;
  readonly opponentScore: Rational;
  readonly focusTarget: PdFocusTarget;
}

export type PdSessionAction =
  | { readonly type: "select-persona"; readonly persona: PdPersonaId }
  | {
      readonly type: "hydrate";
      readonly persona?: PdPersonaId;
      readonly seed?: number;
    }
  | { readonly type: "submit-choice"; readonly action: PdAction }
  | { readonly type: "commit-outcome" }
  | { readonly type: "play-again" };

const PD_PERSONA_IDS: readonly PdPersonaId[] = ["always:C", "always:D", "tft"];

export function isPdPersonaId(value: string): value is PdPersonaId {
  return (PD_PERSONA_IDS as readonly string[]).includes(value);
}

export function createPdSession(
  persona: PdPersonaId = "tft",
  seed = DEFAULT_PD_SESSION_SEED,
): PdSessionState {
  return {
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

/** Produces a new deterministic session seed without consulting wall-clock time. */
export function nextPdSessionSeed(seed: number): number {
  return (seed + 0x9e37_79b9) >>> 0;
}

function stageRound(state: PdSessionState, action: PdAction): PdRound {
  const playerActions = state.rounds.map((round) => round.playerAction);
  const opponentAction = decidePdOpponentAction(state.persona, playerActions);
  const [playerPayoff, opponentPayoff] = payoffAt(pd.game, {
    row: action,
    column: opponentAction,
  });

  return {
    number: state.rounds.length + 1,
    playerAction: action,
    opponentAction,
    playerPayoff,
    opponentPayoff,
  };
}

/**
 * Semantic PD session reducer. A visual transition only delays
 * `commit-outcome`; it cannot alter the already staged round.
 */
export function reducePdSession(
  state: PdSessionState,
  action: PdSessionAction,
): PdSessionState {
  switch (action.type) {
    case "select-persona":
      if (state.status !== "playing" || state.rounds.length !== 0) {
        return state;
      }

      return { ...state, persona: action.persona };

    case "hydrate": {
      if (state.status !== "playing" || state.rounds.length !== 0) {
        return state;
      }
      const persona = action.persona ?? state.persona;
      const seed = action.seed ?? state.seed;
      if (persona === state.persona && seed === state.seed) {
        return state;
      }
      return createPdSession(persona, seed);
    }

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
      const isComplete = rounds.length === PD_SESSION_ROUNDS;

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
        ? createPdSession(state.persona, nextPdSessionSeed(state.seed))
        : state;
  }
}
